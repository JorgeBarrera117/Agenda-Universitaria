package com.agenda.universitaria;

import android.content.Context;
import android.graphics.Color;
import android.widget.RemoteViews;

import org.json.JSONObject;

/**
 * Ícono de la materia en las filas de los widgets: el mismo dibujo que en la app
 * (res/drawable/ic_subject_*.xml, generados por scripts/generate-android-subject-icons.mjs), en
 * blanco sobre un círculo con el color de la materia.
 */
final class SubjectIconHelper {

    private static final String DEFAULT_ICON = "ic_subject_book";

    private SubjectIconHelper() {}

    /** Recurso del ícono indicado por la app; si no existe (dato viejo o ícono nuevo), el libro. */
    static int resolveIcon(Context context, String name) {
        if (name != null && name.startsWith("ic_subject_")) {
            int id = context.getResources().getIdentifier(name, "drawable", context.getPackageName());
            if (id != 0) return id;
        }
        return context.getResources().getIdentifier(DEFAULT_ICON, "drawable", context.getPackageName());
    }

    /** Pinta el ícono de la fila (widget_list_item.xml) con el color y el dibujo de la materia. */
    static void bind(Context context, RemoteViews views, JSONObject item, int fallbackColor) {
        int color;
        try {
            color = Color.parseColor(item.optString("color", ""));
        } catch (Exception e) {
            color = fallbackColor;
        }
        views.setInt(R.id.widget_item_icon_bg, "setColorFilter", color);
        views.setImageViewResource(R.id.widget_item_icon, resolveIcon(context, item.optString("icon", null)));
    }
}
