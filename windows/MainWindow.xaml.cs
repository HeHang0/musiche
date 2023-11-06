using Microsoft.Web.WebView2.Core;
using Musiche.Audio;
using Musiche.NotifyIcon;
using Musiche.Server;
using Musiche.Webview2;
using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;

namespace Musiche
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        //readonly Webview2Control webview2;
        readonly AudioPlay audioPlay;
        readonly TaskbarInfo taskbarInfo;
        WebServer webServer;
        readonly WebSocketHandler webSocketHandler;
        readonly HttpHandler httpHandler;
        readonly NotifyIconInfo notifyIcon;
        Stream logStream = null;
        Hotkey.Hotkey hotkey = null;
        public MainWindow()
        {
            InitializeComponent();
            audioPlay = new AudioPlay();
            InitWebview2();
            WindowState = WindowState.Minimized;
            webSocketHandler = new WebSocketHandler(this, audioPlay);
            httpHandler = new HttpHandler(this, audioPlay);
            StateChanged += MainWindow_StateChanged;
            Closing += MainWindow_Closing;
            SourceInitialized += MainWindow_SourceInitialized;
            audioPlay.PlatStateChanged += AudioPlay_PlatStateChanged;
            taskbarInfo = new TaskbarInfo(webSocketHandler);
            notifyIcon = new NotifyIconInfo(webSocketHandler, ShowApp, ExitApp);
            TaskbarItemInfo = taskbarInfo.TaskbarItemInfo;
        }

        private void AudioPlay_PlatStateChanged(object sender, NAudio.Wave.PlaybackState state)
        {
            bool playing = state == NAudio.Wave.PlaybackState.Playing;
            notifyIcon?.AudioPlayStateChanged(playing);
            taskbarInfo?.AudioPlayStateChanged(playing);
        }

        private void MainWindow_SourceInitialized(object sender, EventArgs e)
        {
            hotkey = new Hotkey.Hotkey(webSocketHandler);
#if DEBUG
            webServer = new WebServer(54621);
            webview2.Control.Source = new Uri("http://127.0.0.1:5173");
            string exeDirectory = Path.GetDirectoryName(System.Reflection.Assembly.GetEntryAssembly().Location);
            logStream = System.IO.File.Open(Path.Combine(exeDirectory, "log." + DateTime.Now.ToString("yyyy-MM-dd") + ".log"), FileMode.Append);
#else
            int port = GetAvailablePort();
            webServer = new WebServer(port);
            webview2.Control.Source = new Uri("http://localhost:"+port);
#endif
            webServer.ClientConnected += WebServer_ClientConnected;
            webServer.Start();
        }

        public string RegisterHotkey(Hotkey.ShortcutKey shortcutKey)
        {
            return hotkey?.Register(shortcutKey) ?? string.Empty;
        }

        public bool RemoveHotkey(string shortcutType)
        {
            return hotkey?.Remove(shortcutType) ?? false;
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"close\"}");
        }

        private async void WebServer_ClientConnected(object sender, System.Net.HttpListenerContext context)
        {
            Logger.Logger.Info("Receive Connection", context.Request.HttpMethod, context.Request.RawUrl);
            if (context.Request.IsWebSocketRequest)
            {
                webSocketHandler?.Handle(context);
            }
            else
            {
                await httpHandler?.Handle(context);
            }
        }

        private void MainWindow_StateChanged(object sender, EventArgs e)
        {
            if (WindowState == WindowState.Maximized)
            {
                MinHeight = 0;
                MinWidth = 0;
            }
            else
            {
                MinHeight = 750;
                MinWidth = 1055;
            }
            webSocketHandler.SendMessage($"{{\"type\": \"maximized\",\"data\": {(WindowState == WindowState.Maximized ? "true" : "false")}}}");
        }

        private void InitWebview2()
        {
            if (Webview2Control.Available)
            {
                //Content = webview2;
                //Hide();
                webview2.CoreWebView2DOMContentLoaded += Webview2_CoreWebView2DOMContentLoaded;
            }
            else
            {
                MessageBox.Show("调用Webview2失败");
                Application.Current.Shutdown();
            }
        }

        private void Webview2_CoreWebView2DOMContentLoaded(object sender, Microsoft.Web.WebView2.Core.CoreWebView2DOMContentLoadedEventArgs e)
        {
            webview2.CoreWebView2DOMContentLoaded -= Webview2_CoreWebView2DOMContentLoaded;
            Left = (SystemParameters.PrimaryScreenWidth / 2) - (ActualWidth / 2);
            Top = (SystemParameters.PrimaryScreenHeight / 2) - (ActualHeight / 2);
            WindowState = WindowState.Normal;
        }

        private CancellationTokenSource deleyExitTaskCancel = null;
        private bool delayExitShutdown = false;
        public void DelayExit(int minute, bool shutdown)
        {
            delayExitShutdown = shutdown;
            deleyExitTaskCancel?.Cancel();
            deleyExitTaskCancel?.Dispose();
            deleyExitTaskCancel = null;
            if (minute > 0)
            {
                deleyExitTaskCancel = new CancellationTokenSource();
                Task.Delay(minute * 60 * 1000, deleyExitTaskCancel.Token).ContinueWith(ExitOnDelay);
            }
        }

        private void ExitOnDelay(Task sender)
        {
            if (sender.IsCanceled) return;
            Dispatcher.Invoke(() =>
            {
                try
                {
                    if (delayExitShutdown) Process.Start(new ProcessStartInfo("shutdown", "/s /t 30") { UseShellExecute = true });
                }
                catch (Exception ex)
                {
                    Logger.Logger.Error("Shutdown Error: ", ex);
                }
                ExitApp(null, null);
            });
        }

        private static int GetAvailablePort()
        {
            TcpListener listener = new TcpListener(IPAddress.Loopback, 0);
            listener.Start();
            int port = ((IPEndPoint)listener.LocalEndpoint).Port;
            listener.Stop();
            return port;
        }

        public void ShowApp(object sender, EventArgs e)
        {
            Show();
            if (WindowState == WindowState.Minimized)
            {
                WindowState = WindowState.Normal;
            }
            Activate();
        }

        public void ExitApp(object sender, EventArgs e)
        {
            hotkey?.Clear();
            logStream?.Close();
            notifyIcon?.Dispose();
            Application.Current.Shutdown();
        }

        public void SetMusicLoopType(string loopType)
        {
            notifyIcon.SetMusicLoopType(loopType);
        }

        public void SetTitle(string title)
        {
            Title = title;
            notifyIcon.SetTitle(title);
        }

        public void SetTheme(int preferredColorSchemeNumber)
        {
            var preferredColorScheme = CoreWebView2PreferredColorScheme.Auto;
            var dark = ThemeListener.IsDarkMode;
            if (Enum.IsDefined(typeof(CoreWebView2PreferredColorScheme), preferredColorSchemeNumber))
            {
                preferredColorScheme = (CoreWebView2PreferredColorScheme)Enum.ToObject(typeof(CoreWebView2PreferredColorScheme), preferredColorSchemeNumber);
                dark = preferredColorScheme == CoreWebView2PreferredColorScheme.Dark;
            }
            webview2.SetTheme(preferredColorScheme);
            var windowHandle = new WindowInteropHelper(this).EnsureHandle();
            if (windowHandle == null || windowHandle == IntPtr.Zero) return;
            Utils.Areo.EnableBlur(windowHandle, dark);
        }
    }
}
