using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Musiche.Server
{
    public class HttpProxy
    {
        private static string GetLocalProxy()
        {
            string value = HttpHandler.GetStorage("musiche-proxy");
            if (string.IsNullOrWhiteSpace(value)) return "system";
            try
            {
                string proxy = JsonConvert.DeserializeObject<string>(value);
                return string.IsNullOrWhiteSpace(proxy) ? "system" : proxy;
            }
            catch (Exception)
            {
                return value.Trim('"');
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
                if (GetLocalProxy() == "system")
                {
                    request.Proxy = WebRequest.GetSystemWebProxy();
                    request.Proxy.Credentials = CredentialCache.DefaultCredentials;
                }
                else
                {
                    request.Proxy = null;
                }
                request.Method = data.Method;
                request.ContentLength = data.DataBytes.Length;
                request.SetHeaders(data.Headers);
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
                Logger.Logger.Error("HttpRequest Error: ", ex);
            }
            return ProxyResponseData.Empty;
        }
    }
}
