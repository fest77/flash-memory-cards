package com.mdflashcards.app;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/** 每日复习提醒（本地通知，无推送服务）。 */
public class ReminderReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        PendingIntent pi = PendingIntent.getActivity(ctx, 0,
            new Intent(ctx, MainActivity.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder b = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(ctx, "review")
            : new Notification.Builder(ctx);
        b.setSmallIcon(android.R.drawable.ic_menu_edit)
            .setContentTitle("MD闪记卡")
            .setContentText("今天的复习还没开始，来抽几张卡吧")
            .setContentIntent(pi)
            .setAutoCancel(true);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(1001, b.build());
    }
}
