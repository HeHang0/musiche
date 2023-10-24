using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Musiche.Webview2
{
    public class FileAccessor
    {
        private string rootPath;
        public FileAccessor()
        {
            string roming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
            string appName = System.Reflection.Assembly.GetExecutingAssembly()?.GetName()?.Name?.ToString() ?? "Musiche";
            rootPath = Path.Combine(roming, appName, "storage");


            CreateDirectoryIFNotExists(rootPath);
        }

        private void CreateDirectoryIFNotExists(string path)
        {
            if (Directory.Exists(path))
            {
                return;
            }
            string parentDir = Path.GetDirectoryName(path) ?? string.Empty;
            CreateDirectoryIFNotExists(parentDir);
            Directory.CreateDirectory(path);
        }

#pragma warning disable CS1998
        public async Task<string> ReadFile(string filePath)
        {
            try
            {
#if NETFRAMEWORK
                return File.ReadAllText(Path.Combine(rootPath, filePath));
#else
                    return await File.ReadAllTextAsync(Path.Combine(rootPath, filePath));
#endif
            }
            catch (Exception)
            {
                return string.Empty;
            }
        }

        public async Task WriteFile(string filePath, string text)
        {
            try
            {
#if NETFRAMEWORK
                File.WriteAllText(Path.Combine(rootPath, filePath), text);
#else
                    await File.WriteAllTextAsync(Path.Combine(rootPath, filePath), text);
#endif
            }
            catch (Exception)
            {
            }
        }

        public Task DeleteFile(string filePath)
        {
            try
            {
                File.Delete(Path.Combine(rootPath, filePath));
            }
            catch (Exception)
            {
            }

            return Task.CompletedTask;
        }
#pragma warning restore CS1998
    }
}
