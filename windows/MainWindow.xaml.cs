using Microsoft.Web.WebView2.Core;
using Musiche.Audio;
using Musiche.NotifyIcon;
using Musiche.Server;
using Musiche.Webview2;
using System;
using System.Diagnostics;
using System.IO;
using System.IO.Pipes;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Threading;

namespace Musiche
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        //readonly Webview2Control webview2;
        readonly AudioPlay audioPlay;
        readonly MediaMetaManager mediaMetaManager;
        readonly TaskbarInfo taskbarInfo;
        WebServer webServer;
        readonly WebSocketHandler webSocketHandler;
        readonly HttpHandler httpHandler;
        readonly NotifyIconInfo notifyIcon;
        readonly DispatcherTimer positionTimer;
        Stream logStream = null;
        Hotkey.Hotkey hotkey = null;
        LyricWindow lyricWindow;
        private bool dark = false;

        public MainWindow()
        {
            InitializeComponent();
            audioPlay = new AudioPlay();
            mediaMetaManager = new MediaMetaManager();
            InitWebview2();
            WindowState = WindowState.Minimized;
            webSocketHandler = new WebSocketHandler(this, audioPlay);
            httpHandler = new HttpHandler(this, audioPlay, mediaMetaManager);
            StateChanged += MainWindow_StateChanged;
            Closing += MainWindow_Closing;
            Activated += MainWindow_Activated;
            SourceInitialized += MainWindow_SourceInitialized;
            audioPlay.PlatStateChanged += AudioPlay_PlatStateChanged;
            audioPlay.AudioInitialized += AudioPlay_AudioInitialized;
            taskbarInfo = new TaskbarInfo(webSocketHandler);
            notifyIcon = new NotifyIconInfo(webSocketHandler, ShowApp, ExitApp);
            notifyIcon.LyricLockedChanged += OnLockLyric;
            TaskbarItemInfo = taskbarInfo.TaskbarItemInfo;
            AppDomain.CurrentDomain.UnhandledException += UnhandledException;
            positionTimer = new DispatcherTimer();
            positionTimer.Interval = TimeSpan.FromMilliseconds(500);
            positionTimer.Tick += UpdateAudioPosition;
            positionTimer.Stop();
            if (MediaMetaManager.Supported)
            {
                mediaMetaManager.AudioStatusChanged += OnAudioStatusChanged;
            }
            InitNamedPipeServerStream();
        }

        private void MainWindow_Activated(object sender, EventArgs e)
        {
            if (Visibility == Visibility.Hidden)
            {
                Show();
            }
            if (WindowState == WindowState.Minimized)
            {
                WindowState = WindowState.Normal;
            }
        }

        private async void InitNamedPipeServerStream()
        {
            NamedPipeServerStream serverStream = new NamedPipeServerStream("_MUSICHE_PIPE", PipeDirection.InOut, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);
            try
            {
                await serverStream.WaitForConnectionAsync();
                Dispatcher.Invoke(() =>
                {
                    ShowApp(null, null);
                });
                serverStream.Close();
            }
            catch (Exception)
            {
            }
            InitNamedPipeServerStream();
        }

        private void UpdateAudioPosition(object sender, EventArgs e)
        {
            _ = webSocketHandler.SendStatus();
            if (MediaMetaManager.Supported)
            {
                mediaMetaManager.UpdateMediaControlPosition(audioPlay.CurrentTimeSpan);
            }
        }

        private void UnhandledException(object sender, UnhandledExceptionEventArgs e)
        {
            Logger.Logger.Error("UI Error", e.ExceptionObject);
        }

        private void AudioPlay_PlatStateChanged(object sender, NAudio.Wave.PlaybackState state)
        {
            mediaMetaManager.SetMediaControlPlayState(state);
            bool playing = state == NAudio.Wave.PlaybackState.Playing;
            notifyIcon?.AudioPlayStateChanged(playing);
            taskbarInfo?.AudioPlayStateChanged(playing);
            lyricWindow?.AudioPlayStateChanged(playing);
            if (playing) positionTimer?.Start();
            else positionTimer?.Stop();
            if (state == NAudio.Wave.PlaybackState.Stopped)
            {
                webSocketHandler.SendMessage("{\"type\": \"next\",\"data\": \"true\"}");
            }
            else
            {
                UpdateAudioPosition(this, null);
            }
        }

        private void AudioPlay_AudioInitialized(object sender, TimeSpan totalTime)
        {
            mediaMetaManager.UpdateMediaControlTimeline(audioPlay.CurrentTimeSpan, totalTime);
        }

        private void MainWindow_SourceInitialized(object sender, EventArgs e)
        {
            hotkey = new Hotkey.Hotkey(webSocketHandler);
#if DEBUG
            webServer = new WebServer(54621);
            webview2.Control.Source = new Uri("http://127.0.0.1:5173");
            string exeDirectory = Path.GetDirectoryName(System.Reflection.Assembly.GetEntryAssembly().Location);
            logStream = File.Open(Path.Combine(exeDirectory, "log." + DateTime.Now.ToString("yyyy-MM-dd") + ".log"), FileMode.Append);
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

        private void OnAudioStatusChanged(object sender, string message)
        {
            webSocketHandler.SendMessage("{\"type\": \"" + message + "\"}");
        }

        private void MainWindow_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"close\"}");
            e.Cancel = true;
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
                if (Environment.GetCommandLineArgs().Any(m => "--dev".Equals(m.ToLower())))
                {
                    webview2.EnableDevMode();
                }
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
            if (sender is System.Windows.Forms.ToolStripMenuItem)
            {
                webSocketHandler.SendMessage("{\"type\": \"show\"}");
            }
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
            httpHandler.SaveStorage();
            webview2?.SaveConfig(true);
            webview2?.webview2?.Stop();
            webview2?.webview2?.Dispose();
            mediaMetaManager?.Dispose();
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
            dark = ThemeListener.IsDarkMode;
            if (Enum.IsDefined(typeof(CoreWebView2PreferredColorScheme), preferredColorSchemeNumber))
            {
                preferredColorScheme = (CoreWebView2PreferredColorScheme)Enum.ToObject(typeof(CoreWebView2PreferredColorScheme), preferredColorSchemeNumber);
                dark = preferredColorScheme == CoreWebView2PreferredColorScheme.Dark;
            }
            notifyIcon.SetTheme(dark);
            webview2.SetTheme(preferredColorScheme);
            lyricWindow?.SetTheme(dark);
            var windowHandle = new WindowInteropHelper(this).EnsureHandle();
            if (windowHandle == IntPtr.Zero) return;
            Utils.Areo.Apply(windowHandle, dark);
        }

        public void SetLyric(LyricOptions options)
        {
            notifyIcon.SetLyricShow(options.Show);
            if (options.Show && lyricWindow == null)
            {
                lyricWindow = new LyricWindow(webSocketHandler, options.Title, dark);
                lyricWindow.Show();
                lyricWindow.Closed += OnLyricWindowClosed;
                lyricWindow.LyricLockedChanged += OnLyricLockedChanged;
            }
            lyricWindow?.SetOptions(options);
        }

        private void OnLockLyric(object sender, bool locked)
        {
            lyricWindow?.SetLocked(locked);
        }

        private void OnLyricLockedChanged(object sender, bool locked)
        {
            notifyIcon.SetLyricLock(locked);
        }

        private void OnLyricWindowClosed(object sender, EventArgs e)
        {
            lyricWindow = null;
        }

        internal void SetLyricLine(string line, double duration = 0)
        {
            lyricWindow?.SetLine(line, duration);
        }
    }
}
