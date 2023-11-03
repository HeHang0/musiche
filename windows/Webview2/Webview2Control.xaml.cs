using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.Wpf;
using System;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Interop;

namespace Musiche.Webview2
{
    /// <summary>
    /// Webview2Control.xaml 的交互逻辑
    /// </summary>
    public partial class Webview2Control : UserControl
    {
        private Window _parentWindow;
        private static readonly CoreWebView2Environment _coreEnvironment;

        public event EventHandler<CoreWebView2WebMessageReceivedEventArgs> WebMessageReceived;
        public event EventHandler<CoreWebView2InitializationCompletedEventArgs> CoreWebView2InitializationCompleted;
        public event EventHandler<CoreWebView2DOMContentLoadedEventArgs> CoreWebView2DOMContentLoaded;

        public static bool Available => _coreEnvironment != null;
        public WebView2 Control => webview2;

        public Webview2Control()
        {
            InitializeComponent();
            Unloaded += WebView2_Unloaded;
            Loaded += Webview2Control_Loaded;
            InitWebViewCore();
            Logger.Logger.Info("webview2创建================================");
        }

        private async void InitWebViewCore()
        {
            webview2.DefaultBackgroundColor = System.Drawing.Color.Transparent;
            webview2.CoreWebView2InitializationCompleted += OnCoreWebView2InitializationCompleted;
            webview2.WebMessageReceived += OnWebMessageReceived;
            await webview2.EnsureCoreWebView2Async(_coreEnvironment);
            Logger.Logger.Info("webview2初始化================================");
        }

        static Webview2Control()
        {
            try
            {
                SetLoaderDll();
                CoreWebView2EnvironmentOptions environmentOptions = new CoreWebView2EnvironmentOptions();
                if (File.Exists(Path.Combine(Utils.File.Webview2Path, Utils.File.DisableGPUName)))
                {
                    environmentOptions.AdditionalBrowserArguments = "--disable-gpu";
                }
                _coreEnvironment = CoreWebView2Environment.CreateAsync(userDataFolder: Utils.File.Webview2Path, options: environmentOptions).Result;
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Init CoreWebView2Environment Error: ", ex);
            }
        }

        private void Webview2Control_Loaded(object sender, RoutedEventArgs e)
        {
            _parentWindow = Window.GetWindow(this);
        }

        private void WebView2_Unloaded(object sender, RoutedEventArgs e)
        {
            Content = null;
            webview2?.Dispose();
            webview2 = null;
        }

        private void OnWebMessageReceived(object sender, CoreWebView2WebMessageReceivedEventArgs e)
        {
            WebMessageReceived?.Invoke(sender, e);
        }

        private void OnCoreWebView2InitializationCompleted(object sender, CoreWebView2InitializationCompletedEventArgs e)
        {
            if (webview2 == null) return;
#if DEBUG
#else
            webview2.CoreWebView2.Settings.AreBrowserAcceleratorKeysEnabled = false;
            webview2.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            webview2.CoreWebView2.Settings.AreDevToolsEnabled = false;
#endif
            webview2.CoreWebView2.Settings.AreDefaultScriptDialogsEnabled = false;
            webview2.CoreWebView2.Settings.IsPasswordAutosaveEnabled = false;
            webview2.CoreWebView2.Settings.IsStatusBarEnabled = false;
            webview2.CoreWebView2.Settings.IsGeneralAutofillEnabled = false;
            webview2.CoreWebView2.Settings.IsZoomControlEnabled = false;
            webview2.CoreWebView2.Settings.IsBuiltInErrorPageEnabled = false;
            if (_parentWindow != null)
            {
                webview2.CoreWebView2.AddHostObjectToScript("specialService", new SpecialService(new WindowInteropHelper(_parentWindow).Handle));
            }
            webview2.CoreWebView2.AddHostObjectToScript("fileAccessor", new FileAccessor());
            SaveWindowStatus();
            webview2.CoreWebView2.ContainsFullScreenElementChanged += CoreWebView2_ContainsFullScreenElementChanged;
            webview2.CoreWebView2.DOMContentLoaded += CoreWebView2_DOMContentLoaded;
            CoreWebView2InitializationCompleted?.Invoke(sender, e);
            Logger.Logger.Info("webview2 核心初始化================================");
        }

        private void CoreWebView2_DOMContentLoaded(object sender, CoreWebView2DOMContentLoadedEventArgs e)
        {
            CoreWebView2DOMContentLoaded?.Invoke(sender, e);
            Logger.Logger.Info("webview2 文档加载================================");
        }

        private WindowState normalWindowState = WindowState.Normal;
        private WindowStyle normalWindowStyle = WindowStyle.SingleBorderWindow;
        private ResizeMode normalResizeMode = ResizeMode.CanResize;
        private double normalLeft = 0;
        private double normalTop = 0;
        private double normalHeight = 0;
        private double normalWidth = 0;
        private void CoreWebView2_ContainsFullScreenElementChanged(object sender, object e)
        {
            if (_parentWindow == null)
            {
                return;
            }
            var core = sender as CoreWebView2;
            if (core == null) return;
            if (core.ContainsFullScreenElement)
            {
                bool maximized = _parentWindow.WindowState == WindowState.Maximized;
                _parentWindow.WindowState = WindowState.Normal;
                SaveWindowStatus();
                if (maximized)
                {
                    normalWindowState = WindowState.Maximized;
                }
                _parentWindow.WindowState = WindowState.Normal;
                _parentWindow.WindowStyle = WindowStyle.None;
                _parentWindow.ResizeMode = ResizeMode.NoResize;
                _parentWindow.Topmost = true;
                _parentWindow.Left = 0.0;
                _parentWindow.Top = 0.0;
                _parentWindow.Height = SystemParameters.PrimaryScreenHeight;
                _parentWindow.Width = SystemParameters.PrimaryScreenWidth;
            }
            else
            {
                _parentWindow.Topmost = false;
                ResumeWindowStatus();
            }
        }

        private void SaveWindowStatus()
        {
            if (_parentWindow == null)
            {
                return;
            }
            normalResizeMode = _parentWindow.ResizeMode;
            normalLeft = _parentWindow.Left;
            normalTop = _parentWindow.Top;
            normalHeight = _parentWindow.Height;
            normalWidth = _parentWindow.Width;
            normalWindowState = _parentWindow.WindowState;
            normalWindowStyle = _parentWindow.WindowStyle;
        }

        private void ResumeWindowStatus()
        {
            if (_parentWindow == null)
            {
                return;
            }
            _parentWindow.WindowState = normalWindowState;
            _parentWindow.WindowStyle = normalWindowStyle;
            _parentWindow.ResizeMode = normalResizeMode;
            _parentWindow.Left = normalLeft;
            _parentWindow.Top = normalTop;
            _parentWindow.Height = normalHeight;
            _parentWindow.Width = normalWidth;
        }

        private static void SetLoaderDll()
        {
            Utils.File.CreateDirectoryIFNotExists(Utils.File.Webview2Path);
            string loaderPath = Path.Combine(Utils.File.Webview2Path, "WebView2Loader.dll");
            if (!Utils.Processor.IsDotNetFramework()) return;
            if (!File.Exists(loaderPath))
            {
                switch (Utils.Processor.GetArchitecture())
                {
                    case Utils.Processor.ProcessorArchitecture.ARM64:
                        File.WriteAllBytes(loaderPath, Properties.Resources.WebView2Loader_arm64);
                        break;
                    case Utils.Processor.ProcessorArchitecture.x86:
                        File.WriteAllBytes(loaderPath, Properties.Resources.WebView2Loader_x86);
                        break;
                    default:
                        File.WriteAllBytes(loaderPath, Properties.Resources.WebView2Loader_x64);
                        break;
                }
            }
            CoreWebView2Environment.SetLoaderDllFolderPath(Utils.File.Webview2Path);
        }
    }
}
