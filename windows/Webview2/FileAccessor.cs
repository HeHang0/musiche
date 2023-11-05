using Musiche.Audio;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;

namespace Musiche.Webview2
{
    public class FileAccessor
    {
        public FileAccessor()
        {
            //Utils.File.CreateDirectoryIFNotExists(Utils.File.StoragePath);
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

#pragma warning disable CS1998
        public async Task<string[]> ShowSelectedDirectory()
        {
            var dialog = new Microsoft.WindowsAPICodePack.Dialogs.CommonOpenFileDialog();
            dialog.IsFolderPicker = true;
            dialog.Multiselect = true;
            if (dialog.ShowDialog() == Microsoft.WindowsAPICodePack.Dialogs.CommonFileDialogResult.Ok)
            {
                return dialog.FileNames.ToArray();
            }
            return Array.Empty<string>();
        }

        public async Task<string[]> ListAllFiles(string filePath, bool recursive, bool onlyAudio = false)
        {
            return ListFilesRecursively(filePath, recursive, onlyAudio).ToArray();
        }

        public async Task<string> ListAllAudios(string filePath, bool recursive)
        {
            List<string> audioFiles = ListFilesRecursively(filePath, recursive, true);
            List<AudioTag> musicList = new List<AudioTag>();
            foreach (string audioFile in audioFiles)
            {
                musicList.Add(AudioTag.ReadTag(audioFile));
            }
            return "[" + string.Join(",", musicList.Select(m => m.ToString())) + "]";
        }

        public async Task<string> GetMyMusicDirectory()
        {
            return Environment.GetFolderPath(Environment.SpecialFolder.MyMusic);
        }

        private static readonly string[] AudioExtensions = new string[] { ".mp3", ".aiff", ".avi", ".mpg", ".mov", ".wav", ".flac", ".wma", ".ape", ".m4a" };
        private List<string> ListFilesRecursively(string filePath, bool recursive, bool onlyAudio)
        {
            List<string> pathList = new List<string>();
            if (!Directory.Exists(filePath)) return pathList;
            try
            {
                foreach (string fileName in Directory.GetFiles(filePath))
                {
                    if (!onlyAudio || AudioExtensions.Contains(Path.GetExtension(fileName)))
                    {
                        pathList.Add(fileName);
                    }
                }
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("ListFilesRecursively GetFiles Error: ", ex);
            }
            if (recursive)
            {
                try
                {
                    foreach (string directoryName in Directory.GetDirectories(filePath))
                    {
                        pathList.AddRange(ListFilesRecursively(directoryName, recursive, onlyAudio));
                    }
                }
                catch (Exception ex)
                {
                    Logger.Logger.Error("ListFilesRecursively GetDirectories Error: ", ex);
                }
            }
            return pathList;
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

        public async Task<bool> FileExists(string filePath)
        {
            try
            {
                return File.Exists(filePath);
            }
            catch (Exception)
            {
            }
            return false;
        }
#pragma warning restore CS1998
    }
}
