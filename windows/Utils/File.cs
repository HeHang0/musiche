using System;
using System.IO;

namespace Musiche.Utils
{
    public class File
    {
        public static readonly string Roming;
        public static readonly string AppName;
        public static readonly string DataPath;
        public static readonly string StoragePath;
        public static readonly string Webview2Path;

        static File()
        {
            Roming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            AppName = System.Reflection.Assembly.GetExecutingAssembly()?.GetName()?.Name?.ToString() ?? "Musiche";
            DataPath = Path.Combine(Roming, AppName, "Data");
            StoragePath = Path.Combine(DataPath, "Storage");
            Webview2Path = Path.Combine(DataPath, "Webview2");
        }

        public static void CreateDirectoryIFNotExists(string path)
        {
            if (Directory.Exists(path))
            {
                return;
            }
            string parentDir = Path.GetDirectoryName(path) ?? string.Empty;
            CreateDirectoryIFNotExists(parentDir);
            Directory.CreateDirectory(path);
        }
    }
}
