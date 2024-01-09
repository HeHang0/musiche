package com.picapico.musiche;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.IBinder;
import android.provider.MediaStore;
import android.util.Log;
import android.util.Size;

import androidx.annotation.NonNull;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;

import io.flutter.embedding.engine.plugins.FlutterPlugin;
import io.flutter.plugin.common.EventChannel;
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

public class MessagePlugin implements FlutterPlugin {
    private static final String TAG = "MusicheMessagePlugin";
    private static final String CHANNEL = "musiche-method-channel";
    private static final String METHOD_BACK_TO_HOME = "back-to-home";
    private static final String METHOD_MEDIA_METADATA = "media-metadata";
    private static final String METHOD_MEDIA_POSITION = "media-position";
    private static final String METHOD_MEDIA_AUDIO_ALL = "media-audio-all";
    private static final String METHOD_MEDIA_THUMBNAIL = "media-thumbnail";
    private static final String METHOD_LYRIC_OPTIONS = "lyric-options";
    private static final String METHOD_LYRIC_LINE = "lyric-line";
    private static final String METHOD_STATUS_BAR_THEME = "status-bar-theme";
    private static final String CHANNEL_MEDIA_OPERATE = "media-operate";
    private FlutterPluginBinding mBinding;
    private boolean isServiceBound = false;
    private final NotificationCallback mMediaSessionCallback = new NotificationCallback();
    private Activity mCurrentActivity;
    public interface OnBackToHomeListener {
        void onBackToHome();
    }
    private OnBackToHomeListener mBackToHomeListener;
    public void setOnBackToHomeListener(OnBackToHomeListener listener){
        mBackToHomeListener = listener;
    }

    public void setCurrentActivity(Activity activity){
        mCurrentActivity = activity;
    }

    private void onMethodCall(MethodCall call, MethodChannel.Result result){
        Integer position;
        boolean playing;
        switch (call.method) {
            case METHOD_BACK_TO_HOME:
                if(mBackToHomeListener != null) {
                    mBackToHomeListener.onBackToHome();
                }
                break;
            case METHOD_MEDIA_METADATA:
                final String title = call.argument("title");
                final String artist = call.argument("artist");
                final String album = call.argument("album");
                final String artwork = call.argument("artwork");
                final Integer duration = call.argument("duration");
                position = call.argument("position");
                playing = Boolean.TRUE.equals(call.argument("playing"));
                boolean lover = Boolean.TRUE.equals(call.argument("lover"));
                updateMetaData(title, artist, album, artwork, playing, lover, position, duration);
                break;
            case METHOD_MEDIA_POSITION:
                position = call.argument("position");
                playing = Boolean.TRUE.equals(call.argument("playing"));
                updateMetaData(playing, position);
                break;
            case METHOD_LYRIC_OPTIONS:
                final boolean show = Boolean.TRUE.equals(call.argument("show"));
                final String lyricTitle = call.argument("title");
                final Integer fontSize = call.argument("fontSize");
                final boolean fontBold = Boolean.TRUE.equals(call.argument("fontBold"));
                final String effectColor = call.argument("effectColor");
                final String fontColor = call.argument("fontColor");
                updateLyricOptions(show, lyricTitle, fontSize, fontBold, effectColor, fontColor);
                break;
            case METHOD_LYRIC_LINE:
                final String lyricLine = call.argument("line");
                updateLyricLine(lyricLine);
                break;
            case METHOD_STATUS_BAR_THEME:
                final boolean dark = Boolean.TRUE.equals(call.argument("dark"));
                if(mCurrentActivity != null) {
                    SystemBarEdge.setEdgeToEdge(mCurrentActivity.getWindow(), dark);
                }
                break;
            case METHOD_MEDIA_AUDIO_ALL:
                result.success(getAllAudios());
                break;
            case METHOD_MEDIA_THUMBNAIL:
                String uri = call.argument("uri");
                result.success(getThumbnail(uri));
                break;
        }
    }

    private void updateMetaData(boolean playing, Integer position){
        if(position == null) return;
        if(!playing && isServiceNotRunning(mBinding.getApplicationContext(), LyricService.class)) return;
        Intent intent = new Intent(mBinding.getApplicationContext(), NotificationService.class);
        intent.putExtra("playing", playing);
        intent.putExtra("position", position.intValue());
        mBinding.getApplicationContext().startService(intent);
        if(!isServiceBound) mBinding.getApplicationContext().bindService(intent, mServiceConnection, Context.BIND_AUTO_CREATE);
    }

    private void updateMetaData(
            String title, String artist, String album, String artwork,
            boolean playing, boolean lover, Integer position, Integer duration) {
        if(!playing && isServiceNotRunning(mBinding.getApplicationContext(), LyricService.class)) return;
        Intent intent = new Intent(mBinding.getApplicationContext(), NotificationService.class);
        intent.putExtra("playing", playing);
        intent.putExtra("lover", lover);
        intent.putExtra("title", title);
        intent.putExtra("artist", artist);
        intent.putExtra("album", album);
        intent.putExtra("artwork", artwork);
        if(position != null) {
            intent.putExtra("position", position.intValue());
        }
        if(duration != null) {
            intent.putExtra("duration", duration.intValue());
        }
        mBinding.getApplicationContext().startService(intent);
        if(!isServiceBound) mBinding.getApplicationContext().bindService(intent, mServiceConnection, Context.BIND_AUTO_CREATE);
    }

    private ArrayList<HashMap<String, Object>> getAllAudios(){
        ArrayList<HashMap<String, Object>> audioLists = new ArrayList<>();
        try {
            String[] strings = {
                    MediaStore.Audio.Media._ID,
                    MediaStore.Audio.Media.DISPLAY_NAME,
                    MediaStore.Audio.Media.ARTIST,
                    MediaStore.Audio.Media.ALBUM,
                    MediaStore.Audio.Media.DURATION,
                    MediaStore.Audio.Media.TITLE,
                    MediaStore.Audio.Media.DATA
            };

            Cursor cursor = mBinding.getApplicationContext().getContentResolver()
                    .query(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, strings,
                            null, null, null);
            if (cursor != null) {
                int idColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media._ID);
                int displayNameColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME);
                int artistColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ARTIST);
                int albumColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.ALBUM);
                int durationColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DURATION);
                int titleColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.TITLE);
                int dataColumn = cursor.getColumnIndexOrThrow(MediaStore.Audio.Media.DATA);
                if (cursor.moveToFirst()) {
                    do {
                        long id = cursor.getLong(idColumn);
                        String artist = cursor.getString(artistColumn);
                        String album = cursor.getString(albumColumn);
                        int duration = cursor.getInt(durationColumn);
                        String title = cursor.getString(titleColumn);
                        String displayName = cursor.getString(displayNameColumn);
                        String data = cursor.getString(dataColumn);
                        Uri contentUri = ContentUris.withAppendedId(
                                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id);
                        Log.i("音乐URI", String.format(
                                "名字：%s, 歌手：%s, 专辑：%s, 时间：%d, 标题：%s, id: %d, URI：%s, Data: %s",
                                displayName, artist, album, duration, title, id, contentUri, data));
                        if(title.isEmpty()) title = displayName;
                        HashMap<String, Object> song = new HashMap<>();
                        song.put("name", title);
                        song.put("singer", artist);
                        song.put("album", album);
                        song.put("duration", duration);
                        song.put("id", contentUri.toString());
                        song.put("url", data);
                        audioLists.add(song);
                    } while (cursor.moveToNext());
                }
                cursor.close();
            }
        }catch (Exception ignore){}
        return audioLists;
    }

    private byte[] getThumbnail(String uriString){
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            try {
                Bitmap thumbnail =
                        mBinding.getApplicationContext().getContentResolver().loadThumbnail(
                                Uri.parse(uriString), new Size(500, 500), null);
                ByteArrayOutputStream stream = new ByteArrayOutputStream();
                thumbnail.compress(Bitmap.CompressFormat.JPEG, 90, stream);
                byte[] imageData = stream.toByteArray();
                stream.close();
                return imageData;
            } catch (IOException e) {
                Log.e(TAG, "load thumbnail error: " + e);
            }
        }
        return null;
    }

    private void updateLyricOptions(boolean show, String title, Integer fontSize, boolean fontBold, String effectColor, String fontColor){
        int fontSizeInt = fontSize == null ? 22 : fontSize;
        if(!show){
            Intent intent = new Intent(mBinding.getApplicationContext(), LyricService.class);
            mBinding.getApplicationContext().stopService(intent);
            return;
        }
        Intent intent = new Intent(mBinding.getApplicationContext(), LyricService.class);
        intent.putExtra("title", title);
        intent.putExtra("fontSize", fontSizeInt);
        intent.putExtra("fontBold", fontBold);
        intent.putExtra("effectColor", effectColor);
        intent.putExtra("fontColor", fontColor);
        mBinding.getApplicationContext().startService(intent);
    }

    private void updateLyricLine(String line){
        if(isServiceNotRunning(mBinding.getApplicationContext(), LyricService.class)) return;
        Intent intent = new Intent(mBinding.getApplicationContext(), LyricService.class);
        intent.putExtra("action", "line");
        intent.putExtra("line", line);
        mBinding.getApplicationContext().startService(intent);
    }

    public static boolean isServiceNotRunning(Context context, Class<?> serviceClass) {
        ActivityManager manager = (ActivityManager) context.getSystemService(Context.ACTIVITY_SERVICE);
        if (manager != null) {
            for (ActivityManager.RunningServiceInfo service : manager.getRunningServices(Integer.MAX_VALUE)) {
                if (serviceClass.getName().equals(service.service.getClassName())) {
                    return false;
                }
            }
        }
        return true;
    }

    @Override
    public void onAttachedToEngine(@NonNull FlutterPluginBinding binding) {
        mBinding = binding;
        MethodChannel mMethodChannel = new MethodChannel(binding.getBinaryMessenger(), CHANNEL);
        mMethodChannel.setMethodCallHandler(this::onMethodCall);
        EventChannel mOperateEventChannel = new EventChannel(binding.getBinaryMessenger(), CHANNEL_MEDIA_OPERATE);
        mOperateEventChannel.setStreamHandler(new EventChannel.StreamHandler() {
            @Override
            public void onListen(Object arguments, EventChannel.EventSink events) {
                mMediaSessionCallback.setEventSink(events);
            }

            @Override
            public void onCancel(Object arguments) {

            }
        });
        NotificationReceiver.setOnActionReceiveListener(this::onMediaActionReceive);
    }

    private void onMediaActionReceive(String action) {
        switch (action) {
            case NotificationActions.ACTION_NEXT:
            case NotificationActions.ACTION_PREVIOUS:
            case NotificationActions.ACTION_PLAY_PAUSE:
            case NotificationActions.ACTION_PLAY:
            case NotificationActions.ACTION_PAUSE:
            case NotificationActions.ACTION_LOVER:
            case NotificationActions.ACTION_SHOW:
                mMediaSessionCallback.onAction(action);
                break;
        }
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        if (isServiceBound) {
            mBinding.getApplicationContext().unbindService(mServiceConnection);
            isServiceBound = false;
        }
        if(binding.equals(mBinding)) mBinding = null;
        NotificationReceiver.setOnActionReceiveListener(null);
    }

    private final ServiceConnection mServiceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            NotificationService.NotificationBinder binder = (NotificationService.NotificationBinder) service;
            binder.getService().setMediaSessionCallback(mMediaSessionCallback);
            isServiceBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            isServiceBound = false;
        }
    };
}
