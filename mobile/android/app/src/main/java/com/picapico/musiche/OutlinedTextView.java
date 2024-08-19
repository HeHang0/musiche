package com.picapico.musiche;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.text.TextPaint;
import android.util.AttributeSet;

public class OutlinedTextView extends androidx.appcompat.widget.AppCompatTextView {

    private int outlineColor = Color.TRANSPARENT;
    private float outlineWidth = 0f;

    public OutlinedTextView(Context context) {
        super(context);
    }

    public OutlinedTextView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    public OutlinedTextView(Context context, AttributeSet attrs, int defStyle) {
        super(context, attrs, defStyle);
    }

    public void setOutline(int color, float width){
        outlineWidth = width;
        outlineColor = color;
        setShadowLayer(outlineWidth, 0, 0, 2);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        if(outlineWidth <= 0) {
            super.onDraw(canvas);
            return;
        }
        TextPaint paint = getPaint();

        // 保存当前画布状态
        canvas.save();
        int color = getCurrentTextColor();

        // 描边效果
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(outlineWidth);
        setTextColor(outlineColor);
        // 绘制描边文字
        super.onDraw(canvas);

        // 恢复画布状态
        canvas.restore();

        // 恢复原有文字颜色
        setTextColor(color);
        paint.setStyle(Paint.Style.FILL);
        super.onDraw(canvas);
    }
}