package com.agenda.universitaria;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AgendaWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_SWITCH_TAB = "com.agenda.universitaria.ACTION_SWITCH_TAB";
    public static final String ACTION_OPEN_APP = "com.agenda.universitaria.ACTION_OPEN_APP";
    public static final String ACTION_ITEM_CLICK = "com.agenda.universitaria.ACTION_ITEM_CLICK";
    public static final String EXTRA_TAB = "extra_tab";
    public static final String PREFS_NAME = "agenda_widget_prefs";
    public static final String KEY_SELECTED_TAB = "pref_selected_tab";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String selectedTab = prefs.getString(KEY_SELECTED_TAB + "_" + appWidgetId, prefs.getString(KEY_SELECTED_TAB, "schedule"));

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_agenda_layout);

        // Fecha actual formateada (ej. "Jueves, 15 oct")
        SimpleDateFormat sdf = new SimpleDateFormat("EEEE, d MMM", new Locale("es", "ES"));
        String todayDate = sdf.format(new Date());
        if (todayDate.length() > 0) {
            todayDate = todayDate.substring(0, 1).toUpperCase(new Locale("es", "ES")) + todayDate.substring(1);
        }
        views.setTextViewText(R.id.widget_date_subtitle, todayDate);

        // Configurar pestañas visuales con iconos vectoriales de la app (sin emojis)
        boolean isSchedule = "schedule".equals(selectedTab);
        if (isSchedule) {
            views.setInt(R.id.widget_btn_tab_schedule, "setBackgroundResource", R.drawable.widget_tab_active);
            views.setTextColor(R.id.widget_text_tab_schedule, 0xFFFFFFFF);
            views.setInt(R.id.widget_icon_tab_schedule, "setColorFilter", 0xFFFFFFFF);

            views.setInt(R.id.widget_btn_tab_notes, "setBackgroundResource", R.drawable.widget_tab_inactive);
            views.setTextColor(R.id.widget_text_tab_notes, 0xFF94A3B8);
            views.setInt(R.id.widget_icon_tab_notes, "setColorFilter", 0xFF94A3B8);

            views.setTextViewText(R.id.widget_empty_view, context.getString(R.string.widget_empty_schedule));
        } else {
            views.setInt(R.id.widget_btn_tab_schedule, "setBackgroundResource", R.drawable.widget_tab_inactive);
            views.setTextColor(R.id.widget_text_tab_schedule, 0xFF94A3B8);
            views.setInt(R.id.widget_icon_tab_schedule, "setColorFilter", 0xFF94A3B8);

            views.setInt(R.id.widget_btn_tab_notes, "setBackgroundResource", R.drawable.widget_tab_active);
            views.setTextColor(R.id.widget_text_tab_notes, 0xFFFFFFFF);
            views.setInt(R.id.widget_icon_tab_notes, "setColorFilter", 0xFFFFFFFF);

            views.setTextViewText(R.id.widget_empty_view, context.getString(R.string.widget_empty_notes));
        }

        // PendingIntent para conmutar a la pestaña Horario (estable e inmutable)
        Intent scheduleTabIntent = new Intent(context, AgendaWidgetProvider.class);
        scheduleTabIntent.setAction(ACTION_SWITCH_TAB);
        scheduleTabIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        scheduleTabIntent.putExtra(EXTRA_TAB, "schedule");
        scheduleTabIntent.setData(Uri.parse("tab://" + appWidgetId + "/schedule"));
        PendingIntent schedulePending = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10 + 1,
                scheduleTabIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_tab_schedule, schedulePending);

        // PendingIntent para conmutar a la pestaña Apuntes (estable e inmutable)
        Intent notesTabIntent = new Intent(context, AgendaWidgetProvider.class);
        notesTabIntent.setAction(ACTION_SWITCH_TAB);
        notesTabIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        notesTabIntent.putExtra(EXTRA_TAB, "notes");
        notesTabIntent.setData(Uri.parse("tab://" + appWidgetId + "/notes"));
        PendingIntent notesPending = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10 + 2,
                notesTabIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_btn_tab_notes, notesPending);

        // PendingIntent para abrir la App desde la cabecera o botón superior
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
                context,
                appWidgetId * 10 + 3,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_header_clickable, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_btn_open_app, openAppPending);

        // Adaptador con URI ESTABLE para evitar reconexiones de IPC repetidas que congelaban el widget
        Intent serviceIntent = new Intent(context, AgendaWidgetService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse("content://agenda_widget/widget_" + appWidgetId));
        views.setRemoteAdapter(R.id.widget_list_view, serviceIntent);
        views.setEmptyView(R.id.widget_list_view, R.id.widget_empty_view);

        // Template para clics en cada elemento de la lista
        Intent itemClickIntent = new Intent(context, AgendaWidgetProvider.class);
        itemClickIntent.setAction(ACTION_ITEM_CLICK);
        itemClickIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent itemClickPending = PendingIntent.getBroadcast(
                context,
                appWidgetId * 10 + 4,
                itemClickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        views.setPendingIntentTemplate(R.id.widget_list_view, itemClickPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_list_view);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, AgendaWidgetProvider.class);
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(thisWidget);
        if (appWidgetIds != null && appWidgetIds.length > 0) {
            for (int appWidgetId : appWidgetIds) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            }
        }
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);

        String action = intent.getAction();
        if (ACTION_SWITCH_TAB.equals(action)) {
            int appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            String newTab = intent.getStringExtra(EXTRA_TAB);

            if (newTab != null) {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    editor.putString(KEY_SELECTED_TAB + "_" + appWidgetId, newTab);
                }
                editor.putString(KEY_SELECTED_TAB, newTab);
                editor.commit(); // Commit sincrónico para garantizar lectura inmediata en onDataSetChanged

                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    updateAppWidget(context, appWidgetManager, appWidgetId);
                } else {
                    updateAllWidgets(context);
                }
            }
        } else if (ACTION_ITEM_CLICK.equals(action)) {
            String itemType = intent.getStringExtra("item_type");
            String itemId = intent.getStringExtra("item_id");

            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (itemType != null) openIntent.putExtra("widget_target_type", itemType);
            if (itemId != null) openIntent.putExtra("widget_target_id", itemId);
            context.startActivity(openIntent);
        }
    }
}
