using System;
using System.IO;
using System.Threading.Tasks;

namespace Musiche.Webview2
{
    public class FileAccessor
    {
        public FileAccessor()
        {
            Utils.File.CreateDirectoryIFNotExists(Utils.File.StoragePath);
        }

#pragma warning disable CS1998
        public async Task<string> ReadFile(string filePath)
        {
            try
            {
#if NETFRAMEWORK
                return File.ReadAllText(Path.Combine(Utils.File.StoragePath, filePath));
#else
                return await File.ReadAllTextAsync(Path.Combine(Utils.File.StoragePath, filePath));
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
                File.WriteAllText(Path.Combine(Utils.File.StoragePath, filePath), text);
#else
                await File.WriteAllTextAsync(Path.Combine(Utils.File.StoragePath, filePath), text);
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
                File.Delete(Path.Combine(Utils.File.StoragePath, filePath));
            }
            catch (Exception)
            {
            }

            return Task.CompletedTask;
        }
#pragma warning restore CS1998
    }
}
