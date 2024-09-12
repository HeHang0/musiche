using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;

namespace Musiche.Server
{
    public static class HttpExtention
    {
        public static string DataAsString(this HttpListenerRequest request)
        {
            using (Stream body = request.InputStream)
            {
                using (StreamReader reader = new StreamReader(body, request.ContentEncoding))
                {
                    return reader.ReadToEnd();
                }
            }
        }
        public static string QueryGet(this HttpListenerRequest request, string name)
        {
            string[] queryGroup = request.Url.Query.TrimStart('?').Split('&');
            for (int i = 0; i < queryGroup.Length; i++)
            {
                if (queryGroup[i].ToLower().StartsWith(name.ToLower() + "="))
                {
                    string[] kv = queryGroup[i].Split('=');
                    if(kv.Length == 2)
                    {
                        return Uri.UnescapeDataString(kv[1]).Trim();
                    }
                }
            }
            return string.Empty;
        }

        public static void SetHeaders(this HttpWebRequest request, Dictionary<string, string> headers)
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

        public static void SetHeaders(this HttpListenerResponse response, Dictionary<string, string> headers)
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

        public static void ProcessCors(this HttpListenerResponse response)
        {
            response.AddHeader("Access-Control-Allow-Origin", "*");
            response.AddHeader("Access-Control-Allow-Headers", "*");
            response.AddHeader("Access-Control-Allow-Methods", "*");
            response.AddHeader("Access-Control-Expose-Headers", "*");
            response.AddHeader("Access-Control-Allow-Credentials", "true");
        }
    }
}
