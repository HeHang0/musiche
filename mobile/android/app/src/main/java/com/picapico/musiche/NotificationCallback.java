package com.picapico.musiche;

import android.support.v4.media.session.MediaSessionCompat;

import io.flutter.plugin.common.EventChannel;

public class NotificationCallback extends MediaSessionCompat.Callback {
    EventChannel.EventSink mOperateEventSink;
    public void setEventSink(EventChannel.EventSink eventSink){
        mOperateEventSink = eventSink;
    }
    private void sendEvent(String action){
        if(mOperateEventSink == null) return;
        mOperateEventSink.success(action);
    }
    private void sendEvent(long pos){
        if(mOperateEventSink == null) return;
        mOperateEventSink.success(pos);
    }
    public void onAction(String action){
        sendEvent(action);
    }
    @Override
    public void onPlay() {
        sendEvent(NotificationActions.ACTION_PLAY);
    }

    @Override
    public void onPause() {
        sendEvent(NotificationActions.ACTION_PAUSE);
    }

    @Override
    public void onSkipToNext() {
        sendEvent(NotificationActions.ACTION_NEXT);
    }

    @Override
    public void onSkipToPrevious() {
        sendEvent(NotificationActions.ACTION_PREVIOUS);
    }

    @Override
    public void onStop() {
        sendEvent(NotificationActions.ACTION_PAUSE);
    }

    @Override
    public void onSeekTo(long pos) {
        sendEvent(pos);
    }
}
