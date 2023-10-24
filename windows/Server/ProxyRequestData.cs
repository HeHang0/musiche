using Newtonsoft.Json;
using System.Collections.Generic;

namespace Musiche.Server
{
    public class ProxyRequestData
    {
        public string Url { get; set; } = string.Empty;
        public string Method { get; set; } = "GET";
        public string Data { get; set; } = string.Empty;
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();

        public static ProxyRequestData Parse(string data)
        {
            return JsonConvert.DeserializeObject<ProxyRequestData>(data) ?? new ProxyRequestData();
        }
    }
}
