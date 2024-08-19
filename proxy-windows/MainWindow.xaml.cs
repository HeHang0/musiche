using PicaPico;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using Wpf.Ui.Appearance;
using Wpf.Ui.Controls;

namespace ProxyServer
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : FluentWindow
    {
        Settings _settings;
        WebServer _server = new WebServer();
        public MainWindow()
        {
            _settings = Settings.Load();
            InitializeComponent();
            InitWindowBackdropType();
            Closing += MainWindow_Closing;
            InitData();
            StartServer();
        }

        private void InitData()
        {
            InitStrategy();
            HttpPortTextBox.Text = _settings.HttpPort.ToString();
            ProxyAddressTextBox.Text = _settings.ProxyAddress;
            ProxyAddressSwitch.IsChecked = _settings.ProxyAddressEnable;
            HttpAddressTextBox.Text = $"http://{WebServer.ListeningIP}:";
        }

        private void InitStrategy()
        {
            List<KeyValuePair<CacheStrategy, string>> modes = new List<KeyValuePair<CacheStrategy, string>>
            {
                new KeyValuePair<CacheStrategy, string>(CacheStrategy.None, "不缓存"),
                new KeyValuePair<CacheStrategy, string>(CacheStrategy.Day, "一天"),
                new KeyValuePair<CacheStrategy, string>(CacheStrategy.Week, "一周"),
                new KeyValuePair<CacheStrategy, string>(CacheStrategy.Always, "永久"),
            };
            ComboBox[] comboBoxes = new ComboBox[] { JsonStrategy, ImageStrategy, FileStrategy, OtherStrategy };
            foreach (var item in comboBoxes)
            {
                item.ItemsSource = modes;
                item.SelectedValuePath = "Key";
                item.DisplayMemberPath = "Value";
            }
            JsonStrategy.SelectedValue = _settings.JsonStrategy;
            ImageStrategy.SelectedValue = _settings.ImageStrategy;
            FileStrategy.SelectedValue = _settings.FileStrategy;
            OtherStrategy.SelectedValue = _settings.OtherStrategy;
        }

        private void StartServer(object sender, RoutedEventArgs e)
        {
            StartServer();
        }

        private void StartServer()
        {
            bool started = _server.IsListening;
            if (started)
            {
                _server.Stop();
                StartServerButton.Content = "启动";
                StartServerButton.Appearance = ControlAppearance.Primary;
            }
            else
            {
                StartServerButton.Content = "停止";
                StartServerButton.Appearance = ControlAppearance.Caution;
                _server.Start(_settings.HttpPort, _settings.ProxyAddressEnable ? _settings.ProxyAddress : string.Empty);
                _settings.Save();
            }
            HttpPortTextBox.IsReadOnly = !started;
            ProxyAddressTextBox.IsReadOnly = !started;
            ProxyAddressSwitch.IsEnabled = started;
        }

        private void OnPortPreviewTextInput(object sender, TextCompositionEventArgs e)
        {
            e.Handled = new Regex("[^0-9]+").IsMatch(e.Text);
        }

        private void OnProxyAddressChanged(object sender, TextChangedEventArgs e)
        {
            _settings.ProxyAddress = ProxyAddressTextBox.Text.Trim();
        }

        private void OnHttpPortChanged(object sender, TextChangedEventArgs e)
        {
            _ = int.TryParse(HttpPortTextBox.Text, out int httpPort);
            if(httpPort > 0 && httpPort < 65535)
            {
                _settings.HttpPort = httpPort;
            }
        }

        private void OnProxyAddressSwitchChanged(object sender, RoutedEventArgs e)
        {
            _settings.ProxyAddressEnable = ProxyAddressSwitch.IsChecked ?? false;
        }

        private void OnStrategySelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if(!(sender is ComboBox))
            {
                return;
            }
            ComboBox comboBox = sender as ComboBox;
            switch(comboBox.Name)
            {
                case nameof(JsonStrategy):
                    _settings.JsonStrategy = (CacheStrategy)comboBox.SelectedValue;
                    break;
                case nameof(ImageStrategy):
                    _settings.ImageStrategy = (CacheStrategy)comboBox.SelectedValue;
                    break;
                case nameof(FileStrategy):
                    _settings.FileStrategy = (CacheStrategy)comboBox.SelectedValue;
                    break;
                case nameof(OtherStrategy):
                    _settings.OtherStrategy = (CacheStrategy)comboBox.SelectedValue;
                    break;
            }
            _settings.Save();
        }

        private void Exit(object sender, RoutedEventArgs e)
        {
            Application.Current.Shutdown();
        }

        private void InitWindowBackdropType()
        {
            if (IsMicaTabbedSupported)
            {
                WindowBackdropType = WindowBackdropType.Tabbed;
            }
            else if (IsMicaSupported)
            {
                WindowBackdropType = WindowBackdropType.Mica;
            }
            else if (IsAcrylicSupported)
            {
                WindowStyle = WindowStyle.None;
                AllowsTransparency = true;
                DragHelper.Visibility = Visibility.Visible;
                WindowBackdropType = WindowBackdropType.Acrylic;
                DragHelper.PreviewMouseLeftButtonDown += DragWindow;
                Activated += WindowActivated;
                Deactivated += WindowDeactivated;
            }
            else
            {
                WindowBackdropType = WindowBackdropType.Auto;
            }
            ThemeListener.ThemeChanged += ApplyTheme;
            ApplyTheme(ThemeListener.IsDarkMode);
            System.Drawing.Icon appIcon = System.Drawing.Icon.ExtractAssociatedIcon(GetExePath());
            Icon = Imaging.CreateBitmapSourceFromHIcon(
                        appIcon.Handle,
                        Int32Rect.Empty,
                        BitmapSizeOptions.FromEmptyOptions());
            TitleBarIcon.Source = Icon;
        }

        string GetExePath()
        {
            Process currentProcess = Process.GetCurrentProcess();
            return currentProcess.MainModule?.FileName ?? string.Empty;
        }

        private void MainWindow_Closing(object sender, CancelEventArgs e)
        {
            e.Cancel = true;
            Hide();
        }

        private void ApplyTheme(bool isDark)
        {
            ApplicationThemeManager.Apply(
              isDark ? ApplicationTheme.Dark : ApplicationTheme.Light,
              WindowBackdropType,
              true
            );
            if (WindowBackdropType == WindowBackdropType.Acrylic)
            {
                if (IsActive) WindowActivated(null, null);
                else WindowDeactivated(null, null);
            }
            else
            {
                WinBackground.Background = Brushes.Transparent;
            }
        }

        private void DragWindow(object sender, System.Windows.Input.MouseButtonEventArgs e)
        {
            if (WindowStyle == WindowStyle.None)
            {
                DragMove();
            }
        }

        private readonly Brush _blackBackgroundA = new SolidColorBrush(Color.FromArgb(0xA0, 0x1F, 0x1F, 0x1F));
        private readonly Brush _whiteBackgroundA = new SolidColorBrush(Color.FromArgb(0xA0, 0xFF, 0xFF, 0xFF));
        private readonly Brush _blackBackground = new SolidColorBrush(Color.FromRgb(0x1F, 0x1F, 0x1F));
        private readonly Brush _whiteBackground = new SolidColorBrush(Color.FromRgb(0xFF, 0xFF, 0xFF));

        private void WindowActivated(object sender, EventArgs e)
        {
            WinBackground.Background = ThemeListener.IsDarkMode ? _blackBackgroundA : _whiteBackgroundA;
        }

        private void WindowDeactivated(object sender, EventArgs e)
        {
            WinBackground.Background = ThemeListener.IsDarkMode ? _blackBackground : _whiteBackground;
        }

        public static bool IsAcrylicSupported => IsWindowsNT && OSVersion >= new Version(10, 0) && OSVersion < new Version(10, 0, 22523);

        public static bool IsMicaSupported => IsWindowsNT && OSVersion >= new Version(10, 0, 21996);

        public static bool IsMicaTabbedSupported => IsWindowsNT && OSVersion >= new Version(10, 0, 22523);

        public static bool IsWindowsNT => Environment.OSVersion.Platform == PlatformID.Win32NT;

        private static readonly Version _osVersion = GetOSVersion();

        public static Version OSVersion => _osVersion;

        private static Version GetOSVersion()
        {
            var osv = new RTL_OSVERSIONINFOEX();
            osv.dwOSVersionInfoSize = (uint)Marshal.SizeOf(osv);
            _ = RtlGetVersion(out osv);
            return new Version((int)osv.dwMajorVersion, (int)osv.dwMinorVersion, (int)osv.dwBuildNumber);
        }

        [DllImport("ntdll.dll")]
        private static extern int RtlGetVersion(out RTL_OSVERSIONINFOEX lpVersionInformation);

        [StructLayout(LayoutKind.Sequential)]
        private struct RTL_OSVERSIONINFOEX
        {
            internal uint dwOSVersionInfoSize;
            internal uint dwMajorVersion;
            internal uint dwMinorVersion;
            internal uint dwBuildNumber;
            internal uint dwPlatformId;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
            internal string szCSDVersion;
        }
    }
}
