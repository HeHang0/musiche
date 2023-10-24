﻿using Musiche.Audio;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.WebSockets;
using System.Reflection;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;

namespace Musiche.Server
{
    public class WebSocketHandler: Handler, IHandler
    {
        private readonly Dictionary<string, MethodInfo> routers;
        private readonly HashSet<WebSocket> webSockets = new HashSet<WebSocket>();
        public WebSocketHandler(Window window, AudioPlay audioPlay) : base(window, audioPlay)
        {
            routers = Utils.ReadRouter(this);
        }

        [Router("/status")]
        public async Task WSStatus(WebSocket webSocket, string[] commands)
        {
            var status = await GetStatus();
            status.Add("type", "status");
            string text = JsonConvert.SerializeObject(status);
            await SendString(webSocket, text);
        }

        public void SendMessage(string message)
        {
            foreach (WebSocket webSocket in webSockets)
            {
                var buffer = Encoding.UTF8.GetBytes(message);
                webSocket.SendAsync(new ArraySegment<byte>(buffer, 0, buffer.Length), WebSocketMessageType.Text, true, CancellationToken.None);
            }
        }

        private static async Task SendString(WebSocket webSocket, string msg)
        {
            var buffer = Encoding.UTF8.GetBytes(msg);
            try
            {
                await webSocket.SendAsync(new ArraySegment<byte>(buffer, 0, buffer.Length), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Send Websocket Error: ", ex);
            }
            return;
        }

        public async Task Handle(HttpListenerContext context)
        {
            HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
            WebSocket webSocket = webSocketContext.WebSocket;
            byte[] buffer = new byte[1024];
            webSockets.Add(webSocket);
            while (webSocket.State == WebSocketState.Open)
            {
                try
                {
                    WebSocketReceiveResult result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        string[] messageList = Encoding.UTF8.GetString(buffer, 0, result.Count).Split('\n');
                        foreach (var message in messageList)
                        {
                            var commands = message.Split(',');
                            routers.TryGetValue(commands[0], out MethodInfo methodInfo);
                            if (methodInfo != null)
                            {
                                var task = methodInfo.Invoke(this, new object[] { webSocket, commands }) as Task;
                                if (task != null) await task;
                            }
                        }
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
                        break;
                    }
                }
                catch (Exception)
                {
                    try
                    {
                        await webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, string.Empty, CancellationToken.None);
                    }
                    catch (Exception)
                    {
                    }
                    break;
                }
            }
            webSockets.Remove(webSocket);
        }
    }
}
