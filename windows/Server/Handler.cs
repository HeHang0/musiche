using Musiche.Audio;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Windows;

namespace Musiche.Server
{
    public class Handler
    {
        protected readonly AudioPlay audioPlay;
        protected readonly MainWindow window;
        public Handler(MainWindow window, AudioPlay audioPlay)
        {
            this.window = window;
            this.audioPlay = audioPlay;
        }

        protected async Task<Dictionary<string, object>> GetStatus()
        {
            Dictionary<string, object> data = new Dictionary<string, object>();
            await audioPlay.Dispatcher.InvokeAsync(() =>
            {
                data.Add("volume", audioPlay.Volume);
                data.Add("currentTime", audioPlay.CurrentTime);
                data.Add("totalTime", audioPlay.TotalTime);
                data.Add("playing", audioPlay.Playing);
                data.Add("stopped", audioPlay.Stopped);
                data.Add("progress", audioPlay.Progress);
            });
            return new Dictionary<string, object>()
            {
                { "data",  data}
            };
        }
    }
}
