using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using System;
using System.IO;

namespace Musiche.Audio
{
    public class AudioTag
    {
        public string Id { get; set; }
        public string Name { get; set; }
        public string Singer { get; set; } = string.Empty;
        public string Album { get; set; } = string.Empty;
        public int Length { get; set; } = 0;
        public string Duration { get; set; } = string.Empty;
        public string Url { get; set; }
        private byte[] _picture = null;
        private string _pictureType = string.Empty;
        private AudioTag(string audioFile)
        {
            Id = audioFile;
            Name = Path.GetFileNameWithoutExtension(audioFile);
            Url = audioFile;
        }

        private void SetPicture(byte[] data, string mime)
        {
            _picture = data;
            _pictureType = mime;
        }

        public byte[] GetPicture()
        {
            return _picture;
        }

        public string GetPictureType()
        {
            return _pictureType;
        }

        public static AudioTag ReadTag(string audioFile, bool picture=false)
        {
            AudioTag audioTag = new AudioTag(audioFile);
            try
            {
#if DEBUG
#else
                //TagLib.File tagFile = TagLib.File.Create(audioFile);
                //audioTag.Name = tagFile.Tag.Title;
                //audioTag.Singer = tagFile.Tag.JoinedAlbumArtists;
                //audioTag.Album = tagFile.Tag.Album;
                //audioTag.Length = (int)Math.Floor(tagFile.Properties.Duration.TotalMilliseconds);
                //audioTag.Duration = tagFile.Properties.Duration.ToString("mm\\:ss");
                //if (picture && tagFile.Tag.Pictures.Length > 0)
                //{
                //    audioTag.SetPicture(tagFile.Tag.Pictures[0].Data.Data, tagFile.Tag.Pictures[0].MimeType);
                //}
#endif
            }
            catch (Exception ex)
            {
                Logger.Logger.Warning("Parse tag error", ex);
            }
            return audioTag;
        }

        public class LowercaseContractResolver : DefaultContractResolver
        {
            protected override string ResolvePropertyName(string propertyName)
            {
                return propertyName.ToLower();
            }
        }

        public override string ToString()
        {
            return JsonConvert.SerializeObject(this, new JsonSerializerSettings
            {
                ContractResolver = new LowercaseContractResolver(),
                Formatting = Formatting.None
            });
        }
    }
}
