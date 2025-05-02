using Musiche.Audio;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Musiche.Server
{
    public class Handler
    {
        protected readonly AudioPlay _audioPlay;
        protected readonly MediaMetaManager _mediaMetaManager;
        protected readonly MainWindow _window;
        public Handler(MainWindow window, AudioPlay audioPlay, MediaMetaManager mediaMetaManager) : this(window, audioPlay)
        {
            _mediaMetaManager = mediaMetaManager;
        }
        public Handler(MainWindow window, AudioPlay audioPlay)
        {
            _window = window;
            _audioPlay = audioPlay;
        }

        protected async Task<Dictionary<string, object>> GetStatus()
        {
            Dictionary<string, object> data = new Dictionary<string, object>();
            await _audioPlay.Dispatcher.InvokeAsync(() =>
            {
                data.Add("volume", _audioPlay.Volume);
                data.Add("currentTime", _audioPlay.CurrentTime);
                data.Add("totalTime", _audioPlay.TotalTime);
                data.Add("playing", _audioPlay.Playing);
                data.Add("stopped", _audioPlay.Stopped);
                data.Add("progress", _audioPlay.Progress);
            });
            return new Dictionary<string, object>()
            {
                { "data",  data}
            };
        }
    }
}
