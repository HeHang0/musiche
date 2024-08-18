using Newtonsoft.Json;
using System;
using System.IO;

namespace ProxyServer
{
    public class Settings
    {
        public CacheStrategy JsonStrategy { get; set; } = CacheStrategy.Always;
        public CacheStrategy ImageStrategy { get; set; } = CacheStrategy.Always;
        public CacheStrategy FileStrategy { get; set; } = CacheStrategy.Always;
        public CacheStrategy OtherStrategy { get; set; } = CacheStrategy.Always;
        public int HttpPort { get; set; } = 8080;
        public string ProxyAddress { get; set; } = string.Empty;
        public bool ProxyAddressEnable { get; set; } = false;

        public static readonly string SettingFolder;
        public static readonly string CacheFolder;
        private static readonly string _loadPath;
        private static readonly Settings _settings;
        static Settings()
        {
            string roming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appName = System.Reflection.Assembly.GetExecutingAssembly()?.GetName()?.Name?.ToString() ?? "ProxyServer";
            string dataPath = Path.Combine(roming, appName);
            string cachePath = Path.Combine(roming, appName, "Cache");
            SettingFolder = dataPath;
            if (!Directory.Exists(dataPath)) Directory.CreateDirectory(dataPath);
            if (!Directory.Exists(cachePath)) Directory.CreateDirectory(cachePath);
            CacheFolder = cachePath;
            _loadPath = Path.Combine(dataPath, "proxy.server.config.json");
            try
            {
                _settings = JsonConvert.DeserializeObject<Settings>(File.ReadAllText(_loadPath));
            }
            catch (Exception)
            {
            }
            if (_settings == null) _settings = new Settings();
        }

        private Settings() { }

        public static Settings Load()
        {
            return _settings;
        }

        public override string ToString()
        {
            try
            {

                return JsonConvert.SerializeObject(this);
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }

        public void Save()
        {
            File.WriteAllText(_loadPath, ToString());
        }
    }
}
