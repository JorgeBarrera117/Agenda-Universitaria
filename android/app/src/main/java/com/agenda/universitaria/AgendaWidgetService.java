package com.agenda.universitaria;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class AgendaWidgetService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new AgendaListRemoteViewsFactory(this.getApplicationContext(), intent);
    }
}

class AgendaListRemoteViewsFactory implements RemoteViewsService.RemoteViewsFactory {
    private final Context context;
    private final Intent intent;
    private String currentTab = "schedule";
    private final List<JSONObject> itemList = new ArrayList<>();

    public AgendaListRemoteViewsFactory(Context context, Intent intent) {
        this.context = context;
        this.intent = intent;
    }

    @Override
    public void onCreate() {
        loadData();
    }

    @Override
    public void onDataSetChanged() {
        loadData();
    }

    private void loadData() {
        itemList.clear();
        SharedPreferences prefs = context.getSharedPreferences(AgendaWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);

        int appWidgetId = intent.getIntExtra(android.appwidget.AppWidgetManager.EXTRA_APPWIDGET_ID, -1);
        if (appWidgetId != -1) {
            currentTab = prefs.getString(AgendaWidgetProvider.KEY_SELECTED_TAB + "_" + appWidgetId, prefs.getString(AgendaWidgetProvider.KEY_SELECTED_TAB, "schedule"));
        } else {
            currentTab = prefs.getString(AgendaWidgetProvider.KEY_SELECTED_TAB, "schedule");
        }

        String rawJson = prefs.getString("widget_data", null);
        if (rawJson == null || rawJson.isEmpty()) {
            return;
        }

        try {
            JSONObject root = new JSONObject(rawJson);
            JSONArray array = root.optJSONArray(currentTab);
            if (array != null) {
                for (int i = 0; i < array.length(); i++) {
                    JSONObject obj = array.optJSONObject(i);
                    if (obj != null) {
                        itemList.add(obj);
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

        if ("schedule".equals(currentTab)) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_item_schedule);

            String subjectName = item.optString("subjectName", "Materia");
            String time = item.optString("time", "");
            String details = item.optString("details", "");
            String colorHex = item.optString("subjectColor", "#3b82f6");
            String id = item.optString("id", "");

            views.setTextViewText(R.id.widget_schedule_subject_name, subjectName);
            views.setTextViewText(R.id.widget_schedule_time, time);
            views.setTextViewText(R.id.widget_schedule_details, details);

            try {
                int color = Color.parseColor(colorHex);
                views.setInt(R.id.widget_schedule_color_bar, "setBackgroundColor", color);
            } catch (Exception ignored) {
                views.setInt(R.id.widget_schedule_color_bar, "setBackgroundColor", 0xFF3B82F6);
            }

            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("item_type", "schedule");
            fillInIntent.putExtra("item_id", id);
            views.setOnClickFillInIntent(R.id.widget_schedule_item_container, fillInIntent);

            return views;
        } else {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_item_note);

            String title = item.optString("title", "Apunte");
            String date = item.optString("date", "");
            String subtitle = item.optString("details", "");
            String colorHex = item.optString("subjectColor", "#10b981");
            String id = item.optString("id", "");

            views.setTextViewText(R.id.widget_note_title, title);
            views.setTextViewText(R.id.widget_note_date, date);
            views.setTextViewText(R.id.widget_note_subtitle, subtitle);

            try {
                int color = Color.parseColor(colorHex);
                views.setInt(R.id.widget_note_color_bar, "setBackgroundColor", color);
            } catch (Exception ignored) {
                views.setInt(R.id.widget_note_color_bar, "setBackgroundColor", 0xFF10B981);
            }

            Intent fillInIntent = new Intent();
            fillInIntent.putExtra("item_type", "note");
            fillInIntent.putExtra("item_id", id);
            views.setOnClickFillInIntent(R.id.widget_note_item_container, fillInIntent);

            return views;
        }
    }

    @Override
    public RemoteViews getLoadingView() {
        return null;
    }

    @Override
    public int getViewTypeCount() {
        return 2; // Horario y Apuntes
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
