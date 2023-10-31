using System;
using System.Net;
using System.Threading;

namespace Musiche.Server
{
    public delegate void ClientConnectedEventHandler(object sender, HttpListenerContext context);
    public class WebServer
    {
        private readonly int port = 3001;
        private readonly HttpListener listener;
        public event ClientConnectedEventHandler ClientConnected;
        public WebServer(int httpPort, HttpListener listener)
        {
            port = httpPort;
            this.listener = listener;
        }

        public WebServer(int httpPort)
        {
            port = httpPort;
            listener = new HttpListener();
        }

        public void Start()
        {
            if (listener.IsListening) return;
            listener.Prefixes.Add($"http://localhost:{port}/");
            listener.Prefixes.Add($"http://127.0.0.1:{port}/");
            listener.Start();

            Thread thread = new Thread(new ThreadStart(AcceptConnection))
            {
                IsBackground = true
            };
            thread.Start();
        }

        private void AcceptConnection()
        {
            try
            {
                while (true)
                {
                    HttpListenerContext context = listener.GetContext();
                    try
                    {
                        context.Response.ProcessCors();
                        Logger.Logger.Info("Receive Connection", context.Request.HttpMethod, context.Request.RawUrl);
                        ClientConnected?.Invoke(this, context);
                    }
                    catch (Exception e)
                    {
                        Logger.Logger.Error("ProcessCors Or ClientConnected Error: ", e.Message);
                        try
                        {
                            context.Response.Close();
                        }
                        catch (Exception)
                        {
                            Logger.Logger.Error("Response Close Error: ", e.Message);
                        }
                    }
                }
            }
            catch (Exception)
            {
                listener.Stop();
            }
        }
    }
}
