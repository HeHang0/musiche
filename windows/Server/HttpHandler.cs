using Musiche.Audio;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Markup;

namespace Musiche.Server
{
    public class HttpHandler : Handler, IHandler
    {
        private readonly Dictionary<string, Func<HttpListenerContext, Task>> routers;
        private static readonly string installChineseFontsJson = string.Empty;
        private readonly FileHandler fileHandler = new FileHandler();
        public HttpHandler(MainWindow window, AudioPlay audioPlay, MediaMetaManager mediaMetaManager) : base(window, audioPlay, mediaMetaManager)
        {
            routers = Router.ReadHttpRouter(this);
        }

        static HttpHandler()
        {
            ServicePointManager.ServerCertificateValidationCallback +=
            (sender, certificate, chain, sslPolicyErrors) => true;
            HashSet<string> installChineseFonts = new HashSet<string>();
            foreach (var family in System.Windows.Media.Fonts.SystemFontFamilies)
            {
                foreach (var keyPair in family.FamilyNames)
                {
                    var specificCulture = keyPair.Key.GetSpecificCulture();
                    if (specificCulture.Name.ToLower().Contains("zh"))
                    {
                        installChineseFonts.Add(keyPair.Value);
                    }
                }
            }
            installChineseFontsJson = JsonConvert.SerializeObject(installChineseFonts);
        }

        [Router("*")]
        public async Task ClipboardIndex(HttpListenerContext ctx)
        {
            byte[] data = fileHandler.GetFile(ctx.Request.Url.AbsolutePath);
            if (data != null)
            {
                string mimeType = fileHandler.GetMimeType(ctx.Request.Url.AbsolutePath);
                ctx.Response.StatusCode = (int)HttpStatusCode.OK;
                ctx.Response.ContentType = mimeType;
                await WriteResponse(ctx, data);
            }
            else
            {
                ctx.Response.Headers.Set("Location", "/?redirect=" + ctx.Request.Url.PathAndQuery);
                ctx.Response.StatusCode = (int)HttpStatusCode.Redirect;
            }
        }

        [Router("/version")]
        public async Task GetVersion(HttpListenerContext ctx)
        {
            byte[] data = fileHandler.GetFile("version");
            await SendString(ctx, data != null ? Encoding.UTF8.GetString(data) : Utils.App.Version);
        }

        [Router("/title")]
        public async Task SetTitle(HttpListenerContext ctx)
        {
            string title = ctx.Request.DataAsString();
            _window.Dispatcher.Invoke(() =>
            {
                _window.SetTitle(title);
            });
            await SendString(ctx, "");
        }

        [Router("/media")]
        public async Task SetMedia(HttpListenerContext ctx)
        {
            try
            {
                MediaMetadata data = JsonConvert.DeserializeObject<MediaMetadata>(ctx.Request.DataAsString());
                _mediaMetaManager.Dispatcher.Invoke(() =>
                {
                    _mediaMetaManager.SetMediaMeta(data, _audioPlay.Playing);
                });
            }catch  (Exception) { }
            await SendString(ctx, "");
        }

        [Router("/fadein")]
        public async Task SetFadeIn(HttpListenerContext ctx)
        {
            string fadeIn = ctx.Request.DataAsString();
            _audioPlay.Dispatcher.Invoke(() =>
            {
                _audioPlay.SetFadeIn(!string.IsNullOrWhiteSpace(fadeIn));
            });
            await SendString(ctx, "");
        }

        [Router("/delayExit")]
        public async Task SetDelayExit(HttpListenerContext ctx)
        {
            string queryShutdown = ctx.Request.QueryString.Get("shutdown");
            bool shutdown = queryShutdown == "true" || queryShutdown == "1";
            int.TryParse(ctx.Request.DataAsString(), out int delayMinute);
            _window.Dispatcher.Invoke(() =>
            {
                _window.DelayExit(delayMinute, shutdown);
            });
            await SendString(ctx, "");
        }

        [Router("/gpu")]
        public async Task SetGPU(HttpListenerContext ctx)
        {
            string disableGPU = ctx.Request.DataAsString();
            _window.Dispatcher.Invoke(() =>
            {
                string disableGPUPath = Path.Combine(Musiche.Utils.File.Webview2Path, Musiche.Utils.File.DisableGPUName);
                if (!string.IsNullOrWhiteSpace(disableGPU))
                {
                    File.WriteAllText(disableGPUPath, "");
                }
                else if (File.Exists(disableGPUPath))
                {
                    File.Delete(disableGPUPath);
                }
            });
            await SendString(ctx, "");
        }

        [Router("/play")]
        public async Task Play(HttpListenerContext ctx)
        {
            var url = ctx.Request.DataAsString();
            await _audioPlay.Dispatcher.InvokeAsync(() =>
            {
                _audioPlay.Play(url);
            });
            await SendStatus(ctx);
        }

        [Router("/pause")]
        public async Task Pause(HttpListenerContext ctx)
        {
            await _audioPlay.Dispatcher.InvokeAsync(() =>
            {
                _audioPlay.Pause();
            });
            await SendStatus(ctx);
        }

        [Router("/progress")]
        public async Task SetProgress(HttpListenerContext ctx)
        {
            if (int.TryParse(ctx.Request.DataAsString(), out int progress))
            {
                await _audioPlay.Dispatcher.InvokeAsync(() =>
                {
                    _audioPlay.Progress = progress;
                });
            }
            await SendStatus(ctx);
        }

        [Router("/volume")]
        public async Task SetVolume(HttpListenerContext ctx)
        {
            if (int.TryParse(ctx.Request.DataAsString(), out int volume))
            {
                await _audioPlay.Dispatcher.InvokeAsync(() =>
                {
                    _audioPlay.Volume = volume;
                });
            }
            await SendStatus(ctx);
        }

        [Router("/status")]
        public async Task Status(HttpListenerContext ctx)
        {
            await SendStatus(ctx);
        }

        [Router("/window")]
        public async Task WindowInfo(HttpListenerContext ctx)
        {
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/maximize")]
        public async Task SetMaximize(HttpListenerContext ctx)
        {
            bool maximized = ctx.Request.DataAsString() == "1";
            _window.Dispatcher.Invoke(() =>
            {
                _window.WindowState = maximized ? WindowState.Maximized : WindowState.Normal;
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/minimize")]
        public async Task SetMinimize(HttpListenerContext ctx)
        {
            _window.Dispatcher.Invoke(() =>
            {
                _window.WindowState = WindowState.Minimized;
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/loop")]
        public async Task SetLoopType(HttpListenerContext ctx)
        {
            string loopType = ctx.Request.DataAsString();
            _window.Dispatcher.Invoke(() =>
            {
                _window.SetMusicLoopType(loopType);
            });
            await SendString(ctx, "");
        }

        [Router("/exit")]
        public async Task SetClose(HttpListenerContext ctx)
        {
            _window.Dispatcher.Invoke(() =>
            {
                _window.ExitApp(null, null);
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/hide")]
        public async Task SetHide(HttpListenerContext ctx)
        {
            _window.Dispatcher.Invoke(() =>
            {
                _window.WindowState = WindowState.Minimized;
                _window.Hide();
            });
            string text = GetWindowInfoText();
            await SendString(ctx, text, "text/json");
        }

        [Router("/fonts")]
        public async Task InstalledFonts(HttpListenerContext ctx)
        {
            await SendString(ctx, installChineseFontsJson, "text/json");
        }

        [Router("/image")]
        public async Task MusicImage(HttpListenerContext ctx)
        {
            var filePath = ctx.Request.QueryString["path"];
            if(string.IsNullOrWhiteSpace(filePath) || !File.Exists(filePath))
            {
                await SendString(ctx, string.Empty, statusCode: HttpStatusCode.NotFound);
                return;
            }
            try
            {
                AudioTag audioTag = AudioTag.ReadTag(filePath, true);
                string mime = audioTag.GetPictureType();
                if (!string.IsNullOrWhiteSpace(mime))
                {
                    ctx.Response.ContentType = mime;
                    ctx.Response.StatusCode = (int)HttpStatusCode.OK;
                    await WriteResponse(ctx, audioTag.GetPicture());
                    return;
                }
            }
            catch (Exception)
            {
            }
            await SendString(ctx, string.Empty, statusCode: HttpStatusCode.NotFound);
        }

        [Router("/theme")]
        public async Task SetTheme(HttpListenerContext ctx)
        {
            string themeString = ctx.Request.QueryString["theme"];
            int.TryParse(themeString, out int preferredColorScheme);
            _window.Dispatcher.Invoke(() =>
            {
                _window.SetTheme(preferredColorScheme);
            });
            await SendString(ctx, string.Empty);
        }

        [Router("/lyric")]
        public async Task SetLyric(HttpListenerContext ctx)
        {
            LyricOptions options = JsonConvert.DeserializeObject<LyricOptions>(ctx.Request.DataAsString());
            _window.Dispatcher.Invoke(() =>
            {
                _window.SetLyric(options);
            });
            await SendString(ctx, string.Empty);
        }

        [Router("/lyricline")]
        public async Task SetLyricLine(HttpListenerContext ctx)
        {
            string line = ctx.Request.DataAsString();
            if (!string.IsNullOrWhiteSpace(line))
            {
                string durationString = ctx.Request.QueryString["duration"] ?? string.Empty;
                double.TryParse(durationString, out double duration);
                _window.Dispatcher.Invoke(() =>
                {
                    _window.SetLyricLine(line, duration);
                });
            }
            await SendString(ctx, string.Empty);
        }

        [Router("/hotkey")]
        public async Task RegisterHostkey(HttpListenerContext ctx)
        {
            string cancelString = ctx.Request.QueryString["cancel"] ?? string.Empty;
            bool cancel = cancelString == "1" || cancelString.ToLower() == "true";
            Hotkey.ShortcutKey[] shortcutKeys = JsonConvert.DeserializeObject<Hotkey.ShortcutKey[]>(ctx.Request.DataAsString());
            Dictionary<string, string> registerResult = new Dictionary<string, string>();
            _window.Dispatcher.Invoke(() =>
            {
                foreach (var shortcutKey in shortcutKeys)
                {
                    if (cancel)
                    {
                        registerResult.Add(shortcutKey.Type, _window.RemoveHotkey(shortcutKey.Type) ? string.Empty : "取消热键注册失败");
                    }
                    else
                    {
                        registerResult.Add(shortcutKey.Type, _window.RegisterHotkey(shortcutKey));
                    }
                }
            });
            Dictionary<string, object> result = new Dictionary<string, object>()
            {
                { "data",  registerResult},
                { "type",  "hotkey"}
            };
            string text = JsonConvert.SerializeObject(result);
            await SendString(ctx, text, "text/json");
        }

        private string GetWindowInfoText()
        {
            Dictionary<string, object> data = new Dictionary<string, object>();
            _window.Dispatcher.Invoke(() =>
            {
                data.Add("width", _window.ActualWidth);
                data.Add("height", _window.ActualHeight);
                data.Add("x", _window.Left);
                data.Add("y", _window.Top);
                data.Add("maximized", _window.WindowState == WindowState.Maximized);
                data.Add("minimize", _window.WindowState == WindowState.Minimized);
            });
            Dictionary<string, object> result = new Dictionary<string, object>()
            {
                { "data",  data},
                { "type",  "window"}
            };
            string text = JsonConvert.SerializeObject(result);
            return text;
        }

        [Router("/proxy")]
        public static async Task Proxy(HttpListenerContext ctx)
        {
            ProxyResponseData proxyResData;
            string queryUrl = ctx.Request.QueryString["url"] ?? string.Empty;
            var proxyData = ProxyRequestData.Parse(string.IsNullOrWhiteSpace(queryUrl) ? ctx.Request.DataAsString() : queryUrl);
            Logger.Logger.Debug("HttpProxy", proxyData.Method, proxyData.Url);
            proxyResData = await HttpProxy.Request(proxyData);
            Logger.Logger.Debug("HttpProxy", proxyData.Url, proxyResData.Data.Length, proxyResData.ContentLength);
            if (proxyResData.StatusCode > 300 && proxyResData.StatusCode < 310)
            {
                ctx.Response.StatusCode = 200;
                ctx.Response.ContentType = "application/json";
                await WriteResponse(ctx, proxyResData.Headers);
            }
            else
            {
                ctx.Response.SetHeaders(proxyResData.Headers);
                ctx.Response.StatusCode = proxyResData.StatusCode;
                ctx.Response.ContentType = proxyResData.ContentType;
                if (proxyResData.Stream != null)
                {
                    await WriteResponse(ctx, proxyResData.Stream, proxyResData.ContentLength);
                }
                else
                {
                    await WriteResponse(ctx, proxyResData.Data);
                }
            }
            return;
        }

        private async Task SendStatus(HttpListenerContext ctx)
        {
            string text = JsonConvert.SerializeObject(await GetStatus());
            await SendString(ctx, text, "text/json");
        }

        private static async Task SendString(HttpListenerContext ctx, string msg, string contentType = "text/plain;charset=utf-8", HttpStatusCode statusCode = HttpStatusCode.OK)
        {
            ctx.Response.StatusCode = (int)statusCode;
            ctx.Response.ContentType = contentType;
            await WriteResponse(ctx, msg);
            return;
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, byte[] data)
        {
            try
            {
                ctx.Response.ContentLength64 = data.Length;
                await ctx.Response.OutputStream.WriteAsync(data, 0, data.Length);
                return true;
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Send Response Error: ", ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, Dictionary<string, string> data)
        {
            try
            {
                string res = JsonConvert.SerializeObject(data);
                byte[] bytes = Encoding.UTF8.GetBytes(res);
                ctx.Response.ContentLength64 = bytes.Length;
                await ctx.Response.OutputStream.WriteAsync(bytes, 0, bytes.Length);
                return true;
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Send Response Error: ", ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, Stream stream, long length)
        {
            try
            {
                if (length > 0)
                {
                    ctx.Response.ContentLength64 = length;
                }
                await stream.CopyToAsync(ctx.Response.OutputStream);
                stream.Close();
                return true;
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Send Response Stream Error: ", ex);
                return false;
            }
        }

        private static async Task<bool> WriteResponse(HttpListenerContext ctx, string message)
        {
            var data = Encoding.UTF8.GetBytes(message);
            return await WriteResponse(ctx, data);
        }

        public async Task Handle(HttpListenerContext context)
        {
            if (context.Request.HttpMethod.ToUpper() == "OPTIONS")
            {
                context.Response.Close();
                return;
            }
            string router = context.Request.Url?.LocalPath.TrimEnd('/') ?? "*";
            routers.TryGetValue(router.ToUpper(), out Func<HttpListenerContext, Task> func);
            if (func == null)
            {
                func = routers["*"];
            }
            try
            {
                if (func == null)
                {
                    context.Response.StatusCode = (int)HttpStatusCode.NotFound;
                }
                else
                {
                    await func(context);
                }
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Handle Http Error: ", ex);
            }
            finally { context.Response.Close(); }
        }
    }
}
