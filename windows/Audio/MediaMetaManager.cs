using NAudio.Wave;
using System;
using System.Windows.Threading;
#if NETFRAMEWORK
using Windows.Media;
using Windows.Media.Playback;
#endif

namespace Musiche.Audio
{
    public delegate void AudioStatusChangedEventHandler(object sender, string message);
    public class MediaMetaManager
    {
        private readonly Dispatcher _dispatcher;
        public Dispatcher Dispatcher => _dispatcher;
        public event AudioStatusChangedEventHandler AudioStatusChanged;
#if NETFRAMEWORK
        private static readonly bool _supported = true;
#else
        private static readonly bool _supported = false;
#endif
        public static bool Supported => _supported;
        public MediaMetaManager()
        {
            _dispatcher = Dispatcher.CurrentDispatcher;
#if NETFRAMEWORK
            _mediaPlayer = new MediaPlayer();
            _systemMediaTransportControls = _mediaPlayer.SystemMediaTransportControls;
            _mediaPlayer.CommandManager.IsEnabled = false;
            _systemMediaTransportControls.IsEnabled = true;
            _systemMediaTransportControls.ButtonPressed += OnMediaTransportControlClick;
            _systemMediaTransportControls.IsRecordEnabled = false;
            _systemMediaTransportControls.IsStopEnabled = false;
            _systemMediaTransportControls.IsNextEnabled = true;
            _systemMediaTransportControls.IsPauseEnabled = true;
            _systemMediaTransportControls.IsPreviousEnabled = true;
            _systemMediaTransportControls.IsPlayEnabled = true;
            _systemMediaTimelineProperties = new SystemMediaTransportControlsTimelineProperties();
        }
        readonly MediaPlayer _mediaPlayer;
        readonly SystemMediaTransportControls _systemMediaTransportControls;
        readonly SystemMediaTransportControlsTimelineProperties _systemMediaTimelineProperties;

        private void OnMediaTransportControlClick(SystemMediaTransportControls sender, SystemMediaTransportControlsButtonPressedEventArgs args)
        {
            string message = string.Empty;
            switch (args.Button)
            {
                case SystemMediaTransportControlsButton.Play:
                    message = "play";
                    break;
                case SystemMediaTransportControlsButton.Pause:
                case SystemMediaTransportControlsButton.Stop:
                    message = "pause";
                    break;
                case SystemMediaTransportControlsButton.Previous:
                    message = "last";
                    break;
                case SystemMediaTransportControlsButton.Next:
                    message = "next";
                    break;
                case SystemMediaTransportControlsButton.Record:
                case SystemMediaTransportControlsButton.FastForward:
                case SystemMediaTransportControlsButton.Rewind:
                case SystemMediaTransportControlsButton.ChannelUp:
                case SystemMediaTransportControlsButton.ChannelDown:
                    break;
            }
            if(!string.IsNullOrWhiteSpace(message))
            {
                AudioStatusChanged?.Invoke(this, message);
            }
        }
#else
        }
#endif
        public void SetMediaMeta(MediaMetadata metadata)
        {
#if NETFRAMEWORK
            try
            {
                if (_systemMediaTransportControls.DisplayUpdater.Type != MediaPlaybackType.Music)
                {
                    // 如果尚未初始化，则初始化
                    _systemMediaTransportControls.DisplayUpdater.Type = MediaPlaybackType.Music;
                }
                _systemMediaTransportControls.DisplayUpdater.MusicProperties.Title = metadata.Title;
                _systemMediaTransportControls.DisplayUpdater.MusicProperties.AlbumTitle = metadata.Album;
                _systemMediaTransportControls.DisplayUpdater.MusicProperties.AlbumArtist = metadata.Artist;
                _systemMediaTransportControls.DisplayUpdater.MusicProperties.Artist = metadata.Artist;
                if (metadata.Artwork != null && metadata.Artwork.Length > 0)
                {
                    _systemMediaTransportControls.DisplayUpdater.Thumbnail = Windows.Storage.Streams.RandomAccessStreamReference.CreateFromUri(new Uri(metadata.Artwork[0].Src));
                }
                else
                {
                    _systemMediaTransportControls.DisplayUpdater.Thumbnail = null;
                }
                _systemMediaTransportControls.DisplayUpdater.Update();
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("SetMediaMeta error", ex);
            }
#endif
        }

        public void SetMediaControlPlayState(PlaybackState playbackState)
        {
#if NETFRAMEWORK
            switch (playbackState)
            {
                //case PlaybackState.Stopped: 
                //case PlaybackState.Paused:
                //    _systemMediaTransportControls.PlaybackStatus = MediaPlaybackStatus.Paused;
                //    break;
                case PlaybackState.Playing:
                    _systemMediaTransportControls.PlaybackStatus = MediaPlaybackStatus.Playing;
                    break;
                default:
                    _systemMediaTransportControls.PlaybackStatus = MediaPlaybackStatus.Paused;
                    break;
            }
#endif
        }

        public void UpdateMediaControlTimeline(TimeSpan position, TimeSpan endTime)
        {
#if NETFRAMEWORK
            _systemMediaTimelineProperties.StartTime = TimeSpan.Zero;
            _systemMediaTimelineProperties.EndTime = endTime;
            _systemMediaTimelineProperties.Position = position;
            _systemMediaTimelineProperties.MinSeekTime = TimeSpan.Zero;
            _systemMediaTimelineProperties.MaxSeekTime = endTime;
            _systemMediaTransportControls.UpdateTimelineProperties(_systemMediaTimelineProperties);
#endif
        }

        public void UpdateMediaControlPosition(TimeSpan position)
        {
#if NETFRAMEWORK
            _systemMediaTimelineProperties.Position = position;
            _systemMediaTransportControls.UpdateTimelineProperties(_systemMediaTimelineProperties);
#endif
        }
    }
}
