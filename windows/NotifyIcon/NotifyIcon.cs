using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Musiche.NotifyIcon
{
    public class NotifyIcon
    {
        private readonly System.Windows.Forms.NotifyIcon notifyIcon;
        private readonly ToolStripRenderer _toolStripRenderer;

        public NotifyIcon(ToolStripRenderer toolStripRenderer = null)
        {
            _toolStripRenderer = toolStripRenderer ?? new ModernToolStripRenderer();
            Control.CheckForIllegalCrossThreadCalls = false;
            notifyIcon = new System.Windows.Forms.NotifyIcon
            {
                Visible = true
            };
            UpdateStyle();
            ProcessContextMenuStrip();
            ThemeListener.ThemeChanged += OnThemeChanged;
        }

        private void OnThemeChanged(bool isDark)
        {
            UpdateStyle();
        }

        public void AddMenu(IEnumerable<ToolStripItem> menuItems)
        {
            if (notifyIcon.ContextMenuStrip == null)
            {
                ContextMenuStrip = new ContextMenuStrip();
            }
            notifyIcon.ContextMenuStrip.Width = 200;
            foreach (var menuItem in menuItems)
            {
                notifyIcon.ContextMenuStrip.Items.Add(menuItem);
            }
            UpdateStyle();
        }

        private void ProcessContextMenuStrip()
        {
            if (notifyIcon.ContextMenuStrip == null) return;
            notifyIcon.ContextMenuStrip.Renderer = _toolStripRenderer;
            notifyIcon.ContextMenuStrip.HandleCreated += ContextMenuStrip_HandleCreated;
        }

        public ContextMenuStrip ContextMenuStrip
        {
            get { return notifyIcon.ContextMenuStrip; }
            set
            {
                if (notifyIcon.ContextMenuStrip != null)
                {
                    notifyIcon.ContextMenuStrip.HandleCreated -= ContextMenuStrip_HandleCreated;
                }
                notifyIcon.ContextMenuStrip = value;
                ProcessContextMenuStrip();
            }
        }

        public Icon Icon
        {
            get { return notifyIcon.Icon; }
            set
            {
                notifyIcon.Icon = value;
            }
        }

        public void Dispose()
        {
            notifyIcon.Dispose();
        }

        private void ContextMenuStrip_HandleCreated(object sender, EventArgs e)
        {
            SetContextMenuRoundedCorner(notifyIcon.ContextMenuStrip.Handle);
            foreach (object item in notifyIcon.ContextMenuStrip.Items)
            {
                if (item is ToolStripMenuItem menuItem)
                {
                    SetContextMenuRoundedCorner(menuItem.DropDown.Handle);
                }
            }
        }

        public void UpdateStyle()
        {
            if (notifyIcon.ContextMenuStrip == null) return;
            Bitmap _defaultBitmap = new Bitmap(1, 1);
            var dark = ThemeListener.IsDarkMode;
            var backColor = dark ? Color.FromArgb(0x2B, 0x2B, 0x2B) : Color.White;
            var foreColor = dark ? Color.FromArgb(0xFF, 0xFF, 0xFF) : Color.FromArgb(0, 0, 0);
            foreach (ToolStripItem item in notifyIcon.ContextMenuStrip.Items)
            {
                if (item is ToolStripMenuItem menuItem)
                {
                    menuItem.Padding = new Padding(0, 10, 0, 10);
                    if (menuItem.Tag != null && menuItem.Image == null)
                    {
                        menuItem.Image = _defaultBitmap;
                    }
                    foreach (ToolStripMenuItem dropDownItem in menuItem.DropDownItems)
                    {
                        dropDownItem.Padding = new Padding(0, 10, 0, 10);
                        if (dropDownItem.Tag != null && dropDownItem.Image == null)
                        {
                            dropDownItem.Image = _defaultBitmap;
                        }
                    }
                    menuItem.DropDown.BackColor = backColor;
                    menuItem.DropDown.ForeColor = foreColor;
                    menuItem.DropDown.Invalidate();
                }
            }
            notifyIcon.ContextMenuStrip.BackColor = backColor;
            notifyIcon.ContextMenuStrip.ForeColor = foreColor;
            notifyIcon.ContextMenuStrip.Invalidate();
        }

        private static void SetContextMenuRoundedCorner(IntPtr handle)
        {
            var attribute = DWMWINDOWATTRIBUTE.DWMWA_WINDOW_CORNER_PREFERENCE;
            var preference = DWM_WINDOW_CORNER_PREFERENCE.DWMWCP_ROUNDSMALL;
            DwmSetWindowAttribute(handle, attribute, ref preference, sizeof(uint));
        }

        public enum DWMWINDOWATTRIBUTE
        {
            DWMWA_WINDOW_CORNER_PREFERENCE = 33
        }

        public enum DWM_WINDOW_CORNER_PREFERENCE
        {
            DWMWCP_DEFAULT = 0,
            DWMWCP_DONOTROUND = 1,
            DWMWCP_ROUND = 2,
            DWMWCP_ROUNDSMALL = 3
        }

        // Import dwmapi.dll and define DwmSetWindowAttribute in C# corresponding to the native function.
        [DllImport("dwmapi.dll", CharSet = CharSet.Unicode, SetLastError = true)]
        private static extern long DwmSetWindowAttribute(IntPtr hwnd,
                                                         DWMWINDOWATTRIBUTE attribute,
                                                         ref DWM_WINDOW_CORNER_PREFERENCE pvAttribute,
                                                         uint cbAttribute);
    }
}
