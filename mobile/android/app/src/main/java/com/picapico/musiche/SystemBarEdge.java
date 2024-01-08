package com.picapico.musiche;

import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;

import androidx.annotation.RequiresApi;

public class SystemBarEdge {
    @RequiresApi(api = Build.VERSION_CODES.R)
    private static void setSystemBarsAppearance(Window window, int appearance, int mask){
        WindowInsetsController controller = window.getInsetsController();
        if(controller != null) {
            controller.setSystemBarsAppearance(appearance, mask);
        }
    }
    private static void setSystemUiFlag(Window window, int systemUiFlag) {
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
                decorView.getSystemUiVisibility()
                        | systemUiFlag);
    }
    private static void unsetSystemUiFlag(Window window, int systemUiFlag) {
        View decorView = window.getDecorView();
        decorView.setSystemUiVisibility(
                decorView.getSystemUiVisibility()
                        & ~systemUiFlag);
    }
    @RequiresApi(api = Build.VERSION_CODES.R)
    private static void setDecorFitsSystemWindows30(Window window, boolean decorFitsSystemWindows){
        window.setDecorFitsSystemWindows(decorFitsSystemWindows);
    }
    private static void setDecorFitsSystemWindows16(Window window, boolean decorFitsSystemWindows){
        final int decorFitsFlags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;

        final View decorView = window.getDecorView();
        final int sysUiVis = decorView.getSystemUiVisibility();
        decorView.setSystemUiVisibility(decorFitsSystemWindows
                ? sysUiVis & ~decorFitsFlags
                : sysUiVis | decorFitsFlags);
    }
    private static void setDecorFitsSystemWindows(Window window, boolean decorFitsSystemWindows){
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R){
            setDecorFitsSystemWindows30(window, decorFitsSystemWindows);
        }else {
            setDecorFitsSystemWindows16(window, decorFitsSystemWindows);
        }
    }
    @RequiresApi(api = Build.VERSION_CODES.R)
    private static void setNavigationBarAppearance30(Window window, boolean dark){
        if(dark){
            unsetSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            setSystemBarsAppearance(window,
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }else {
            setSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
            setSystemBarsAppearance(window,
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                    WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS);
        }
    }
    @RequiresApi(api = Build.VERSION_CODES.O)
    private static void setNavigationBarAppearance26(Window window, boolean dark){
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        if(dark){
            unsetSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }else {
            setSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }
    private static void setNavigationBarAppearance(Window window, boolean dark){
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R){
            setNavigationBarAppearance30(window, dark);
        }else if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O){
            setNavigationBarAppearance26(window, dark);
        }
    }
    @RequiresApi(api = Build.VERSION_CODES.R)
    private static void setStatusBarAppearance30(Window window, boolean dark){
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        if(dark){
            unsetSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            setSystemBarsAppearance(window,
                    0,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        }else {
            setSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
            setSystemBarsAppearance(window,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        }
    }
    @RequiresApi(api = Build.VERSION_CODES.M)
    private static void setStatusBarAppearance23(Window window, boolean dark){
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        if(dark){
            unsetSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }else {
            setSystemUiFlag(window, View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }
    private static void setStatusBarAppearance(Window window, boolean dark){
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R){
            setStatusBarAppearance30(window, dark);
        }else if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M){
            setStatusBarAppearance23(window, dark);
        }else {
            window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        }
    }
    @RequiresApi(api = Build.VERSION_CODES.Q)
    private static void setEdgeToEdgeApi29(Window window, boolean dark){
        setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        window.setStatusBarContrastEnforced(false);
        window.setNavigationBarContrastEnforced(false);
        setStatusBarAppearance(window, dark);
        setNavigationBarAppearance(window, dark);
    }
    @RequiresApi(api = Build.VERSION_CODES.M)
    private static void setEdgeToEdgeApi23(Window window, boolean dark){
        setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        setStatusBarAppearance(window, dark);
        setNavigationBarAppearance(window, dark);
    }
    @RequiresApi(api = Build.VERSION_CODES.LOLLIPOP)
    private static void setEdgeToEdgeApi21(Window window, boolean dark){
        setDecorFitsSystemWindows(window, false);
        window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.setStatusBarColor(dark ? Color.TRANSPARENT : translucentColor);
    }
    private static void setEdgeToEdgeApiBase(Window window){
        setDecorFitsSystemWindows(window, false);
        window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
    }
    private static final int translucentColor = Color.parseColor("#40000000");

    public static void setEdgeToEdge(Window window, boolean dark){
        if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.R){
            setEdgeToEdgeApi29(window, dark);
        }else if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.M){
            setEdgeToEdgeApi23(window, dark);
        }else if(Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP){
            setEdgeToEdgeApi21(window, dark);
        }else {
            setEdgeToEdgeApiBase(window);
        }
    }
}
