using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

namespace Musiche.Server
{
    public class ProxyResponseData
    {
        public byte[] Data { get; set; } = Array.Empty<byte>();
        public Stream Stream { get; set; } = null;
        public string ContentType { get; set; } = string.Empty;
        public int StatusCode { get; set; } = 200;
        public long ContentLength { get; set; } = 0;
        public string ContentEncoding { get; set; } = string.Empty;
        public string CharacterSet { get; set; } = string.Empty;
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();
        public ProxyResponseData(string data)
        {
            Data = Encoding.UTF8.GetBytes(data);
        }
        public ProxyResponseData(Dictionary<string, object> data)
        {
            Data = Encoding.UTF8.GetBytes(JsonConvert.SerializeObject(data));
        }
        public ProxyResponseData(byte[] data, int statusCode, string contentType, string contentEncoding, string characterSet, Dictionary<string, string> headers)
        {
            Data = data;
            StatusCode = statusCode;
            ContentType = contentType;
            ContentEncoding = contentEncoding;
            CharacterSet = characterSet;
            Headers = headers;
            ContentLength = data.Length;
        }
        public ProxyResponseData(Stream stream, long length, int statusCode, string contentType, string contentEncoding, string characterSet, Dictionary<string, string> headers)
        {
            Stream = stream;
            StatusCode = statusCode;
            ContentType = contentType;
            ContentEncoding = contentEncoding;
            CharacterSet = characterSet;
            Headers = headers;
            ContentLength = length;
        }
        private ProxyResponseData() { }

        public static readonly ProxyResponseData Empty = new ProxyResponseData();
    }
}
