using System;
using System.Collections.Generic;
using System.Net;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public class HttpProxy
    {
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
                request.SetHeaders(data.Headers);
                request.AllowAutoRedirect = data.AllowAutoRedirect;
                if (data.HasBody)
                {
                    using (var stream = request.GetRequestStream())
                    {
                        request.ContentLength = data.DataBytes.Length;
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
