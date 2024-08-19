package com.picapico.musiche;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.ryanheise.audioservice.AudioServiceActivity;

import io.flutter.embedding.engine.FlutterEngine;

public class MainActivity extends AudioServiceActivity {
    MessagePlugin mMessagePlugin = new MessagePlugin();
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        initTheme();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }
    }

    private void initTheme(){
        SharedPreferences mPreferences = getSharedPreferences("config", Context.MODE_PRIVATE);
        boolean auto = mPreferences.getBoolean("auto", false);
        boolean dark = mPreferences.getBoolean("dark", false);
        SystemBarEdge.setDarkMode(this, dark, auto);
        int mode = getResources().getConfiguration().uiMode;
        boolean autoIsDark = (mode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        SystemBarEdge.setEdgeToEdge(getWindow(), (auto && autoIsDark) || dark);
    }

    @Override
    public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);
        mMessagePlugin.setCurrentActivity(this);
        mMessagePlugin.setOnBackToHomeListener(this::onBackToHome);
        flutterEngine.getPlugins().add(mMessagePlugin);
    }

    void onBackToHome(){
        moveTaskToBack(false);
    }
}
