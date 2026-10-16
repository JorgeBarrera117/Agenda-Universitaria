package com.agenda.universitaria;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        String dataJson = call.getString("dataJson");

        if (dataJson != null) {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(AgendaWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString("widget_data", dataJson).commit();

            // Actualizar ambos widgets colocados en la pantalla de inicio
            AgendaWidgetProvider.updateAllWidgets(context);
            ScheduleDayWidgetProvider.updateAllWidgets(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("dataJson no puede ser nulo");
        }
    }
}
