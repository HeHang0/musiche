using NAudio.Wave;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Threading;

namespace Musiche.Audio
{
    public delegate void PlatStateChangedEventHandler(object sender, PlaybackState state);
    public class AudioPlay
    {
        MediaFoundationReader mediaFoundationReader = null;
        WaveOut wasapiOut = null;
        public event PlatStateChangedEventHandler PlatStateChanged;
        public Dispatcher Dispatcher;
        public AudioPlay()
        {
            Dispatcher = Dispatcher.CurrentDispatcher;
            wasapiOut = new WaveOut();
        }

        private void WasapiOut_PlaybackStopped(object sender, StoppedEventArgs e)
        {
            mediaFoundationReader.Position = 0;
            mediaFoundationReader?.Close();
            mediaFoundationReader?.Dispose();
            mediaFoundationReader = null;
            wasapiOut.PlaybackStopped -= WasapiOut_PlaybackStopped;
        }

        public void Play(string url)
        {
            if (string.IsNullOrEmpty(url))
            {
                Play();
                return;
            }
            wasapiOut?.Stop();
            wasapiOut?.Dispose();
            try
            {
                mediaFoundationReader = new MediaFoundationReader(url);
                wasapiOut = new WaveOut();
                Volume = _volume;
                wasapiOut.PlaybackStopped += WasapiOut_PlaybackStopped;
                wasapiOut.Init(mediaFoundationReader);
                wasapiOut?.Play();
                if (_progress > 0)
                {
                    Progress = _progress;
                }
            }
            catch (Exception)
            {
            }
            PlatStateChanged?.Invoke(this, wasapiOut?.PlaybackState ?? PlaybackState.Stopped);
        }

        public void Play()
        {
            if (mediaFoundationReader != null)
            {
                wasapiOut?.Play();
                PlatStateChanged?.Invoke(this, wasapiOut?.PlaybackState ?? PlaybackState.Stopped);
            }
        }

        public void Pause()
        {
            if (mediaFoundationReader == null) return;
            wasapiOut?.Pause();
            PlatStateChanged?.Invoke(this, wasapiOut?.PlaybackState ?? PlaybackState.Stopped);
        }

        public string CurrentTime
        {
            get
            {
                return mediaFoundationReader?.CurrentTime.ToString("mm\\:ss") ?? "";
            }
        }

        public string TotalTime
        {
            get
            {
                return mediaFoundationReader?.TotalTime.ToString("mm\\:ss") ?? "";
            }
        }

        public bool Playing
        {
            get
            {
                return wasapiOut?.PlaybackState == PlaybackState.Playing;
            }
        }

        public bool Stopped
        {
            get
            {
                return (wasapiOut?.PlaybackState ?? PlaybackState.Stopped) == PlaybackState.Stopped;
            }
        }

        public int _volume = 100;
        public int Volume
        {
            get
            {
                return _volume;
            }
            set
            {
                _volume = value;
                if (wasapiOut == null) return;
                if (value < 0) wasapiOut.Volume = 0;
                else if (value > 100) wasapiOut.Volume = 1;
                wasapiOut.Volume = value * 1f / 100;
            }
        }

        private int _progress = 0;
        public int Progress
        {
            get
            {
                if (mediaFoundationReader == null) return _progress;
                return (int)Math.Round((double)mediaFoundationReader.Position * 1000 / mediaFoundationReader.Length);
            }
            set
            {
                if (value < 0 || value > 1000) value = 0;
                if (mediaFoundationReader == null)
                {
                    _progress = value;
                }
                else
                {
                    _progress = 0;
                    mediaFoundationReader.Position = (long)(mediaFoundationReader.Length * (value * 1.0 / 1000));
                }
            }
        }
    }
}
