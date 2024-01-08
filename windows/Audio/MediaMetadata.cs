namespace Musiche.Audio
{
    public class MediaMetadata
    {
        public string Album { get; set; }
        public string Artist { get; set; }
        public string Title { get; set; }
        public MediaImage[] Artwork { get; set; }
    }

    public class MediaImage
    {
        public string Src { get; set; }
    }
}
