package com.picapico.musiche;

import android.content.Intent;
import android.content.res.Configuration;
import android.os.Bundle;

import androidx.activity.EdgeToEdge;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;

public class MainActivity extends FlutterActivity {
    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        int mode = getResources().getConfiguration().uiMode;
        boolean dark = (mode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        SystemBarEdge.setEdgeToEdge(getWindow(), dark);
    }

    @Override
    public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);
        MessagePlugin mMessagePlugin = new MessagePlugin();
        mMessagePlugin.setCurrentActivity(this);
        mMessagePlugin.setOnBackToHomeListener(this::onBackToHome);
        flutterEngine.getPlugins().add(mMessagePlugin);
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        if(NotificationActions.ACTION_SHOW.equals(intent.getAction())){
            Intent showIntent = new Intent(this, NotificationReceiver.class);
            showIntent.setAction(NotificationActions.ACTION_SHOW);
            sendBroadcast(showIntent);
        }
    }

    void onBackToHome(){
        moveTaskToBack(false);
    }
}
