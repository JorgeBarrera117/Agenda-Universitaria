package com.agenda.universitaria;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Binder;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class ScheduleDayWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new ScheduleDayListRemoteViewsFactory(this.getApplicationContext(), intent);
    }
}

class ScheduleDayListRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {
    private final Context context;
    private final Intent intent;
    private final List<JSONObject> itemList = new ArrayList<>();

    public ScheduleDayListRemoteViewsFactory(Context context, Intent intent) {
        this.context = context;
        this.intent = intent;
    }

    @Override
    public void onCreate() {
        loadData();
    }

    @Override
    public void onDataSetChanged() {
        final long identityToken = Binder.clearCallingIdentity();
        try {
            loadData();
        } finally {
            Binder.restoreCallingIdentity(identityToken);
        }
    }

    private void loadData() {
        itemList.clear();
        SharedPreferences prefs = context.getSharedPreferences(ScheduleDayWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);

        int appWidgetId = intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
        int selectedDay = intent.getIntExtra(ScheduleDayWidgetProvider.EXTRA_DAY, -1);
        if (selectedDay < 1 || selectedDay > 7) {
            int today = ScheduleDayWidgetProvider.getTodayDayOfWeek();
            if (appWidgetId != -1) {
                selectedDay = prefs.getInt(ScheduleDayWidgetProvider.KEY_SELECTED_DAY + "_" + appWidgetId, prefs.getInt(ScheduleDayWidgetProvider.KEY_SELECTED_DAY, today));
            } else {
                selectedDay = prefs.getInt(ScheduleDayWidgetProvider.KEY_SELECTED_DAY, today);
            }
        }

        String rawJson = prefs.getString("widget_data", null);
        if (rawJson == null || rawJson.isEmpty()) {
            return;
        }

        try {
            JSONObject root = new JSONObject(rawJson);
            JSONObject scheduleByDay = root.optJSONObject("scheduleByDay");
            if (scheduleByDay != null) {
                JSONArray array = scheduleByDay.optJSONArray(String.valueOf(selectedDay));
                if (array != null) {
                    for (int i = 0; i < array.length(); i++) {
                        JSONObject obj = array.optJSONObject(i);
                        if (obj != null) {
                            itemList.add(obj);
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onDestroy() {
        itemList.clear();
    }

    @Override
    public int getCount() {
        return itemList.size();
    }

    @Override
    public RemoteViews getViewAt(int position) {
        if (position < 0 || position >= itemList.size()) {
            return null;
        }

        JSONObject item = itemList.get(position);
        WidgetThemeHelper.ThemeColors theme = WidgetThemeHelper.getThemeColors(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_list_item);

        String title = item.optString("title", "Clase");
        String timeOrDate = item.optString("timeOrDate", "");
        String details = item.optString("details", "");
        String colorHex = item.optString("color", "#38bdf8");
        String badge = item.optString("badge", "");
        boolean isToday = item.optBoolean("isToday", false);
        String id = item.optString("id", "");

        // Fondo de tarjeta adaptado al tema (Material You cardBg)
        views.setInt(R.id.widget_item_bg_view, "setColorFilter", theme.cardBg);

        // Textos con colores de alto contraste accesibles del tema
        views.setTextViewText(R.id.widget_item_title, title);
        views.setTextColor(R.id.widget_item_title, theme.onSurface);

        views.setTextViewText(R.id.widget_item_time_or_date, timeOrDate);
        views.setTextColor(R.id.widget_item_time_or_date, theme.primary);

        views.setTextViewText(R.id.widget_item_details, details);
        views.setTextColor(R.id.widget_item_details, theme.onSurfaceVariant);

        // Badge de alta visibilidad y contraste (independiente del tema)
        views.setTextViewText(R.id.widget_item_badge, badge);
        if (isToday) {
            if (theme.isDark) {
                views.setInt(R.id.widget_item_badge, "setBackgroundResource", R.drawable.widget_badge_today_dark);
                views.setTextColor(R.id.widget_item_badge, Color.parseColor("#1C1917"));
            } else {
                views.setInt(R.id.widget_item_badge, "setBackgroundResource", R.drawable.widget_badge_today_light);
                views.setTextColor(R.id.widget_item_badge, Color.parseColor("#FFFFFF"));
            }
        } else {
            if (theme.isDark) {
                views.setInt(R.id.widget_item_badge, "setBackgroundResource", R.drawable.widget_badge_day_dark);
                views.setTextColor(R.id.widget_item_badge, Color.parseColor("#E2E8F0"));
            } else {
                views.setInt(R.id.widget_item_badge, "setBackgroundResource", R.drawable.widget_badge_day_light);
                views.setTextColor(R.id.widget_item_badge, Color.parseColor("#334155"));
            }
        }

        // Barra de color representativo de la asignatura
        try {
            int color = Color.parseColor(colorHex);
            views.setInt(R.id.widget_item_color_bar, "setBackgroundColor", color);
        } catch (Exception ignored) {
            views.setInt(R.id.widget_item_color_bar, "setBackgroundColor", theme.primary);
        }

        Intent fillInIntent = new Intent();
        fillInIntent.putExtra("item_id", id);
        views.setOnClickFillInIntent(R.id.widget_item_container, fillInIntent);

        return views;
    }

    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 1;
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public boolean hasStableIds() {
        return true;
    }
}
