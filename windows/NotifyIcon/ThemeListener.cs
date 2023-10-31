using Microsoft.Win32;

namespace Musiche.NotifyIcon
{
    public static class ThemeListener
    {
        public delegate void ThemeChangedEventHandler(bool isDark);

        private static bool _dark;

        private const string REGISTRY_KEY_PATH = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";

        private const string APPS_USE_LIGHT_THEME = "AppsUseLightTheme";

        private const string SYSTEM_USERS_LIGHT_THEME = "SystemUsesLightTheme";

        public static bool IsDarkMode => _dark;

        public static event ThemeChangedEventHandler ThemeChanged;

        static ThemeListener()
        {
            SystemEvents.UserPreferenceChanged += UserPreferenceChanged;
            _dark = ReadDarkMode();
        }

        private static void UserPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
        {
            if (ReadDarkMode() != _dark)
            {
                _dark = !_dark;
                ThemeChanged?.Invoke(_dark);
            }
        }

        private static bool ReadDarkMode()
        {
            using (RegistryKey registryKey = Registry.CurrentUser.OpenSubKey(REGISTRY_KEY_PATH))
            {
                object obj = registryKey?.GetValue(APPS_USE_LIGHT_THEME);
                if (obj != null)
                {
                    return (int)obj <= 0;
                }
            }

            using (RegistryKey registryKey2 = Registry.LocalMachine.OpenSubKey(REGISTRY_KEY_PATH))
            {
                object obj = registryKey2?.GetValue(SYSTEM_USERS_LIGHT_THEME);
                if (obj != null)
                {
                    return (int)obj <= 0;
                }
            }

            return false;
        }
    }
}
