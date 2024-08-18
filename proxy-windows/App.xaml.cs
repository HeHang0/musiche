using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;

namespace ProxyServer
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
            procMutex = new System.Threading.Mutex(true, "_PROXY_SERVER_MUTEX", out var result);
            if (!result)
            {
                Current.Shutdown();
                System.Diagnostics.Process.GetCurrentProcess().Kill();
                return;
            }
            MainWindow = new MainWindow();
            MainWindow.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            base.OnExit(e);
            procMutex?.ReleaseMutex();
        }
    }
}
