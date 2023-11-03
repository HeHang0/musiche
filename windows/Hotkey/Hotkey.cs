using Musiche.Server;
using NHotkey;
using NHotkey.Wpf;
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;

namespace Musiche.Hotkey
{
    public class Hotkey
    {
        readonly WebSocketHandler webSocketHandler;
        readonly HashSet<string> shortcutTypes = new HashSet<string>();
        static readonly string HotkeyNamePrefix = "Musiche";
        static readonly string HotkeyNameMedia = "media";
        private const int WM_APPCOMMAND = 0x0319;
        HwndSource hwndSource = null;
        public Hotkey(WebSocketHandler webSocketHandler)
        {
            this.webSocketHandler = webSocketHandler;
        }

        public string Register(ShortcutKey shortcutKey)
        {
            if (shortcutKey.Type.ToLower() == HotkeyNameMedia)
            {
                return registerMedia();
            }
            ShortcutType shortcutType = shortcutKey.ParseType();
            if (shortcutType == ShortcutType.None) return "热键注册类型不能为空";
            ModifierKeys modifierKeys = shortcutKey.ParseModifierKeys();
            Key key = shortcutKey.ParseKey();
            if (modifierKeys == ModifierKeys.None) return "修饰键不能为空";
            if (key == Key.None) return "热键不能为空";
            try
            {
                HotkeyManager.Current.AddOrReplace(HotkeyNamePrefix + shortcutType.ToString(), key, modifierKeys, OnHotKey);
                shortcutTypes.Add(shortcutType.ToString());
            }
            catch (Exception ex)
            {
                return Regex.Replace(ex.Message, "[\\s]*\\([0-9x]+\\)", "");
            }
            return string.Empty;
        }

        private string registerMedia()
        {
            try
            {
                if (hwndSource == null)
                {
                    hwndSource = PresentationSource.FromVisual(Application.Current.MainWindow) as HwndSource;
                    hwndSource?.AddHook(WndProc);
                }
            }
            catch (Exception)
            {
            }
            if (hwndSource == null)
            {
                return "软件错误";
            }
            shortcutTypes.Add(HotkeyNameMedia);
            return string.Empty;
        }

        private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            if (msg == WM_APPCOMMAND && shortcutTypes.Contains(HotkeyNameMedia))
            {
                int appCommand = ((int)lParam >> 16) & 0xFFFF;

                string eventName = string.Empty;
                switch (appCommand)
                {
                    case 14: // Media Play/Pause
                        eventName = "playOrPause";
                        break;
                    case 11: // Media Next Track
                        eventName = "next";
                        break;
                    case 12: // Media Previous Track
                        eventName = "last";
                        break;
                    case 13: // Media Stop
                        eventName = "pause";
                        break;
                }
                if (!string.IsNullOrEmpty(eventName))
                {
                    webSocketHandler.SendMessage("{\"type\": \"" + eventName + "\"}");
                }
            }

            return IntPtr.Zero;
        }

        public bool Remove(string shortcutType)
        {
            if (shortcutType.ToLower() == HotkeyNameMedia)
            {
                shortcutTypes.Remove(HotkeyNameMedia);
            }
            else
            {
                HotkeyManager.Current.Remove(HotkeyNamePrefix + shortcutType);
                shortcutTypes.Remove(shortcutType.ToString());
            }
            return true;
        }

        public void Clear()
        {
            foreach (string item in shortcutTypes)
            {
                HotkeyManager.Current.Remove(HotkeyNamePrefix + item);
            }
        }

        private void OnHotKey(object sender, HotkeyEventArgs e)
        {
            ShortcutType shortcutType = ShortcutKey.ParseType(e.Name.Substring(7));
            if (shortcutType == ShortcutType.None) return;
            string eventName;
            switch (shortcutType)
            {
                case ShortcutType.None:
                    return;
                case ShortcutType.Play:
                case ShortcutType.MediaPlay:
                    eventName = "playOrPause";
                    break;
                case ShortcutType.MediaNext:
                    eventName = "next";
                    break;
                case ShortcutType.MediaLast:
                    eventName = "next";
                    break;
                case ShortcutType.MediaStop:
                    eventName = "pause";
                    break;
                default:
                    eventName = shortcutType.ToString().ToLower();
                    break;

            }
            if (string.IsNullOrWhiteSpace(eventName)) return;
            webSocketHandler.SendMessage("{\"type\": \"" + eventName + "\"}");
        }
    }
}
