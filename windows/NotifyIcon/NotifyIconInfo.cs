using Musiche.Server;
using System;
using System.Drawing;
using System.Windows.Forms;

namespace Musiche.NotifyIcon
{
    public class NotifyIconInfo
    {
        public event LyricLockedChangedEventHandler LyricLockedChanged;
        readonly WebSocketHandler webSocketHandler;
        readonly NotifyIcon notifyIcon;
        private readonly EventHandler showApp;
        private readonly EventHandler exitApp;

        public NotifyIconInfo(WebSocketHandler webSocketHandler, EventHandler showApp, EventHandler exitApp)
        {
            this.webSocketHandler = webSocketHandler;
            this.showApp = showApp;
            this.exitApp = exitApp;
            notifyIcon = new NotifyIcon()
            {
                Icon = Properties.Resources.logo
            };
            notifyIcon.LeftClick += showApp;
            notifyIcon.AddMenu(BuildMenu());
        }

        ToolStripMenuItem titleMenu;
        ToolStripMenuItem playPauseMenu;
        ToolStripMenuItem loopTypeMenu;
        ToolStripMenuItem lyricMenu;
        ToolStripMenuItem lyricLockMenu;
        private ToolStripItem[] BuildMenu()
        {
            titleMenu = new ToolStripMenuItem("Musiche", null, showApp);
            titleMenu.Tag = "人";
            playPauseMenu = new ToolStripMenuItem("播放", null, AudioPlayPause);
            playPauseMenu.Tag = "▶";
            ToolStripMenuItem lastMenu = new ToolStripMenuItem("上一首", null, AudioLast);
            lastMenu.Tag = "←";
            ToolStripMenuItem nextMenu = new ToolStripMenuItem("下一首", null, AudioNext);
            nextMenu.Tag = "→";
            ToolStripMenuItem exitMenu = new ToolStripMenuItem("退出", null, exitApp);
            exitMenu.Tag = "退";
            lyricMenu = new ToolStripMenuItem("打开桌面歌词", null, ShowLyric);
            lyricMenu.Tag = "词";
            lyricLockMenu = new ToolStripMenuItem("锁定桌面歌词", null, LockLyric);
            lyricLockMenu.Tag = "锁";
            lyricLockMenu.Visible = false;
            loopTypeMenu = new ToolStripMenuItem("列表循环", null, new ToolStripMenuItem[]
            {
                new ToolStripMenuItem("列表循环", null, LoopTypeChange)
                {
                    Tag = "环"
                },
                new ToolStripMenuItem("单曲循环", null, LoopTypeChange)
                {
                    Tag = "单"
                },
                new ToolStripMenuItem("随机播放", null, LoopTypeChange)
                {
                    Tag = "随"
                },
                new ToolStripMenuItem("顺序播放", null, LoopTypeChange)
                {
                    Tag = "顺"
                }
            });
            return new ToolStripItem[] {
                titleMenu, playPauseMenu, lastMenu, nextMenu,
                new ToolStripSeparator(), loopTypeMenu,
                new ToolStripSeparator(), lyricMenu,lyricLockMenu,
                new ToolStripSeparator(), exitMenu };
        }

        bool isThemeDark = false;
        public void SetTheme(bool dark)
        {
            isThemeDark = dark;
            notifyIcon.UpdateStyle(dark);
        }

        public void AudioPlayStateChanged(bool playing)
        {
            if (playing)
            {
                playPauseMenu.Text = "暂停";
                playPauseMenu.Tag = "⏸";
            }
            else
            {
                playPauseMenu.Text = "播放";
                playPauseMenu.Tag = "▶";
            }
        }

        private void AudioPlayPause(object sender, EventArgs e)
        {
            AudioPlayStateChanged(playPauseMenu.Text == "播放");
            webSocketHandler.SendMessage("{\"type\": \"playOrPause\"}");
        }

        private void AudioNext(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"next\"}");
        }

        private void ShowLyric(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"lyric\", \"data\": " + (lyricShow ? "false" : "true") + "}");
        }

        private void LockLyric(object sender, EventArgs e)
        {
            LyricLockedChanged?.Invoke(this, !lyricLocked);
        }

        private void AudioLast(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"last\"}");
        }

        private void LoopTypeChange(object sender, EventArgs e)
        {
            ToolStripMenuItem menuItem = sender as ToolStripMenuItem;

            string loopType = "loop";
            switch (menuItem.Tag?.ToString())
            {
                case "单": loopType = "single"; break;
                case "随": loopType = "random"; break;
                case "顺": loopType = "order"; break;
            }
            if (menuItem == null) return;
            webSocketHandler.SendMessage("{\"type\": \"loop\",\"data\":\"" + loopType + "\"}");
        }

        public void Dispose()
        {
            notifyIcon.Dispose();
        }

        public void SetMusicLoopType(string loopType)
        {
            switch (loopType)
            {
                case "single": loopType = "单"; break;
                case "random": loopType = "随"; break;
                case "order": loopType = "顺"; break;
                default: loopType = "环"; break;
            }
            loopTypeMenu.Tag = loopType;
            loopTypeMenu.Image = new Bitmap(1, 1);
            foreach (ToolStripMenuItem menuItem in loopTypeMenu.DropDownItems)
            {
                if (menuItem == null) continue;
                menuItem.Checked = menuItem.Tag?.ToString() == loopType;
                if (menuItem.Checked)
                {
                    loopTypeMenu.Text = menuItem.Text;
                }
            }
        }
        private bool lyricShow = false;
        public void SetLyricShow(bool show)
        {
            lyricShow = show;
            lyricMenu.Text = (show ? "关闭" : "打开") + "桌面歌词";
            lyricLockMenu.Visible = show;
        }
        private bool lyricLocked = false;
        public void SetLyricLock(bool locked)
        {
            lyricLocked = locked;
            lyricLockMenu.Text = (locked ? "解锁" : "锁定") + "桌面歌词";
            lyricLockMenu.Tag = locked ? "解" : "锁";
        }

        internal void SetTitle(string title)
        {
            titleMenu.Text = title;
            titleMenu.ToolTipText = title;
        }
    }
}
