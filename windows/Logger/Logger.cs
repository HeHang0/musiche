using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Threading;

namespace Musiche.Logger
{
    public class Logger
    {
        enum LoggerType
        {
            Error, Warning, Info, Debug
        }

        private static readonly HashSet<Stream> streams = new HashSet<Stream>();
        private static readonly Dispatcher dispatcher = Dispatcher.CurrentDispatcher;

        public static void Error(params object[] message)
        {
            StringBuilder sb = new StringBuilder();
            foreach (object item in message)
            {
                sb.AppendLine(item.ToString());
                if (item is Exception)
                {
                    sb.AppendLine((item as Exception).StackTrace);
                }
            }
            Write(LoggerType.Error, sb.ToString());
        }

        public static void Warning(params object[] message)
        {
            Write(LoggerType.Warning, message);
        }

        public static void Debug(params object[] message)
        {
            Write(LoggerType.Debug, message);
        }

        public static void Info(params object[] message)
        {
            Write(LoggerType.Info, message);
        }

        private static void Write(LoggerType category, params object[] message)
        {
            string cat = $"[{category}]";
            string now = $"{DateTime.Now.ToString("yyyy-MM-dd HH:mm:sss.fff")}";
            string msg = string.Join(", ", message);
            Trace.WriteLine(now + msg, $"[{category}]");
            foreach (Stream stream in streams)
            {
                dispatcher.InvokeAsync(() =>
                {
                    if (stream.CanWrite)
                    {
                        msg = $"{cat,-7} {now} {msg}";
                        byte[] msgByte = Encoding.UTF8.GetBytes(msg);
                        stream.WriteAsync(msgByte, 0, msgByte.Length);
                    }
                });
            }
        }
    }
}
