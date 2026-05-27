using System;
using System.IO.Pipes;
using System.Windows;
using Microsoft.Win32;

namespace Musiche
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        System.Threading.Mutex procMutex;

        protected override void OnStartup(StartupEventArgs e)
        {
            base.OnStartup(e);
            RegisterUrlProtocol();
            procMutex = new System.Threading.Mutex(true, "_MUSICHE_MUTEX", out var result);
            if (!result)
            {
                try
                {
                    using (var clientStream = new NamedPipeClientStream(".", "_MUSICHE_PIPE", PipeDirection.InOut, PipeOptions.None))
                    {
                        clientStream.Connect();
                    }
                }
                catch (Exception)
                {
                }
                Current.Shutdown();
                System.Diagnostics.Process.GetCurrentProcess().Kill();
                return;
            }
            MainWindow = new MainWindow();
            MainWindow.Show();
        }

        private static void RegisterUrlProtocol()
        {
            try
            {
                var exePath = System.Diagnostics.Process.GetCurrentProcess().MainModule.FileName;
                using (var schemeKey = Registry.CurrentUser.CreateSubKey(@"Software\Classes\musiche"))
                {
                    schemeKey.SetValue("", "URL:Musiche");
                    schemeKey.SetValue("URL Protocol", "");
                    using (var iconKey = schemeKey.CreateSubKey("DefaultIcon"))
                    {
                        iconKey.SetValue("", "\"" + exePath + "\",1");
                    }
                    using (var commandKey = schemeKey.CreateSubKey(@"shell\open\command"))
                    {
                        commandKey.SetValue("", "\"" + exePath + "\" \"%1\"");
                    }
                }
            }
            catch
            {
            }
        }

        protected override void OnExit(ExitEventArgs e)
        {
            procMutex?.ReleaseMutex();
            base.OnExit(e);
        }
    }
}
