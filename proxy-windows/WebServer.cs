using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Markup;

namespace ProxyServer
{
    public class WebServer
    {
        private readonly HttpListener listener = new HttpListener();
        private string _proxyAddress = string.Empty;
        private bool _huaweiCloud = false;

        public void Start(int port, string proxyAddress)
        {
            _proxyAddress = proxyAddress;
            _huaweiCloud = _proxyAddress.ToLower().Contains("huawei");
            if (listener.IsListening) return;
            listener.Prefixes.Clear();
            listener.Prefixes.Add($"http://+:{port}/");
            listener.Start();

            Thread thread = new Thread(new ThreadStart(AcceptConnection))
            {
                IsBackground = true
            };
            thread.Start();
        }

        public bool IsListening => listener.IsListening;

        public void Stop()
        {
            listener.Stop();
        }

        private void AcceptConnection()
        {
            try
            {
                while (true)
                {
                    HttpListenerContext context = listener.GetContext();
                    try
                    {
                        ProcessCors(context.Response);
                        _ = Proxy(context);
                    }
                    catch (Exception)
                    {
                        try
                        {
                            context.Response.Close();
                        }
                        catch (Exception)
                        {
                        }
                    }
                }
            }
            catch (Exception)
            {
                listener.Stop();
            }
        }

        public async Task Proxy(HttpListenerContext ctx)
        {
            if(ctx.Request.HttpMethod.ToUpper() == "OPTIONS")
            {
                ctx.Response.StatusCode = 200;
                ctx.Response.Close();
                return;
            }
            try
            {
                if (string.IsNullOrWhiteSpace(_proxyAddress))
                {
                    await ProxyLocal(ctx);
                }
                else
                {
                    await ProxyRemote(ctx);
                }
            }
            catch(Exception)
            {
            }
            ctx.Response.Close();
        }

        public async Task ProxyRemote(HttpListenerContext ctx)
        {
            try
            {
                string queryString = "?";
                foreach (string key in ctx.Request.QueryString.AllKeys)
                {
                    queryString += $"{key}={Uri.EscapeDataString(ctx.Request.QueryString[key])}&";
                }
                byte[] body = DataAsBytes(ctx.Request.InputStream);
                string cacheName = CacheConfig.GetName(queryString, body);
                CacheConfig cacheConfig = CacheConfig.GetCache(cacheName);
                if(cacheConfig != null)
                {
                    await ResponseHuawei(ctx, cacheConfig);
                    return;
                }
                if (queryString.Length < 5 && (body == null || body.Length <= 0))
                {
                    ctx.Response.StatusCode = 500;
                    return;
                }
#pragma warning disable SYSLIB0014
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(_proxyAddress + queryString);
#pragma warning restore SYSLIB0014
                request.Method = ctx.Request.HttpMethod;
                request.ContentLength = body.Length;
                if (request.ContentLength > 0)
                {
                    request.GetRequestStream().Write(body, 0, body.Length);
                }
                HttpWebResponse response = (HttpWebResponse)await request.GetResponseAsync();
                if (_huaweiCloud)
                {
                    await ResponseHuawei(ctx, response, cacheName);
                }
                else
                {
                    await ResponseLocal(ctx, response, cacheName);
                }
            }
            catch (Exception ex)
            {
                Trace.WriteLine("HttpRequest Error: " + ex);
            }
        }

        private async Task ResponseHuawei(HttpListenerContext ctx, CacheConfig cacheConfig)
        {        
            SetHeaders(ctx.Response, cacheConfig.Headers);
            ctx.Response.StatusCode = cacheConfig.StatusCode;
            await WriteResponse(ctx, File.OpenRead(cacheConfig.FullPath));
        }

        private async Task ResponseHuawei(HttpListenerContext ctx, HttpWebResponse response, string cacheName)
        {
            string bodyString = DataAsString(response.GetResponseStream(), GetEncoding(response.ContentEncoding));
            if(string.IsNullOrWhiteSpace(bodyString))
            {
                return;
            }
            HuaweiResponse huawei = JsonConvert.DeserializeObject<HuaweiResponse>(bodyString);
            SetHeaders(ctx.Response, huawei.Headers);
            ctx.Response.StatusCode = huawei.StatusCode;
            byte[] data = Convert.FromBase64String(huawei.Body);
            await WriteResponse(ctx, data);
            huawei.Headers.TryGetValue("content-range", out string contentRange);
            if(huawei.StatusCode >= 200 && huawei.StatusCode < 300 &&
                (string.IsNullOrWhiteSpace(contentRange) || contentRange.ToLower().StartsWith("bytes 0-")))
            {
                CacheConfig.Save(cacheName, huawei.StatusCode, huawei.Headers, data);
            }
        }

        private Encoding GetEncoding(string text)
        {
            try
            {
                return Encoding.GetEncoding(text);
            }
            catch (Exception)
            {
                return Encoding.UTF8;
            }
        }

        private async Task ResponseLocal(HttpListenerContext ctx, HttpWebResponse response, string cacheName)
        {
            Dictionary<string, string> resHeaders = new Dictionary<string, string>();
            foreach (string item in response.Headers.AllKeys)
            {
                resHeaders.Add(item, response.Headers.Get(item) ?? string.Empty);
            }
            SetHeaders(ctx.Response, resHeaders);
            ctx.Response.StatusCode = (int)response.StatusCode;
            ctx.Response.ContentType = response.ContentType;
            await WriteResponse(ctx, response.GetResponseStream(), response.ContentLength);

            try
            {
                if (response.ContentLength > 0)
                {
                    ctx.Response.ContentLength64 = response.ContentLength;
                }
                using (Stream stream = response.GetResponseStream())
                {
                    using (FileStream fileStream = new FileStream(CacheConfig.GetFullPath(cacheName), FileMode.Append, FileAccess.Write))
                    {
                        byte[] buffer = new byte[4096];
                        int bytesRead;
                        while ((bytesRead = stream.Read(buffer, 0, buffer.Length)) > 0)
                        {
                            ctx.Response.OutputStream.Write(buffer, 0, bytesRead);
                            fileStream.Write(buffer, 0, bytesRead);
                        }
                    }
                }
                CacheConfig.Save(cacheName, ctx.Response.StatusCode, resHeaders);
            }
            catch (Exception ex)
            {
                Trace.WriteLine("Send Response Stream Error: " + ex);
            }
        }

        public static async Task ProxyLocal(HttpListenerContext ctx)
        {
            ProxyResponseData proxyResData;
            string queryUrl = ctx.Request.QueryString["url"] ?? string.Empty;
            var proxyData = ProxyRequestData.Parse(string.IsNullOrWhiteSpace(queryUrl) ? DataAsString(ctx.Request.InputStream, ctx.Request.ContentEncoding) : queryUrl);
            proxyResData = await Request(proxyData);
            if (proxyResData.StatusCode > 300 && proxyResData.StatusCode < 310)
            {
                ctx.Response.StatusCode = 200;
                ctx.Response.ContentType = "application/json";
                await WriteResponse(ctx, proxyResData.Headers);
            }
            else
            {
                SetHeaders(ctx.Response, proxyResData.Headers);
                ctx.Response.StatusCode = proxyResData.StatusCode;
                ctx.Response.ContentType = proxyResData.ContentType;
                if (proxyResData.Stream != null)
                {
                    await WriteResponse(ctx, proxyResData.Stream, proxyResData.ContentLength);
                }
                else
                {
                    await WriteResponse(ctx, proxyResData.Data);
                }
            }
            return;
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, Dictionary<string, string> data)
        {
            try
            {
                string res = JsonConvert.SerializeObject(data);
                byte[] bytes = Encoding.UTF8.GetBytes(res);
                ctx.Response.ContentLength64 = bytes.Length;
                await ctx.Response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
                return true;
            }
            catch (Exception ex)
            {
                Trace.WriteLine("Send Response Error: " + ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, Stream stream, long length = 0)
        {
            try
            {
                if (length > 0)
                {
                    ctx.Response.ContentLength64 = length;
                }
                await stream.CopyToAsync(ctx.Response.OutputStream);
                stream.Close();
                return true;
            }
            catch (Exception ex)
            {
                Trace.WriteLine("Send Response Stream Error: " + ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, byte[] data)
        {
            try
            {
                ctx.Response.ContentLength64 = data.Length;
                await ctx.Response.OutputStream.WriteAsync(data, 0, data.Length);
                return true;
            }
            catch (Exception ex)
            {
                Trace.WriteLine("Send Response Error: " + ex);
                return false;
            }
        }

        public static async Task<ProxyResponseData> Request(ProxyRequestData data)
        {
            if (!Uri.IsWellFormedUriString(data.Url, UriKind.Absolute))
            {
                return new ProxyResponseData(new Dictionary<string, object>()
                {
                    {"msg", "参数错误" }
                });
            }
            try
            {
#pragma warning disable SYSLIB0014
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(data.Url);
#pragma warning restore SYSLIB0014
                request.Method = data.Method;
                request.ContentLength = data.DataBytes.Length;
                SetHeaders(request, data.Headers);
                request.AllowAutoRedirect = data.AllowAutoRedirect;
                if (data.HasBody)
                {
                    using (var stream = request.GetRequestStream())
                    {
                        stream.Write(data.DataBytes, 0, data.DataBytes.Length);
                    }
                }

                HttpWebResponse response = (HttpWebResponse)await request.GetResponseAsync();
                Dictionary<string, string> resHeaders = new Dictionary<string, string>();
                foreach (string item in response.Headers.AllKeys)
                {
                    resHeaders.Add(item, response.Headers.Get(item) ?? string.Empty);
                }
                if (data.SetCookieRename && resHeaders.ContainsKey("Set-Cookie"))
                {
                    resHeaders.Add("Set-Cookie-Renamed", resHeaders["Set-Cookie"]);
                }

                return new ProxyResponseData(
                    response.GetResponseStream(),
                    response.ContentLength,
                    (int)response.StatusCode,
                    response.ContentType,
                    response.ContentEncoding ?? string.Empty,
                    response.CharacterSet ?? string.Empty,
                    resHeaders);
            }
            catch (Exception ex)
            {
                Trace.WriteLine("HttpRequest Error: " + ex);
            }
            return ProxyResponseData.Empty;
        }

        private static void ProcessCors(HttpListenerResponse response)
        {
            response.AddHeader("Access-Control-Allow-Origin", "*");
            response.AddHeader("Access-Control-Allow-Headers", "*");
            response.AddHeader("Access-Control-Allow-Methods", "*");
            response.AddHeader("Access-Control-Expose-Headers", "*");
            response.AddHeader("Access-Control-Allow-Credentials", "true");
        }

        private static string DataAsString(Stream inputStream, Encoding encoding)
        {
            try
            {
                using (Stream body = inputStream)
                {
                    using (StreamReader reader = new StreamReader(body, encoding))
                    {
                        return reader.ReadToEnd();
                    }
                }
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }

        private static byte[] DataAsBytes(Stream inputStream)
        {
            try
            {
                using (Stream stream = inputStream)
                {
                    using (MemoryStream memoryStream = new MemoryStream())
                    {
                        stream.CopyTo(memoryStream);
                        return memoryStream.ToArray();
                    }
                }
            }
            catch (Exception)
            {
                return null;
            }
        }

        private static void SetHeaders(HttpWebRequest request, Dictionary<string, string> headers)
        {
            request.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";
            if (headers == null) return;
            foreach (var item in headers)
            {
                if (item.Key.ToLower() == "referer")
                {
                    request.Referer = item.Value;
                }
                else if (item.Key.ToLower().Replace("-", "") == "useragent")
                {
                    request.UserAgent = item.Value;
                }
                else if (item.Key.ToLower().Replace("-", "") == "contenttype")
                {
                    request.ContentType = item.Value;
                }
                else if (item.Key.ToLower() == "accept")
                {
                    request.Accept = item.Value;
                }
                else if (item.Key.ToLower() == "host")
                {
                    request.Host = item.Value;
                }
                else if (item.Key.ToLower() == "range")
                {
                }
                else
                {
                    request.Headers.Set(item.Key, item.Value);
                }
            }
        }

        private static void SetHeaders(HttpListenerResponse response, Dictionary<string, string> headers)
        {
            if (headers == null) return;
            HashSet<string> headerKeys = response.Headers.AllKeys.Select(m => m.ToLower().Replace("-", "")).ToHashSet();
            foreach (var item in headers)
            {
                if (headerKeys.Contains(item.Key)) continue;
                string key = item.Key.ToLower().Replace("-", "");
                switch (key)
                {
                    case "contenttype":
                        response.ContentType = item.Value;
                        break;
                    case "cookies":
                    case "connection":
                    case "contentlength":
                    case "transferencoding":
                    case "accesscontrolalloworigin":
                    case "accesscontrolallowheaders":
                    case "accesscontrolallowmethods":
                    case "accesscontrolexposeheaders":
                    case "accesscontrolallowcredentials":
                        break;
                    default:
                        response.Headers.Set(item.Key, item.Value);
                        break;
                }
            }
        }
    }
}
