using NAudio.Wave;
using System;
using System.Windows.Threading;

namespace Musiche.Audio
{
    public delegate void PlatStateChangedEventHandler(object sender, PlaybackState state);
    public class AudioPlay
    {
        AudioFileReader mediaFoundationReader = null;
        WaveOut wasapiOut = null;
        public event PlatStateChangedEventHandler PlatStateChanged;
        public Dispatcher Dispatcher;
        readonly DispatcherTimer fadeInTimer;
        float fadeInVolume = 0;
        bool fadeIn = false;
        public AudioPlay()
        {
            Dispatcher = Dispatcher.CurrentDispatcher;
            fadeInTimer = new DispatcherTimer();
            fadeInTimer.Interval = TimeSpan.FromMilliseconds(100);
            fadeInTimer.Tick += OnFadeInTimerTick;
            wasapiOut = new WaveOut();
        }

        private void OnFadeInTimerTick(object sender, EventArgs e)
        {
            if (fadeInVolume > 0 && fadeInVolume > wasapiOut.Volume && fadeInVolume <= 1)
            {
                wasapiOut.Volume = (float)Math.Min(fadeInVolume, wasapiOut.Volume + 0.1);
                Logger.Logger.Debug("设置淡入声音", wasapiOut.Volume);
            }
            else
            {
                fadeInVolume = 0;
                (sender as DispatcherTimer).Stop();
                Logger.Logger.Debug("结束淡入声音", fadeInVolume);
            }
        }

        private void WasapiOut_PlaybackStopped(object sender, StoppedEventArgs e)
        {
            PlatStateChanged?.Invoke(this, PlaybackState.Stopped);
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
                mediaFoundationReader = new AudioFileReader(url);
                wasapiOut = new WaveOut();
                wasapiOut.PlaybackStopped += WasapiOut_PlaybackStopped;
                wasapiOut.Init(mediaFoundationReader);
                RunFadeIn();
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

        private void RunFadeIn()
        {
            if (fadeIn)
            {
                fadeInVolume = _volume * 1.0f / 100;
                wasapiOut.Volume = 0;
                fadeInTimer.Start();
                Logger.Logger.Debug("开始淡入声音", fadeInVolume);
            }
            else
            {
                Volume = _volume;
            }
        }

        public void Play()
        {
            if (mediaFoundationReader != null)
            {
                RunFadeIn();
                wasapiOut?.Play();
                PlatStateChanged?.Invoke(this, wasapiOut?.PlaybackState ?? PlaybackState.Stopped);
            }
        }

        public void SetFadeIn(bool fadeIn)
        {
            this.fadeIn = fadeIn;
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
                if (fadeInVolume > 0) return (int)(fadeInVolume * 100);
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
