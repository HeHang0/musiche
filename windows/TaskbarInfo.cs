﻿using Musiche.Audio;
using Musiche.Server;
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Shell;

namespace Musiche
{
    public class TaskbarInfo
    {
        ThumbButtonInfo ToolBarPlayPauseButton;
        readonly ImageSource iconPlay = GetBitmapSource(Properties.Resources.tool_play);
        readonly ImageSource iconPause = GetBitmapSource(Properties.Resources.tool_pause);
        readonly AudioPlay audioPlay;
        readonly WebSocketHandler webSocketHandler;

        readonly TaskbarItemInfo _taskbarInfo;
        public TaskbarItemInfo TaskbarItemInfo => _taskbarInfo;
        public TaskbarInfo(AudioPlay audioPlay, WebSocketHandler webSocketHandler)
        {
            this.audioPlay = audioPlay;
            this.webSocketHandler = webSocketHandler;

            _taskbarInfo = new TaskbarItemInfo();
            ToolBarPlayPauseButton = new ThumbButtonInfo()
            {
                ImageSource = iconPlay,
                Description = "播放",
            };
            ThumbButtonInfo toolBarLastButton = new ThumbButtonInfo()
            {
                ImageSource = GetBitmapSource(Properties.Resources.tool_last),
                Description = "上一首",
            };
            ThumbButtonInfo toolBarNextButton = new ThumbButtonInfo()
            {
                ImageSource = GetBitmapSource(Properties.Resources.tool_next),
                Description = "下一首",
            };
            ToolBarPlayPauseButton.Click += AudioPlayPause;
            toolBarLastButton.Click += AudioLast;
            toolBarNextButton.Click += AudioNext;
            _taskbarInfo.ThumbButtonInfos.Add(toolBarLastButton);
            _taskbarInfo.ThumbButtonInfos.Add(ToolBarPlayPauseButton);
            _taskbarInfo.ThumbButtonInfos.Add(toolBarNextButton);

            audioPlay.PlatStateChanged += AudioPlatStateChanged;
        }

        private void AudioPlatStateChanged(object sender, NAudio.Wave.PlaybackState state)
        {
            if (state == NAudio.Wave.PlaybackState.Playing)
            {
                ToolBarPlayPauseButton.ImageSource = iconPause;
                ToolBarPlayPauseButton.Description = "暂停";
            }
            else
            {
                ToolBarPlayPauseButton.ImageSource = iconPlay;
                ToolBarPlayPauseButton.Description = "播放";
            }
        }

        private void AudioPlayPause(object sender, EventArgs e)
        {
            if (audioPlay.Playing)
            {
                webSocketHandler.SendMessage("{\"type\": \"pause\"}");
            }
            else
            {
                webSocketHandler.SendMessage("{\"type\": \"play\"}");
            }
        }

        private void AudioNext(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"next\"}");
        }

        private void AudioLast(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"last\"}");
        }

        public static BitmapSource GetBitmapSource(Bitmap bmp)
        {
            BitmapFrame bf;

            using (MemoryStream ms = new MemoryStream())
            {
                bmp.Save(ms, System.Drawing.Imaging.ImageFormat.Png);
                bf = BitmapFrame.Create(ms, BitmapCreateOptions.None, BitmapCacheOption.OnLoad);
            }
            return bf;
        }
    }
}
