package com.agenda.universitaria;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Botones de la notificación del modo estudio (Pausar, Reanudar, Detener) y alarma del fin de
 * cada fase. Funciona con la app cerrada: el estado vive en StudyTimerNotifier; si la app está
 * abierta, StudyTimerPlugin le avisa al momento.
 */
public class StudyTimerReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String event = StudyTimerNotifier.handle(context.getApplicationContext(), intent.getAction());
        if (event != null) StudyTimerPlugin.emit(event);
    }
}
