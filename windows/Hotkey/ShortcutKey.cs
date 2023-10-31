using NHotkey;
using NHotkey.Wpf;
using System;
using System.Linq;
using System.Windows.Input;

namespace Musiche.Hotkey
{
    public class ShortcutKey
    {
        public bool CtrlKey { get; set; }
        public bool AltKey { get; set; }
        public bool MetaKey { get; set; }
        public bool ShiftKey { get; set; }
        public string Key { get; set; }
        public string Type { get; set; }

        public ShortcutType ParseType()
        {
            return ParseType(Type);
        }

        public static ShortcutType ParseType(string typeString)
        {
            if(string.IsNullOrEmpty(typeString)) return ShortcutType.None;
            typeString = typeString.First().ToString().ToUpper() + typeString.Substring(1);
            if (Enum.TryParse(typeString, out ShortcutType shortcutType))
            {
                return shortcutType;
            }
            else
            {
                return ShortcutType.None;
            }
        }

        public ModifierKeys ParseModifierKeys()
        {
            var key = ModifierKeys.None;
            if (CtrlKey) key |= ModifierKeys.Control;
            if (ShiftKey) key |= ModifierKeys.Shift;
            if (AltKey) key |= ModifierKeys.Alt;
            if (MetaKey) key |= ModifierKeys.Windows;
            return key;
        }

        private void OnIncrement(object sender, HotkeyEventArgs e)
        {
            throw new NotImplementedException();
        }

        public Key ParseKey()
        {
            if (Enum.TryParse(Key, out HtmlKey key))
            {

                return (Key)Enum.ToObject(typeof(Key), (int)key);
            }
            else
            {
                return System.Windows.Input.Key.None;
            }
        }
    }
    public enum ShortcutType
    {
        MediaPlay, MediaLast, MediaNext, MediaStop, Play, Last, Next, Plus, Minus, Love, None
    }
}
