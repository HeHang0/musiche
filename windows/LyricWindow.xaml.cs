using Musiche.Server;
using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Threading;
using Rectangle = System.Windows.Shapes.Rectangle;

namespace Musiche
{
    /// <summary>
    /// LyricWindow.xaml 的交互逻辑
    /// </summary>
    public partial class LyricWindow : Window
    {
        private bool closeFlag = false;
        private bool locked = false;
        private readonly DropShadowEffect lyricEffect;
        private readonly WebSocketHandler webSocketHandler;
        private static readonly Brush hoverBackgroundDark = new SolidColorBrush(Color.FromArgb(0x80, 0x00, 0x00, 0x00));
        private static readonly Brush hoverBackgroundLight = new SolidColorBrush(Color.FromArgb(0x80, 0xFF, 0xFF, 0xFF));
        private static readonly Brush hoverBackgroundTransparent = new SolidColorBrush(Color.FromArgb(0x01, 0x00, 0x00, 0x00));
        private Brush hoverBackground = hoverBackgroundLight;
        private readonly FontFamily defaultFontfamily = new FontFamily("Microsoft YaHei UI");
        private readonly string statusSavePath = Path.Combine(Utils.File.DataPath, "lyric.config.json");
        private Utils.WindowResize windowResize = null;
        private DispatcherTimer lyricTimer = null;
        public LyricWindow(WebSocketHandler webSocketHandler, string title, bool dark)
        {
            this.webSocketHandler = webSocketHandler;
            InitializeComponent();
            Title = title;
            Lyric.Content = title;
            lyricEffect = Lyric.Effect as DropShadowEffect;
            defaultFontfamily = Lyric.FontFamily;
            SetIcons();
            SetStatus();
            SetTheme(dark);
        }

        public void SetTheme(bool dark)
        {
            hoverBackground = dark ? hoverBackgroundDark : hoverBackgroundLight;
            foreach (object item in IconPannel.Children)
            {
                if (item is Label label)
                {
                    label.Foreground = dark ? Brushes.White : Brushes.Black;
                }
            }
            if(LockLabel.Effect is DropShadowEffect effect)
                effect.Color = dark ? Colors.Black : Colors.White;
        }

        private void SetStatus()
        {
            if(!File.Exists(statusSavePath))
            {
                WindowStartupLocation = WindowStartupLocation.CenterScreen;
                return;
            }else
            {
                Utils.WindowStatus windowStatus = Utils.WindowStatus.Parse(System.IO.File.ReadAllText(statusSavePath));
                if(windowStatus.Width > 0) Width = Math.Max(windowStatus.Width, MinWidth);
                if (windowStatus.Height > 0) Height = Math.Max(windowStatus.Height, MinHeight);
                if (windowStatus.X > 0) Left = Math.Min(windowStatus.X, SystemParameters.PrimaryScreenWidth - Width);
                if (windowStatus.Y > 0) Top = Math.Min(windowStatus.Y, SystemParameters.PrimaryScreenHeight - Height);
                SetLocked(windowStatus.Locked, true);
            }
        }

        private void SaveStatus()
        {
            Utils.WindowStatus windowStatus = new Utils.WindowStatus()
            {
                Width = Width,
                Height = Height,
                X = Left,
                Y = Top,
                Locked = locked
            };
            File.WriteAllText(statusSavePath, windowStatus.ToString());
        }

        private void SetIcons()
        {
            var uri = new Uri(Path.GetDirectoryName(Utils.File.IconFontPath));
            FontFamily fontFamily = new FontFamily(uri.AbsoluteUri+"/#iconfont");
            foreach (object item in IconPannel.Children)
            {
                if(item is Label label)
                {
                    label.FontFamily = fontFamily;
                }
            }
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            var handle = new WindowInteropHelper(this).Handle;
            //Performing some magic to hide the form from Alt+Tab
            SetWindowLong(handle, GWL_EX_STYLE, (GetWindowLong(handle, GWL_EX_STYLE) | WS_EX_TOOLWINDOW) & ~WS_EX_APPWINDOW);
            //Utils.Areo.Apply(handle, 0x80FFFFFF);
            windowResize = new Utils.WindowResize(handle);
        }

        private void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            SaveStatus();
            if (!closeFlag)
            {
                webSocketHandler.SendMessage("{\"type\": \"lyric\", \"data\": false}");
            }
        }

        public void SetOptions(LyricOptions options)
        {
            if (!options.Show)
            {
                closeFlag = true;
                Close();
                return;
            }
            Color effectColor = Colors.Transparent;
            if (!string.IsNullOrWhiteSpace(options.EffectColor))
            {
                try {
                    effectColor = (Color)ColorConverter.ConvertFromString(options.EffectColor);
                }
                catch (Exception)
                {
                }
            }
            lyricEffect.Color = effectColor;
            Brush fontColor = Brushes.Black;
            if (!string.IsNullOrWhiteSpace(options.FontColor))
            {
                try
                {
                    fontColor = new SolidColorBrush((Color)ColorConverter.ConvertFromString(options.FontColor));
                }
                catch (Exception)
                {
                }
            }
            Lyric.Foreground = fontColor;
            if(options.FontSize > 0) Lyric.FontSize = options.FontSize;
            Lyric.FontWeight = options.FontBold ? FontWeights.Bold : FontWeights.Normal;
            
            if (string.IsNullOrWhiteSpace(options.FontFamily))
            {
                Lyric.FontFamily = defaultFontfamily;
            }
            else
            {
                try
                {
                    Lyric.FontFamily = new FontFamily(options.FontFamily);
                }
                catch (Exception)
                {
                    Lyric.FontFamily = defaultFontfamily;
                }
            }
            if(options.Topmost != Topmost)
            {
                Topmost = options.Topmost;
            }
        }

        private double scrollStep = 0;
        public void SetLine(string line, double duration=0)
        {
            LyricScroll.ScrollToHorizontalOffset(0);
            Lyric.Content = line;
            lyricTimer?.Stop();
            //更新行, 591.4000000000001, 350, 591.4000000000001
            System.Diagnostics.Trace.WriteLine($"更新行, {LyricScroll.ExtentWidth}, {LyricScroll.ActualWidth}, {Lyric.ActualWidth}");
            if (duration > 0 && duration < 60000 && LyricScroll.ExtentWidth > LyricScroll.ActualWidth)
            {
                scrollStep = (LyricScroll.ExtentWidth - LyricScroll.ActualWidth) / (duration / 33);
                lyricTimer = new DispatcherTimer();
                lyricTimer.Interval = TimeSpan.FromMilliseconds(33);
                lyricTimer.Tick += TimerSetScroll;
                lyricTimer.Start();
            }
        }

        private void TimerSetScroll(object sender, EventArgs e)
        {
            if (scrollStep <= 0) return;
            LyricScroll.ScrollToHorizontalOffset(LyricScroll.HorizontalOffset+scrollStep);
            if(LyricScroll.ExtentWidth - LyricScroll.ActualWidth <= 
                LyricScroll.HorizontalOffset && sender is DispatcherTimer timer)
            {
                timer.Stop();
            }
        }

        private void Window_MouseEnter(object sender, MouseEventArgs e)
        {
            if (locked)
            {
                LyricBorder.Background = hoverBackgroundTransparent;
            }
            else
            {
                LyricBorder.Background = hoverBackground;
                ResizeGrid.Visibility = Visibility.Visible;
            }
            IconPannel.Visibility = Visibility.Visible;
        }

        private void Window_MouseLeave(object sender, MouseEventArgs e)
        {
            IconPannel.Visibility = Visibility.Collapsed;
            ResizeGrid.Visibility = Visibility.Collapsed;
            LyricBorder.Background = Brushes.Transparent;
        }

        private void DragWindow(object sender, MouseButtonEventArgs e)
        {
            if (locked) return;
            e.Handled = true;
            DragMove();
        }

        private void SizeWindow(object sender, MouseButtonEventArgs e)
        {
            if (windowResize == null || 
                !(sender is Rectangle rectangle) || 
                !(rectangle.Tag is string directionText) || 
                !int.TryParse(directionText, out int direction))
            {
                return;
            }
            e.Handled = true;
            windowResize.ResizeWindow(direction);
        }

        private void MusicOperate(object sender, MouseButtonEventArgs e)
        {
            e.Handled = true;
            if (sender is Label label && label.Tag is string operate)
            {
                string text = label.Content?.ToString() ?? string.Empty;
                if (text == "停") label.Content = "播";
                else if (text == "播") label.Content = "停";
                webSocketHandler.SendMessage("{\"type\": \"" + operate + "\", \"data\": false}");
            }
        }

        private void LockWindow(object sender, MouseButtonEventArgs e)
        {
            if (!(sender is Label label)) return;
            e.Handled = true;
            SetLocked(label.Content?.ToString() == "锁");
        }

        private void SetLocked(bool isLock, bool isInitial=false)
        {
            locked = isLock;
            LockLabel.Content = locked ? "解" : "锁";
            foreach (object item in IconPannel.Children)
            {
                if (item is Label otherLabel)
                {
                    if (otherLabel != LockLabel) otherLabel.Visibility = locked ? Visibility.Collapsed : Visibility.Visible;
                }
            }
            if (!isInitial)
            {
                LyricBorder.Background = locked ? Brushes.Transparent : hoverBackground;
                ResizeGrid.Visibility = locked ? Visibility.Collapsed : Visibility.Visible;
            }
        }

        private void CloseWindow(object sender, MouseButtonEventArgs e)
        {
            e.Handled = true;
            Close();
        }

        public void AudioPlayStateChanged(bool playing)
        {
            PlayOrPause.Content = playing ? "停" : "播";
        }

        [DllImport("user32.dll", SetLastError = true)]
        static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);

        private const int GWL_EX_STYLE = -20;
        private const int WS_EX_APPWINDOW = 0x00040000, WS_EX_TOOLWINDOW = 0x00000080;
    }
}
