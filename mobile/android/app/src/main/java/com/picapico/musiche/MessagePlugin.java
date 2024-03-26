package com.picapico.musiche;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.ComponentName;
import android.content.ContentUris;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.SharedPreferences;
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
import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

public class MessagePlugin implements FlutterPlugin {
    private static final String TAG = "MusicheMessagePlugin";
    private static final String CHANNEL = "musiche-method-channel";
    private static final String METHOD_BACK_TO_HOME = "back-to-home";
    private static final String METHOD_MEDIA_AUDIO_ALL = "media-audio-all";
    private static final String METHOD_MEDIA_THUMBNAIL = "media-thumbnail";
    private static final String METHOD_LYRIC_OPTIONS = "lyric-options";
    private static final String METHOD_LYRIC_LINE = "lyric-line";
    private static final String METHOD_STATUS_BAR_THEME = "status-bar-theme";
    private static final String METHOD_SAVE_THEME = "save-theme";
    private FlutterPluginBinding mBinding;
    private boolean isServiceBound = false;
    private Activity mCurrentActivity;
    private SharedPreferences mPreferences;
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
        switch (call.method) {
            case METHOD_BACK_TO_HOME:
                if(mBackToHomeListener != null) {
                    mBackToHomeListener.onBackToHome();
                }
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
            case METHOD_SAVE_THEME:
                final boolean dark = Boolean.TRUE.equals(call.argument("dark"));
                final boolean auto = Boolean.TRUE.equals(call.argument("auto"));
                final boolean saved = Boolean.TRUE.equals(call.argument("saved"));
                final boolean bar = METHOD_STATUS_BAR_THEME.equals(call.method);
                if(bar && mCurrentActivity != null) {
                    SystemBarEdge.setEdgeToEdge(mCurrentActivity.getWindow(), dark);
                }
                if(saved || !bar) saveTheme(dark, auto);
                break;
            case METHOD_MEDIA_AUDIO_ALL:
                result.success(getAllAudios());
                return;
            case METHOD_MEDIA_THUMBNAIL:
                String uri = call.argument("uri");
                result.success(getThumbnail(uri));
                return;
        }
        result.success(null);
    }

    private void saveTheme(boolean dark, boolean auto){
        if(mPreferences != null){
            mPreferences.edit().putBoolean("dark", dark).putBoolean("auto", auto).apply();
        }
        SystemBarEdge.setDarkMode(mBinding.getApplicationContext(), dark, auto);
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
        mPreferences = binding.getApplicationContext().getSharedPreferences("config", Context.MODE_PRIVATE);
        MethodChannel mMethodChannel = new MethodChannel(binding.getBinaryMessenger(), CHANNEL);
        mMethodChannel.setMethodCallHandler(this::onMethodCall);
    }

    @Override
    public void onDetachedFromEngine(@NonNull FlutterPluginBinding binding) {
        if (isServiceBound) {
            mBinding.getApplicationContext().unbindService(mServiceConnection);
            isServiceBound = false;
        }
        if(binding.equals(mBinding)) mBinding = null;
    }

    private final ServiceConnection mServiceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName className, IBinder service) {
            isServiceBound = true;
        }

        @Override
        public void onServiceDisconnected(ComponentName arg0) {
            isServiceBound = false;
        }
    };
}
