using NAudio.Wave;
using System;
using System.Windows.Threading;

#if NETFRAMEWORK
using Windows.Media;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;
using System.Windows.Interop;
using System.Windows;
#endif

namespace Musiche.Audio
{
    public delegate void AudioStatusChangedEventHandler(object sender, string message);
    public class MediaMetaManager : IDisposable
    {
        private readonly Dispatcher _dispatcher;
        public Dispatcher Dispatcher => _dispatcher;
        public event AudioStatusChangedEventHandler AudioStatusChanged;
#if NETFRAMEWORK
        private static void InitProgramsLnk()
        {
            string startupFolderPath = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
            string appPath = Process.GetCurrentProcess()?.MainModule.FileName ?? string.Empty;
            if (string.IsNullOrWhiteSpace(appPath)) return;
            string lnkPath = Path.Combine(startupFolderPath, Path.GetFileNameWithoutExtension(appPath) + ".lnk");
            var exists = File.Exists(lnkPath);
            if (exists)
            {
                var linkFile = ShellLink.Shortcut.ReadFromFile(lnkPath);
                if (linkFile.ExtraData.EnvironmentVariableDataBlock.TargetUnicode == lnkPath)
                {
                    return;
                }
                File.Delete(lnkPath);
            }
            ShellLink.Shortcut.CreateShortcut(appPath, "startup").WriteToFile(lnkPath);
        }

        static MediaMetaManager()
        {
            try
            {
                InitProgramsLnk();
            }
            catch (Exception ex)
            {
                Logger.Logger.Error("Init Programs Lnk Error", ex);
            }
        }
        private static readonly bool _supported = true;
#else
        private static readonly bool _supported = false;
#endif
        public static bool Supported => _supported;
        public MediaMetaManager()
        {
            _dispatcher = Dispatcher.CurrentDispatcher;
        }

#if NETFRAMEWORK
        SystemMediaTransportControls _systemMediaTransportControls;
        SystemMediaTransportControlsTimelineProperties _systemMediaTimelineProperties;

        [Guid("ddb0472d-c911-4a1f-86d9-dc3d71a95f5a")]
        [InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
        interface ISystemMediaTransportControlsInterop
        {
            SystemMediaTransportControls GetForWindow(IntPtr Window, in Guid riid);
        }

        private void InitMediaPlay()
        {
            var smtcInterop = (ISystemMediaTransportControlsInterop)WindowsRuntimeMarshal.GetActivationFactory(typeof(SystemMediaTransportControls));
            IntPtr hWnd = new WindowInteropHelper(Application.Current.MainWindow).Handle;
            _systemMediaTransportControls = smtcInterop.GetForWindow(hWnd, new Guid("99FA3FF4-1742-42A6-902E-087D41F965EC"));
            _systemMediaTransportControls.IsEnabled = true;
            _systemMediaTransportControls.ButtonPressed += OnMediaTransportControlClick;
            _systemMediaTransportControls.PropertyChanged += OnMediaTransportControlPropertyChanged;
            _systemMediaTransportControls.IsRecordEnabled = false;
            _systemMediaTransportControls.IsStopEnabled = false;
            _systemMediaTransportControls.IsNextEnabled = true;
            _systemMediaTransportControls.IsPauseEnabled = true;
            _systemMediaTransportControls.IsPreviousEnabled = true;
            _systemMediaTransportControls.IsPlayEnabled = true;
            _systemMediaTimelineProperties = new SystemMediaTransportControlsTimelineProperties();
        }

        private void OnMediaTransportControlPropertyChanged(SystemMediaTransportControls sender, SystemMediaTransportControlsPropertyChangedEventArgs args)
        {
        }

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
            if (!string.IsNullOrWhiteSpace(message))
            {
                AudioStatusChanged?.Invoke(this, message);
            }
        }
#endif
        MediaMetadata _metadata = null;
        public void SetMediaMeta(MediaMetadata metadata, bool playing)
        {
            _metadata = metadata;
#if NETFRAMEWORK
            try
            {
                if (_systemMediaTransportControls == null)
                {
                    InitMediaPlay();
                }
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
            if (_systemMediaTransportControls == null)
            {
                InitMediaPlay();
                if (_metadata != null) SetMediaMeta(_metadata, playbackState == PlaybackState.Playing);
            }
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
            if (_systemMediaTransportControls == null) return;
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
            if (_systemMediaTransportControls == null) return;
            _systemMediaTimelineProperties.Position = position;
            _systemMediaTransportControls.UpdateTimelineProperties(_systemMediaTimelineProperties);
#endif
        }

        public void Dispose()
        {
        }
    }
}
