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

import java.util.Calendar;

public class ScheduleDayWidgetProvider extends AppWidgetProvider {

    public static final String ACTION_SELECT_DAY = "com.agenda.universitaria.ACTION_SELECT_DAY";
    public static final String ACTION_SELECT_TODAY = "com.agenda.universitaria.ACTION_SELECT_TODAY";
    public static final String ACTION_DAY_ITEM_CLICK = "com.agenda.universitaria.ACTION_DAY_ITEM_CLICK";
    public static final String EXTRA_DAY = "extra_day";
    public static final String PREFS_NAME = AgendaWidgetProvider.PREFS_NAME;
    public static final String KEY_SELECTED_DAY = "pref_selected_day";

    private static final int[] DAY_BUTTON_IDS = new int[]{
            R.id.widget_btn_day_1, // Lunes
            R.id.widget_btn_day_2, // Martes
            R.id.widget_btn_day_3, // Miércoles
            R.id.widget_btn_day_4, // Jueves
            R.id.widget_btn_day_5, // Viernes
            R.id.widget_btn_day_6, // Sábado
            R.id.widget_btn_day_7  // Domingo
    };

    private static final String[] DAY_NAMES_ES = new String[]{
            "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"
    };

    public static int getTodayDayOfWeek() {
        Calendar cal = Calendar.getInstance();
        int day = cal.get(Calendar.DAY_OF_WEEK);
        // Calendar.SUNDAY = 1, MONDAY = 2, ..., SATURDAY = 7
        // Convertir a: 1 = Lunes ... 7 = Domingo
        if (day == Calendar.SUNDAY) return 7;
        return day - 1;
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
        super.onUpdate(context, appWidgetManager, appWidgetIds);
    }

    public static void updateAppWidget(Context context, AppWidgetManager appWidgetManager, int appWidgetId) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        int today = getTodayDayOfWeek();
        int selectedDay = prefs.getInt(KEY_SELECTED_DAY + "_" + appWidgetId, prefs.getInt(KEY_SELECTED_DAY, today));
        if (selectedDay < 1 || selectedDay > 7) {
            selectedDay = today;
        }

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_schedule_day_layout);

        // Título dinámico con el día seleccionado
        String dayName = DAY_NAMES_ES[selectedDay - 1];
        String headerTitle = "Horario • " + dayName;
        if (selectedDay == today) {
            headerTitle += " (Hoy)";
        }
        views.setTextViewText(R.id.widget_day_title, headerTitle);
        views.setTextViewText(R.id.widget_day_subtitle, "Toca un día para consultar");

        // Configuración de los 7 botones de día (Lun a Dom)
        for (int i = 0; i < 7; i++) {
            int dayNum = i + 1;
            int btnId = DAY_BUTTON_IDS[i];
            boolean isSelected = (dayNum == selectedDay);

            if (isSelected) {
                views.setInt(btnId, "setBackgroundResource", R.drawable.widget_tab_active);
                views.setTextColor(btnId, 0xFFFFFFFF);
            } else {
                views.setInt(btnId, "setBackgroundResource", R.drawable.widget_tab_inactive);
                views.setTextColor(btnId, 0xFF94A3B8);
            }

            Intent dayIntent = new Intent(context, ScheduleDayWidgetProvider.class);
            dayIntent.setAction(ACTION_SELECT_DAY);
            dayIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
            dayIntent.putExtra(EXTRA_DAY, dayNum);
            dayIntent.setData(Uri.parse("day://" + appWidgetId + "/" + dayNum));
            PendingIntent dayPending = PendingIntent.getBroadcast(
                    context,
                    appWidgetId * 100 + dayNum,
                    dayIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(btnId, dayPending);
        }

        // Botón "Hoy"
        Intent todayIntent = new Intent(context, ScheduleDayWidgetProvider.class);
        todayIntent.setAction(ACTION_SELECT_TODAY);
        todayIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        todayIntent.setData(Uri.parse("today://" + appWidgetId));
        PendingIntent todayPending = PendingIntent.getBroadcast(
                context,
                appWidgetId * 100 + 8,
                todayIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_day_btn_today, todayPending);

        // Botón para abrir la app desde cabecera o botón lateral
        Intent openAppIntent = new Intent(context, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPending = PendingIntent.getActivity(
                context,
                appWidgetId * 100 + 9,
                openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        views.setOnClickPendingIntent(R.id.widget_day_header_clickable, openAppPending);
        views.setOnClickPendingIntent(R.id.widget_day_btn_open_app, openAppPending);

        // Adaptador con URI ESTABLE para evitar reconexiones de IPC
        Intent serviceIntent = new Intent(context, ScheduleDayWidgetService.class);
        serviceIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        serviceIntent.setData(Uri.parse("content://schedule_day_widget/widget_" + appWidgetId));
        views.setRemoteAdapter(R.id.widget_day_list_view, serviceIntent);
        views.setEmptyView(R.id.widget_day_list_view, R.id.widget_day_empty_view);

        // Plantilla para clics en elementos de la lista
        Intent itemClickIntent = new Intent(context, ScheduleDayWidgetProvider.class);
        itemClickIntent.setAction(ACTION_DAY_ITEM_CLICK);
        itemClickIntent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, appWidgetId);
        PendingIntent itemClickPending = PendingIntent.getBroadcast(
                context,
                appWidgetId * 100 + 10,
                itemClickIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE
        );
        views.setPendingIntentTemplate(R.id.widget_day_list_view, itemClickPending);

        appWidgetManager.updateAppWidget(appWidgetId, views);
        appWidgetManager.notifyAppWidgetViewDataChanged(appWidgetId, R.id.widget_day_list_view);
    }

    public static void updateAllWidgets(Context context) {
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        ComponentName thisWidget = new ComponentName(context, ScheduleDayWidgetProvider.class);
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
        if (ACTION_SELECT_DAY.equals(action)) {
            int appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            int selectedDay = intent.getIntExtra(EXTRA_DAY, -1);
            if (selectedDay >= 1 && selectedDay <= 7) {
                SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                SharedPreferences.Editor editor = prefs.edit();
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    editor.putInt(KEY_SELECTED_DAY + "_" + appWidgetId, selectedDay);
                }
                editor.putInt(KEY_SELECTED_DAY, selectedDay);
                editor.commit();

                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    updateAppWidget(context, appWidgetManager, appWidgetId);
                } else {
                    updateAllWidgets(context);
                }
            }
        } else if (ACTION_SELECT_TODAY.equals(action)) {
            int appWidgetId = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            int today = getTodayDayOfWeek();
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            SharedPreferences.Editor editor = prefs.edit();
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                editor.putInt(KEY_SELECTED_DAY + "_" + appWidgetId, today);
            }
            editor.putInt(KEY_SELECTED_DAY, today);
            editor.commit();

            AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
            if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                updateAppWidget(context, appWidgetManager, appWidgetId);
            } else {
                updateAllWidgets(context);
            }
        } else if (ACTION_DAY_ITEM_CLICK.equals(action)) {
            String itemId = intent.getStringExtra("item_id");
            Intent openIntent = new Intent(context, MainActivity.class);
            openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            openIntent.putExtra("widget_target_type", "schedule");
            if (itemId != null) openIntent.putExtra("widget_target_id", itemId);
            context.startActivity(openIntent);
        }
    }
}
