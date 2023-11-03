using Newtonsoft.Json;
using System.Collections.Generic;
using System.Text;

namespace Musiche.Server
{
    public class ProxyRequestData
    {
        public string Url { get; set; } = string.Empty;
        public bool SetCookieRename { get; set; } = false;
        private string _method = "GET";
        public string Method
        {
            get { return _method; }
            set
            {
                if (string.IsNullOrWhiteSpace(value)) _method = "GET";
                else _method = value;
            }
        }
        public string Data { get; set; } = string.Empty;
        private byte[] _data = null;
        public byte[] DataBytes
        {
            get
            {
                if (_data == null) _data = Encoding.UTF8.GetBytes(Data);
                return _data;
            }
        }
        public bool HasBody => DataBytes.Length > 0;
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();
        public bool AllowAutoRedirect { get; set; } = true;

        public static ProxyRequestData Parse(string data)
        {
            if (data.StartsWith("http"))
            {
                return new ProxyRequestData() { Url = data };
            }
            try
            {
                return JsonConvert.DeserializeObject<ProxyRequestData>(data) ?? new ProxyRequestData();
            }
            catch (System.Exception)
            {
                Logger.Logger.Warning("ProxyRequestData Parse Error");
                return new ProxyRequestData();
            }
        }
    }
}
