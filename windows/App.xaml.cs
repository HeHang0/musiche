using System.IO.Pipes;
using System;
using System.Windows;

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

        protected override void OnExit(ExitEventArgs e)
        {
            procMutex?.ReleaseMutex();
            base.OnExit(e);
        }
    }
}
