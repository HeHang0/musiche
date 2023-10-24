using System;
using System.Diagnostics;

namespace Musiche.Logger
{
    public class Logger
    {
        public static void WriteLine(params object[] message)
        {
            Trace.WriteLine(string.Join(", ", message));
        }

        public static void Error(params object[] message)
        {
            Trace.WriteLine(string.Join(", ", message), "[ERROR]");
            foreach (object item in message)
            {
                if(item is Exception)
                {
                    Trace.WriteLine((item as Exception).InnerException);
                    Trace.WriteLine((item as Exception).StackTrace);
                }
            }
        }

        public static void Warning(params object[] message)
        {
            Trace.WriteLine(string.Join(", ", message), "[WARN]");
        }

        public static void Debug(params object[] message)
        {
            Trace.WriteLine(string.Join(", ", message), "[DEBUG]");
        }

        public static void Info(params object[] message)
        {
            Trace.WriteLine(string.Join(", ", message), "[INFO]");
        }
    }
}
