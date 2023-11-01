using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO.Compression;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public class FileHandler
    {
        readonly ConcurrentDictionary<string, byte[]> fileCache = new ConcurrentDictionary<string, byte[]>();
        public static readonly string IndexName = "index.html";
        public FileHandler()
        {
            ReadFile();
        }

        private void ReadFile()
        {
            try
            {
                using (MemoryStream zipToOpen = new MemoryStream(Properties.Resources.web))
                {
                    using (ZipArchive archive = new ZipArchive(zipToOpen, ZipArchiveMode.Read))
                    {
                        foreach (ZipArchiveEntry entry in archive.Entries)
                        {
                            using (MemoryStream reader = new MemoryStream())
                            {
                                using (Stream entryStream = entry.Open())
                                {
                                    entryStream.CopyTo(reader);
                                    fileCache.TryAdd(entry.FullName.TrimStart('/'), reader.ToArray());
                                }
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Read web file error: ", ex);
            }
        }

        public byte[] GetFile(string filePath)
        {
            string realPath = filePath.TrimStart('/');
            if (string.IsNullOrWhiteSpace(realPath))
            {
                realPath = IndexName;
            }
            fileCache.TryGetValue(realPath, out byte[] result);
            return result;
        }

        public string GetMimeType(string filePath)
        {
            switch(Path.GetExtension(filePath))
            {
                case ".html":
                    return "text/html";
                case ".js":
                    return "application/javascript; charset=utf-8";
                case ".css":
                    return "text/css; charset=utf-8";
                case ".woff":
                    return "font/woff2";
                case ".png":
                    return "image/png";
                case ".jpg":
                    return "image/jpg";
                case ".webp":
                    return "image/webp";
            }
            return "text/html";
        }
    }
}
