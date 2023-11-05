using Musiche.Server;
using Musiche.Utils;
using System;
using System.Windows.Media;
using System.Windows.Shell;

namespace Musiche
{
    public class TaskbarInfo
    {
        readonly ThumbButtonInfo ToolBarPlayPauseButton;
        readonly ImageSource iconPlay = Properties.Resources.tool_play.ToBitmapSource();
        readonly ImageSource iconPause = Properties.Resources.tool_pause.ToBitmapSource();
        readonly WebSocketHandler webSocketHandler;

        readonly TaskbarItemInfo _taskbarInfo;
        public TaskbarItemInfo TaskbarItemInfo => _taskbarInfo;
        public TaskbarInfo(WebSocketHandler webSocketHandler)
        {
            this.webSocketHandler = webSocketHandler;

            _taskbarInfo = new TaskbarItemInfo();
            ToolBarPlayPauseButton = new ThumbButtonInfo()
            {
                ImageSource = iconPlay,
                Description = "播放",
            };
            ThumbButtonInfo toolBarLastButton = new ThumbButtonInfo()
            {
                ImageSource = Properties.Resources.tool_last.ToBitmapSource(),
                Description = "上一首",
            };
            ThumbButtonInfo toolBarNextButton = new ThumbButtonInfo()
            {
                ImageSource = Properties.Resources.tool_next.ToBitmapSource(),
                Description = "下一首",
            };
            ToolBarPlayPauseButton.Click += AudioPlayPause;
            toolBarLastButton.Click += AudioLast;
            toolBarNextButton.Click += AudioNext;
            _taskbarInfo.ThumbButtonInfos.Add(toolBarLastButton);
            _taskbarInfo.ThumbButtonInfos.Add(ToolBarPlayPauseButton);
            _taskbarInfo.ThumbButtonInfos.Add(toolBarNextButton);
        }

        public void AudioPlayStateChanged(bool playing)
        {
            if (playing)
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
            webSocketHandler.SendMessage("{\"type\": \"playOrPause\"}");
        }

        private void AudioNext(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"next\"}");
        }

        private void AudioLast(object sender, EventArgs e)
        {
            webSocketHandler.SendMessage("{\"type\": \"last\"}");
        }
    }
}
