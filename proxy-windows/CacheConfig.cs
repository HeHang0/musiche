using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace ProxyServer
{
    public class CacheConfig
    {
        public string FileName { get; set; }
        public string FullPath => Path.Combine(Settings.CacheFolder, FileName);
        public string FullPathConf => Path.Combine(Settings.CacheFolder, FileName + ".conf");
        public int StatusCode { get; set; }
        public Dictionary<string, string> Headers { get; set; } = new Dictionary<string, string>();

        public static CacheConfig GetCache(string name)
        {
            string configPath = Path.Combine(Settings.CacheFolder, name + ".conf");
            if (!File.Exists(configPath))
            {
                return null;
            }
            CacheConfig cacheConfig = JsonConvert.DeserializeObject<CacheConfig>(File.ReadAllText(configPath));
            if(File.Exists(cacheConfig.FullPath))
            {
                return cacheConfig;
            }
            return null;
        }

        public static string GetName(string url, byte[] body)
        {
            return GetMd5Hash(url, body);
        }

        public static string GetFullPath(string name)
        {
            return Path.Combine(Settings.CacheFolder, name);
        }

        public static void Save(string cacheName, int status, Dictionary<string, string> headers, byte[] data)
        {
            Save(cacheName, status, headers);
            Save(cacheName, data);
            File.WriteAllBytes(GetFullPath(cacheName), data);
        }

        public static void Save(string cacheName, int status, Dictionary<string, string> headers)
        {
            CacheConfig cacheConfig = new CacheConfig();
            cacheConfig.FileName = cacheName;
            cacheConfig.StatusCode = status;
            cacheConfig.Headers = headers;
            File.WriteAllText(cacheConfig.FullPathConf, JsonConvert.SerializeObject(cacheConfig));
        }

        public static void Save(string cacheName, byte[] data, bool append=false)
        {
            string filePath = GetFullPath(cacheName);
            if(append)
            {
                using (FileStream fileStream = new FileStream(filePath, FileMode.Append, FileAccess.Write))
                {
                    fileStream.Write(data, 0, data.Length);
                }
            }
            else
            {
                File.WriteAllBytes(filePath, data);
            }
        }

        static string GetMd5Hash(string input, byte[] body)
        {
            using (MD5 md5 = MD5.Create())
            {
                byte[] inputBytes;
                if(body.Length > 0)
                {
                    inputBytes = body;
                }
                else
                {
                    inputBytes = Encoding.UTF8.GetBytes(input);
                }
                byte[] hashBytes = md5.ComputeHash(inputBytes);
                StringBuilder sb = new StringBuilder();
                for (int i = 0; i < hashBytes.Length; i++)
                {
                    sb.Append(hashBytes[i].ToString("X2"));
                }
                return sb.ToString();
            }
        }
    }
}
