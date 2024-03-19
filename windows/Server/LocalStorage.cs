using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public class LocalStorage
    {
        private readonly string _filePath;
        private readonly Dictionary<string, string> _data;
        private long _lastSaveTime = 0;
        private readonly object _timeLock = new object();
        private CancellationTokenSource _saveCancel = null;
        public LocalStorage(string filePath)
        {
            _filePath = filePath;
            try
            {
                _data = JsonConvert.DeserializeObject<Dictionary<string, string>>(File.ReadAllText(filePath));
            }
            catch (Exception)
            {
                _data = new Dictionary<string, string>();
            }
        }

        public string GetAll()
        {
            lock (_data)
            {
                return JsonConvert.SerializeObject(_data);
            }
        }

        public string Get(string key)
        {
            lock (_data)
            {
                return _data.ContainsKey(key) ? _data[key] : string.Empty;
            }
        }

        public void Set(string key, string value)
        {
            lock (_data)
            {
                _data[key] = value;
            }
            Save();
        }

        public void Remove(string key)
        {
            lock (_data)
            {
                _data.Remove(key);
            }
            Save();
        }

        public void Save()
        {
            _saveCancel?.Cancel();
            _saveCancel = new CancellationTokenSource();
            bool saveNow = false;
            lock (_timeLock)
            {
                saveNow = (DateTimeOffset.Now.ToUnixTimeMilliseconds() - _lastSaveTime) > 5;
            }
            if (saveNow)
            {
                SaveToFile(null);
            }
            else
            {
                Task.Delay(5000, _saveCancel.Token).ContinueWith(SaveToFile);
            }
        }

        public void SaveToFile(Task sender)
        {
            lock (_timeLock)
            {
                _lastSaveTime = DateTimeOffset.Now.ToUnixTimeMilliseconds();
            }
            lock (_data)
            {
                try
                {
                    File.WriteAllText(_filePath, JsonConvert.SerializeObject(_data));
                }
                catch (Exception ex)
                {
                    Logger.Logger.Error("Save local storage error", ex);
                }
            }
        }
    }
}
