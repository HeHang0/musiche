using System;
using System.Runtime.InteropServices;

namespace Musiche.Webview2
{
    public class SpecialService
    {
        public const int WM_NCLBUTTONDOWN = 0xA1;
        public const int HT_CAPTION = 0x2;
        public const int SC_SIZE = 0xF000;
        public const int WM_SYSCOMMAND = 0x0112;
        public const int HTLEFT = 1;
        public const int HTRIGHT = 2;
        public const int HTTOP = 3;
        public const int HTTOPLEFT = 4;
        public const int HTTOPRIGHT = 5;
        public const int HTBOTTOM = 6;
        public const int HTBOTTOMLEFT = 7;
        public const int HTBOTTOMRIGHT = 8;
        public const int HTMOVE = 9;

        [DllImport("user32.dll")]
        public static extern int SendMessage(IntPtr hWnd, int Msg, int wParam, int lParam);
        [DllImport("user32.dll")]
        public static extern bool ReleaseCapture();

        readonly IntPtr target;

        public SpecialService(IntPtr target)
        {
            this.target = target;
        }

        public void MouseDownDrag()
        {
            ReleaseCapture();
            //_ = SendMessage(target, WM_SYSCOMMAND, 0xF102, 0);
            _ = SendMessage(target, WM_NCLBUTTONDOWN, HT_CAPTION, 0);
        }

        public void ResizeWindow(int direction)
        {
            ReleaseCapture();
            _ = SendMessage(target, WM_SYSCOMMAND, SC_SIZE + direction, 0);
        }

        public void ReleaseMouse()
        {
            ReleaseCapture();
        }
    }
}
