package com.agenda.universitaria;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;

import org.json.JSONObject;

public class WidgetThemeHelper {

    public static class ThemeColors {
        public boolean isDark = true;
        public int primary = 0xFF2563EB;
        public int onPrimary = 0xFFFFFFFF;
        public int primaryContainer = 0xFF3B82F6;
        public int onPrimaryContainer = 0xFFFFFFFF;
        public int secondaryContainer = 0xFF1E293B;
        public int onSecondaryContainer = 0xFFCBD5E1;
        public int surface = 0xFF0F172A;
        public int cardBg = 0xFF1E293B;
        public int surfaceContainer = 0xFF1E293B;
        public int surfaceContainerHigh = 0xFF334155;
        public int onSurface = 0xFFFFFFFF;
        public int onSurfaceVariant = 0xFF94A3B8;
        public int outline = 0xFF334155;
    }

    public static ThemeColors getThemeColors(Context context) {
        ThemeColors colors = new ThemeColors();
        try {
            SharedPreferences prefs = context.getSharedPreferences(AgendaWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            String rawJson = prefs.getString("widget_data", null);
            if (rawJson != null && !rawJson.isEmpty()) {
                JSONObject root = new JSONObject(rawJson);
                JSONObject themeObj = root.optJSONObject("theme");
                if (themeObj != null) {
                    colors.isDark = themeObj.optBoolean("isDark", true);
                    colors.primary = parseColorSafe(themeObj.optString("primary"), colors.primary);
                    colors.onPrimary = parseColorSafe(themeObj.optString("onPrimary"), colors.onPrimary);
                    colors.primaryContainer = parseColorSafe(themeObj.optString("primaryContainer"), colors.primaryContainer);
                    colors.onPrimaryContainer = parseColorSafe(themeObj.optString("onPrimaryContainer"), colors.onPrimaryContainer);
                    colors.secondaryContainer = parseColorSafe(themeObj.optString("secondaryContainer"), colors.secondaryContainer);
                    colors.onSecondaryContainer = parseColorSafe(themeObj.optString("onSecondaryContainer"), colors.onSecondaryContainer);
                    colors.surface = parseColorSafe(themeObj.optString("surface"), colors.surface);
                    colors.cardBg = parseColorSafe(themeObj.optString("cardBg"), colors.cardBg);
                    colors.surfaceContainer = parseColorSafe(themeObj.optString("surfaceContainer"), colors.surfaceContainer);
                    colors.surfaceContainerHigh = parseColorSafe(themeObj.optString("surfaceContainerHigh"), colors.surfaceContainerHigh);
                    colors.onSurface = parseColorSafe(themeObj.optString("onSurface"), colors.onSurface);
                    colors.onSurfaceVariant = parseColorSafe(themeObj.optString("onSurfaceVariant"), colors.onSurfaceVariant);
                    colors.outline = parseColorSafe(themeObj.optString("outline"), colors.outline);
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        return colors;
    }

    private static int parseColorSafe(String hex, int fallback) {
        if (hex == null || hex.trim().isEmpty()) return fallback;
        try {
            return Color.parseColor(hex.trim());
        } catch (Exception e) {
            return fallback;
        }
    }
}
