package com.agenda.universitaria;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.lang.ref.WeakReference;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Puente del modo estudio: la app manda su estado (sync) para la notificación en curso y la
 * alarma, y recoge lo que pasó desde la notificación mientras no estaba (consumeEvents).
 */
@CapacitorPlugin(name = "StudyTimer")
public class StudyTimerPlugin extends Plugin {
    private static WeakReference<StudyTimerPlugin> instance = new WeakReference<>(null);

    @Override
    public void load() {
        instance = new WeakReference<>(this);
    }

    /** Avisa a la app (si está abierta) de un botón de la notificación o del fin de una fase. */
    static void emit(String type) {
        StudyTimerPlugin plugin = instance.get();
        if (plugin == null) return;
        JSObject data = new JSObject();
        data.put("type", type);
        plugin.notifyListeners("studyEvent", data);
    }

    @PluginMethod
    public void sync(PluginCall call) {
        JSObject state = call.getObject("state");
        if (state == null) {
            call.reject("Falta el estado");
            return;
        }
        try {
            StudyTimerNotifier.saveState(getContext(), new JSONObject(state.toString()));
            StudyTimerNotifier.render(getContext());
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo actualizar el modo estudio", e);
        }
    }

    @PluginMethod
    public void consumeEvents(PluginCall call) {
        JSONArray events = StudyTimerNotifier.consumeEvents(getContext());
        JSObject result = new JSObject();
        try {
            result.put("events", new JSArray(events.toString()));
        } catch (Exception e) {
            result.put("events", new JSArray());
        }
        call.resolve(result);
    }
}
