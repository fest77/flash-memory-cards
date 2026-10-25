package com.mdflashcards.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** 重启后恢复每日提醒。 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        SharedPreferences p = ctx.getSharedPreferences("mdfc", Context.MODE_PRIVATE);
        String r = p.getString("reminder", null);
        if (r == null) return;
        try {
            String[] hm = r.split(":");
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.set(java.util.Calendar.HOUR_OF_DAY, Integer.parseInt(hm[0]));
            cal.set(java.util.Calendar.MINUTE, Integer.parseInt(hm[1]));
            if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(java.util.Calendar.DATE, 1);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 2001,
                new Intent(ctx, ReminderReceiver.class), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            android.app.AlarmManager am = (android.app.AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            am.setRepeating(android.app.AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(),
                android.app.AlarmManager.INTERVAL_DAY, pi);
        } catch (Exception ignored) { }
    }
}
