package com.picapico.musiche;

import android.annotation.SuppressLint;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.IBinder;
import android.preference.PreferenceManager;
import android.provider.Settings;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;

import androidx.annotation.Nullable;

public class LyricService extends Service implements View.OnTouchListener {
    private WindowManager mWindowManager;
    WindowManager.LayoutParams mWindowParams;
    private View mLiricView;
    private OutlinedTextView mLyricTextView;
    SharedPreferences mPreferences;
    private static final String positionKey = "lyric-position";

    @Override
    public void onCreate() {
        super.onCreate();
        mPreferences = PreferenceManager.getDefaultSharedPreferences(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId){
        String action = intent.getStringExtra("action");
        String line = intent.getStringExtra("line");
        String title = intent.getStringExtra("title");
        int fontSize = intent.getIntExtra("fontSize", 22);
        boolean fontBold = intent.getBooleanExtra("fontBold", false);
        String effectColor = intent.getStringExtra("effectColor");
        String fontColor = intent.getStringExtra("fontColor");
        if("line".equals(action)){
            updateLyricLine(line);
        }else {
            if(mLiricView == null) initView();
            if(mLiricView == null) return START_NOT_STICKY;
            updateLyricParam(fontSize, fontBold, effectColor, fontColor);
            updateLyricLine(title);
        }
        return START_NOT_STICKY;
    }

    private void updateLyricLine(String line) {
        if(mLyricTextView != null && line != null) {
            mLyricTextView.setText(line);
        }
    }

    final Typeface mFaceBold = Typeface.defaultFromStyle(Typeface.BOLD);
    final Typeface mFaceNormal = Typeface.defaultFromStyle(Typeface.NORMAL);
    private void updateLyricParam(int fontSize, boolean fontBold, String effectColor, String fontColor){
        if(mLyricTextView == null) return;
        if(!fontColor.isEmpty()){
            mLyricTextView.setTextColor(Color.parseColor(fontColor));
        }
        mLyricTextView.setTextSize(fontSize-4);
        mLyricTextView.setTypeface(fontBold ? mFaceBold : mFaceNormal);
        if(effectColor == null || effectColor.isEmpty()){
            mLyricTextView.setOutline(Color.TRANSPARENT, 0);
        }else {
            mLyricTextView.setOutline(Color.parseColor(effectColor), 3);
        }
    }

    public boolean hasPermission() {
        // 检查是否已经具有悬浮窗权限
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(this);
        }
        return true; // 在 Android 6.0 以下的版本默认具有悬浮窗权限
    }

    private void initView(){
        if(!hasPermission()){
            return;
        }
        mLiricView = LayoutInflater.from(this).inflate(R.layout.lyric_layout, null);
        mLyricTextView = mLiricView.findViewById(R.id.lyricText);
        // 初始化 WindowManager
        mWindowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

        // 设置悬浮窗口参数
        mWindowParams = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
                PixelFormat.TRANSLUCENT
        );
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mWindowParams.type = WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY;
        }

        // 设置悬浮窗口的位置
        mWindowParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        mWindowParams.y = mPreferences.getInt(positionKey, 100);

        // 将悬浮窗口添加到 WindowManager
        mWindowManager.addView(mLiricView, mWindowParams);
        mLiricView.setOnTouchListener(this);
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (mWindowManager != null && mLiricView != null) {
            mWindowManager.removeView(mLiricView);
        }
        mWindowManager = null;
        mLiricView = null;
        mLyricTextView = null;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private int initialY;
    private float initialTouchY;

    @SuppressLint("ClickableViewAccessibility")
    @Override
    public boolean onTouch(View v, MotionEvent event) {
        switch (event.getAction()) {
            case MotionEvent.ACTION_DOWN:
                // 记录初始位置和触摸点位置
                initialY = mWindowParams.y;
                initialTouchY = event.getRawY();
                return true;
            case MotionEvent.ACTION_MOVE:
                // 计算移动距离并更新悬浮窗口位置
                mWindowParams.y = initialY + (int) (event.getRawY() - initialTouchY);
                mWindowManager.updateViewLayout(mLiricView, mWindowParams);
                return true;
            case MotionEvent.ACTION_UP:
                mPreferences.edit().putInt(positionKey, mWindowParams.y).apply();
                return true;
            default:
                return false;
        }
    }
}
