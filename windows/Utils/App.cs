namespace Musiche.Utils
{
    public class App
    {
        public static readonly string Version;
        static App()
        {
            Version = System.Diagnostics.FileVersionInfo.GetVersionInfo(System.Reflection.Assembly.GetEntryAssembly().Location)?.ProductVersion ?? string.Empty;
        }
    }
}
