using System.IO;

namespace Musiche.Utils
{
    public class IconFont
    {
        //private static readonly System.Drawing.Text.PrivateFontCollection privateFonts;
        public static readonly string IconFontPath = Path.Combine(Path.GetTempPath(), "music_he_icon", "music_he_icon_font.ttf");
        static IconFont()
        {
            //int length = Properties.Resources.iconfont.Length;
            //IntPtr ptrData = Marshal.AllocCoTaskMem(length);
            //Marshal.Copy(Properties.Resources.iconfont, 0, ptrData, length);
            //privateFonts = new System.Drawing.Text.PrivateFontCollection();
            //var a = new System.Windows.Media.FontFamily();
            //privateFonts.AddMemoryFont(ptrData, length);
            //Marshal.FreeCoTaskMem(ptrData);
            File.CreateDirectoryIFNotExists(Path.GetDirectoryName(IconFontPath));
            System.IO.File.WriteAllBytes(IconFontPath, Properties.Resources.iconfont);
        }
    }
}
