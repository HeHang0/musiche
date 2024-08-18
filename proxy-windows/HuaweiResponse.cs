using System.Collections.Generic;

namespace ProxyServer
{
    public class HuaweiResponse
    {
        public int StatusCode { get; set; } = 200;
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();
        public string Body { get; set; } = string.Empty;
    }
}
