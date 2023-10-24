using Musiche.Audio;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO.Compression;
using System.IO;
using System.Net;
using System.Reflection;
using System.Security.Policy;
using System.Text;
using System.Threading.Tasks;
using System.Windows;

namespace Musiche.Server
{
    public class HttpHandler: Handler, IHandler
    {
        private readonly Dictionary<string, MethodInfo> routers;
        public HttpHandler(Window window, AudioPlay audioPlay):base(window, audioPlay)
        {
            routers = Utils.ReadRouter(this);
        }

        static HttpHandler()
        {
            ServicePointManager.ServerCertificateValidationCallback +=
            (sender, certificate, chain, sslPolicyErrors) => true;
        }

        [Router("*")]
        public async Task ClipboardIndex(HttpListenerContext ctx)
        {
            await SendString(ctx, "哈哈哈", "text/html");
        }

        [Router("/title")]
        public async Task SetTitle(HttpListenerContext ctx)
        {
            string title = ctx.Request.DataAsString();
            window.Dispatcher.Invoke(() =>
            {
                window.Title = title;
            });
            await SendString(ctx, "");
        }

        [Router("/play")]
        public async Task Play(HttpListenerContext ctx)
        {
            var url = ctx.Request.DataAsString();
            await audioPlay.Dispatcher.InvokeAsync(() =>
            {
                audioPlay.Play(url);
            });
            await SendStatus(ctx);
        }

        [Router("/pause")]
        public async Task Pause(HttpListenerContext ctx)
        {
            await audioPlay.Dispatcher.InvokeAsync(() =>
            {
                audioPlay.Pause();
            });
            await SendStatus(ctx);
        }

        [Router("/progress")]
        public async Task SetProgress(HttpListenerContext ctx)
        {
            if (int.TryParse(ctx.Request.DataAsString(), out int progress))
            {
                await audioPlay.Dispatcher.InvokeAsync(() =>
                {
                    audioPlay.Progress = progress;
                });
            }
            await SendStatus(ctx);
        }

        [Router("/volume")]
        public async Task SetVolume(HttpListenerContext ctx)
        {
            if (int.TryParse(ctx.Request.DataAsString(), out int volume))
            {
                await audioPlay.Dispatcher.InvokeAsync(() =>
                {
                    audioPlay.Volume = volume;
                });
            }
            await SendStatus(ctx);
        }

        [Router("/status")]
        public async Task Status(HttpListenerContext ctx)
        {
            await SendStatus(ctx);
        }

        [Router("/window")]
        public async Task WindowInfo(HttpListenerContext ctx)
        {
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/maximize")]
        public async Task SetMaximize(HttpListenerContext ctx)
        {
            bool maximized = ctx.Request.DataAsString() == "1";
            window.Dispatcher.Invoke(() =>
            {
                window.WindowState = maximized ? WindowState.Maximized : WindowState.Normal;
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/minimize")]
        public async Task SetMinimize(HttpListenerContext ctx)
        {
            window.Dispatcher.Invoke(() =>
            {
                window.WindowState = WindowState.Minimized;
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/close")]
        public async Task SetClose(HttpListenerContext ctx)
        {
            window.Dispatcher.Invoke(() =>
            {
                window.Close();
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        private string GetWindowInfoText()
        {
            Dictionary<string, object> data = new Dictionary<string, object>();
            window.Dispatcher.Invoke(() =>
            {
                data.Add("width", window.ActualWidth);
                data.Add("height", window.ActualHeight);
                data.Add("x", window.Left);
                data.Add("y", window.Top);
                data.Add("maximized", window.WindowState == WindowState.Maximized);
                data.Add("minimize", window.WindowState == WindowState.Minimized);
            });
            Dictionary<string, object> result = new Dictionary<string, object>()
            {
                { "data",  data},
                { "type",  "window"}
            };
            string text = JsonConvert.SerializeObject(result);
            return text;
        }

        [Router("/proxy")]
        public static async Task Proxy(HttpListenerContext ctx)
        {
            ProxyResponseData proxyResData;
            string queryUrl = ctx.Request.QueryString["url"] ?? string.Empty;
            DateTime now = DateTime.Now;
            if (string.IsNullOrWhiteSpace(queryUrl))
            {
                var proxyData = ProxyRequestData.Parse(ctx.Request.DataAsString());
                queryUrl = proxyData.Url;
                Logger.Logger.Info("HttpProxy", proxyData.Method, queryUrl);
                proxyResData = await HttpRequest(proxyData.Url, proxyData.Method, proxyData.Data, proxyData.Headers);
            }
            else
            {
                Logger.Logger.Info("HttpProxy", "GET", queryUrl);
                proxyResData = await HttpRequest(queryUrl, "GET", "", new Dictionary<string, string>());
            }

            Logger.Logger.Info("HttpProxy", queryUrl, (DateTime.Now - now).TotalSeconds + "s", proxyResData.Data.Length, proxyResData.ContentLength);
            ctx.Response.SetHeaders(proxyResData.Headers);
            ctx.Response.StatusCode = proxyResData.StatusCode;
            ctx.Response.ContentType = proxyResData.ContentType;
            if(proxyResData.Stream != null)
            {
                await WriteResponse(ctx, proxyResData.Stream, proxyResData.ContentLength);
            }
            else
            {
                await WriteResponse(ctx, proxyResData.Data);
            }
            return;
        }

        private async Task SendStatus(HttpListenerContext ctx)
        {
            string text = JsonConvert.SerializeObject(await GetStatus());
            await SendString(ctx, text, "text/json");
        }

        private static async Task SendString(HttpListenerContext ctx, string msg, string contentType = "text/plain;charset=utf-8", HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            ctx.Response.StatusCode = (int)statusCode;
            ctx.Response.ContentType = contentType;
            await WriteResponse(ctx, msg);
            return;
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
                Logger.Logger.Error("Send Response Error: ", ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, Stream stream, long length)
        {
            try
            {
                if(length > 0)
                {
                    ctx.Response.ContentLength64 = length;
                }
                Logger.Logger.Info("ready write response stram", (DateTime.Now.ToUniversalTime().Ticks - 621355968000000000) / 10000);
                await stream.CopyToAsync(ctx.Response.OutputStream);
                Logger.Logger.Info("write response stream end", (DateTime.Now.ToUniversalTime().Ticks - 621355968000000000) / 10000);
                stream.Close();
                return true;
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Send Response Stream Error: ", ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, string message)
        {
            var data = Encoding.UTF8.GetBytes(message);
            return await WriteResponse(ctx, data);
        }

        public static async Task<ProxyResponseData> HttpRequest(string url, string method, string body, Dictionary<string, string> headers)
        {
            try
            {
#pragma warning disable SYSLIB0014
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(url);
#pragma warning restore SYSLIB0014
                request.Method = method;
                request.SetHeaders(headers);
                if (!string.IsNullOrEmpty(body))
                {
                    var data = Encoding.UTF8.GetBytes(body);
                    request.ContentLength = data.Length;
                    using (var stream = request.GetRequestStream())
                    {
                        stream.Write(data, 0, data.Length);
                    }
                }

                HttpWebResponse response = (HttpWebResponse)await request.GetResponseAsync();
                Dictionary<string, string> resHeaders = new Dictionary<string, string>();
                foreach (string item in response.Headers.AllKeys)
                {
                    resHeaders.Add(item, response.Headers.Get(item) ?? string.Empty);
                }

                return new ProxyResponseData(
                    response.GetResponseStream(),
                    response.ContentLength,
                    (int)response.StatusCode,
                    response.ContentType,
                    response.ContentEncoding ?? string.Empty,
                    response.CharacterSet ?? string.Empty,
                    resHeaders);
                //using (Stream responseStream = response.GetResponseStream())
                //{

                //    if (response.ContentEncoding?.ToLower() == "gzip")
                //    {
                //        using (Stream gzipStream = new GZipStream(responseStream, CompressionMode.Decompress))
                //        {
                //            return new ProxyResponseData(
                //                Utils.StreamToBytes(gzipStream),
                //                (int)response.StatusCode,
                //                response.ContentType,
                //                response.ContentEncoding,
                //                response.CharacterSet ?? string.Empty,
                //                resHeaders);
                //        }
                //    }
                //    else
                //    {
                //        return new ProxyResponseData(
                //            responseStream,
                //            response.ContentLength,
                //            (int)response.StatusCode,
                //            response.ContentType,
                //            response.ContentEncoding ?? string.Empty,
                //            response.CharacterSet ?? string.Empty,
                //            resHeaders);
                //    }
                //}
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("HttpRequest Error: ", ex);
            }
            return ProxyResponseData.Empty;
        }

        public async Task Handle(HttpListenerContext context)
        {
            if (context.Request.HttpMethod.ToUpper() == "OPTIONS")
            {
                context.Response.Close();
                return;
            }
            HttpListenerResponse response = context.Response;
            string router = context.Request.Url?.LocalPath.TrimEnd('/') ?? "*";
            routers.TryGetValue(router, out MethodInfo methodInfo);
            if (methodInfo == null)
            {
                methodInfo = routers["*"];
            }
            try
            {
                if (methodInfo.Invoke(this, new object[] { context }) is Task task) await task;
                response.Close();
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Handle Http Error: ", ex);
            }
        }
    }
}
