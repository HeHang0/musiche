using Musiche.Audio;
using Musiche.NotifyIcon;
using Musiche.Server;
using Musiche.Webview2;
using System;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Windows;

namespace Musiche
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        readonly Webview2Control webview2;
        readonly AudioPlay audioPlay;
        readonly WebServer webServer;
        readonly WebSocketHandler webSocketHandler;
        readonly HttpHandler httpHandler;
        readonly NotifyIconInfo notifyIcon;
        readonly Stream logStream = null;
        Hotkey.Hotkey hotkey = null;
        public MainWindow()
        {
            InitializeComponent();
            audioPlay = new AudioPlay();
            webview2 = new Webview2Control();
#if DEBUG
            webServer = new WebServer(54621);
            webview2.Control.Source = new Uri("http://127.0.0.1:54621");
            string exeDirectory = Path.GetDirectoryName(System.Reflection.Assembly.GetEntryAssembly().Location);
            logStream = File.Open(Path.Combine(exeDirectory, "log."+DateTime.Now.ToString("yyyy-MM-dd")+".log"), FileMode.Append);
#else
            int port = GetAvailablePort();
            webServer = new WebServer(port);
            webview2.Control.Source = new Uri("http://localhost:"+port);
#endif
            webSocketHandler = new WebSocketHandler(this, audioPlay);
            httpHandler = new HttpHandler(this, audioPlay);
            InitWebview2();
            StateChanged += MainWindow_StateChanged;
            Closing += MainWindow_Closing;
            SourceInitialized += MainWindow_SourceInitialized;
            webServer.ClientConnected += WebServer_ClientConnected;
            TaskbarItemInfo = new TaskbarInfo(webSocketHandler).TaskbarItemInfo;
            notifyIcon = new NotifyIconInfo(webSocketHandler, ShowApp, ExitApp);
            webServer.Start();
        }

        private void MainWindow_SourceInitialized(object sender, EventArgs e)
        {
            hotkey = new Hotkey.Hotkey(webSocketHandler);
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

        private void WebServer_ClientConnected(object sender, System.Net.HttpListenerContext context)
        {
            if (context.Request.IsWebSocketRequest)
            {
                _ = webSocketHandler.Handle(context);
            }
            else
            {
                _ = httpHandler.Handle(context);
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
                Content = webview2;
            }
            else
            {
                MessageBox.Show("调用Webview2失败");
                Application.Current.Shutdown();
            }
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
    }
}
