package com.agenda.universitaria;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.drawable.Drawable;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.DrawableCompat;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Modo estudio en Android: notificación en curso con la cuenta regresiva en vivo (cronómetro del
 * sistema) y botones Pausar/Reanudar y Detener, más la alarma exacta del fin de cada fase.
 *
 * El estado lo manda la app (StudyTimerPlugin.sync) y se guarda en SharedPreferences, así el
 * receptor (StudyTimerReceiver) puede pausar, reanudar, detener y pasar de concentración a pausa
 * aunque la app esté cerrada. Lo que hace aquí lo anota como eventos para que la app los aplique
 * al volver (su estado manda: estos eventos solo la ponen al día).
 */
final class StudyTimerNotifier {
    static final String ACTION_PAUSE = "com.agenda.universitaria.study.PAUSE";
    static final String ACTION_RESUME = "com.agenda.universitaria.study.RESUME";
    static final String ACTION_STOP = "com.agenda.universitaria.study.STOP";
    static final String ACTION_PHASE_END = "com.agenda.universitaria.study.PHASE_END";

    private static final String PREFS = "study_timer_native";
    private static final String KEY_STATE = "state";
    private static final String KEY_EVENTS = "events";
    private static final int ONGOING_ID = 7_777_100;
    private static final int ALERT_ID = 7_777_101;
    /** Grupo principal (no «Silenciosas») y sin sonido; el anterior, de importancia baja, se borra. */
    private static final String ONGOING_CHANNEL = "study_timer_live";
    private static final String OLD_ONGOING_CHANNEL = "study_timer_ongoing";
    private static final String ALERT_CHANNEL_PREFIX = "study_alert_";

    private StudyTimerNotifier() {}

    /* ------------------------------------------------------------------------------------------ */
    /* Estado                                                                                      */
    /* ------------------------------------------------------------------------------------------ */

    static JSONObject loadState(Context ctx) {
        try {
            String raw = prefs(ctx).getString(KEY_STATE, null);
            return raw == null ? null : new JSONObject(raw);
        } catch (Exception e) {
            return null;
        }
    }

    static void saveState(Context ctx, JSONObject state) {
        prefs(ctx).edit().putString(KEY_STATE, state.toString()).apply();
    }

    static void queueEvent(Context ctx, String type, long at) {
        try {
            JSONArray events = new JSONArray(prefs(ctx).getString(KEY_EVENTS, "[]"));
            JSONObject event = new JSONObject();
            event.put("type", type);
            event.put("at", at);
            events.put(event);
            // Como mucho los últimos 50 (no debería haber tantos sin abrir la app)
            while (events.length() > 50) events.remove(0);
            prefs(ctx).edit().putString(KEY_EVENTS, events.toString()).apply();
        } catch (Exception ignored) {
            // Sin evento la app se pone al día igual con la hora de fin
        }
    }

    /** Devuelve y borra los eventos pendientes. */
    static JSONArray consumeEvents(Context ctx) {
        try {
            JSONArray events = new JSONArray(prefs(ctx).getString(KEY_EVENTS, "[]"));
            prefs(ctx).edit().putString(KEY_EVENTS, "[]").apply();
            return events;
        } catch (Exception e) {
            return new JSONArray();
        }
    }

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /* ------------------------------------------------------------------------------------------ */
    /* Transiciones (desde los botones de la notificación y la alarma)                             */
    /* ------------------------------------------------------------------------------------------ */

    /** Aplica una acción del receptor; devuelve el tipo de evento para avisar a la app, o null. */
    static String handle(Context ctx, String action) {
        JSONObject s = loadState(ctx);
        if (s == null) return null;
        long now = System.currentTimeMillis();
        try {
            boolean running = s.optBoolean("running");
            long endsAt = s.optLong("endsAt");
            switch (action) {
                case ACTION_PAUSE:
                    if (!running) return null;
                    s.put("remainingMs", Math.max(0, endsAt - now));
                    s.put("running", false);
                    saveState(ctx, s);
                    queueEvent(ctx, "pause", now);
                    render(ctx);
                    return "pause";
                case ACTION_RESUME:
                    if (running || !s.optBoolean("started")) return null;
                    s.put("endsAt", now + s.optLong("remainingMs"));
                    s.put("running", true);
                    saveState(ctx, s);
                    queueEvent(ctx, "resume", now);
                    render(ctx);
                    return "resume";
                case ACTION_STOP:
                    s.put("started", false);
                    s.put("running", false);
                    s.put("phase", "focus");
                    s.put("focusCount", 0);
                    s.put("remainingMs", s.optLong("focusMs"));
                    saveState(ctx, s);
                    queueEvent(ctx, "stop", now);
                    render(ctx);
                    return "stop";
                case ACTION_PHASE_END:
                    // Alarma vieja (la app ya cambió de fase o pausó): no hace nada
                    if (!running || now < endsAt - 2000) return null;
                    finishPhase(ctx, s, endsAt);
                    return "phaseEnd";
                default:
                    return null;
            }
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Fin de una fase. Tras la concentración viene la pausa (larga cada «longEvery» sesiones) y tras
     * la pausa, la siguiente sesión; cada una empieza sola solo si su interruptor está encendido.
     */
    private static void finishPhase(Context ctx, JSONObject s, long end) throws Exception {
        boolean focusEnded = "focus".equals(s.optString("phase"));
        if (focusEnded) {
            int focusCount = s.optInt("focusCount") + 1;
            int longEvery = Math.max(1, s.optInt("longEvery", 4));
            boolean isLong = focusCount % longEvery == 0;
            long breakMs = isLong ? s.optLong("longBreakMs") : s.optLong("shortBreakMs");
            boolean auto = s.optBoolean("autoStartBreaks", true);
            s.put("focusCount", focusCount);
            s.put("phase", "break");
            s.put("phaseTotalMs", breakMs);
            s.put("remainingMs", breakMs);
            s.put("running", auto);
            if (auto) s.put("endsAt", end + breakMs);
            saveState(ctx, s);
            long minutes = Math.round(breakMs / 60000.0);
            alert(ctx, s, s.optString("breakTone"),
                isLong ? "¡Descanso largo! ☕" : "¡Hora de una pausa! ☕",
                auto
                    ? "Descansa " + minutes + " min: levántate, estírate y toma agua. Te avisamos cuando toque volver."
                    : "Sesión terminada. Toca «Empezar» para tu pausa de " + minutes + " min.");
        } else {
            long focusMs = s.optLong("focusMs");
            boolean auto = s.optBoolean("autoStartFocus", false);
            s.put("phase", "focus");
            s.put("phaseTotalMs", focusMs);
            s.put("remainingMs", focusMs);
            s.put("running", auto);
            if (auto) s.put("endsAt", end + focusMs);
            saveState(ctx, s);
            alert(ctx, s, s.optString("resumeTone"),
                "Se acabó la pausa 📚",
                auto ? "¡Nueva sesión en marcha! Ya estás estudiando otra vez." : "Toca para empezar la siguiente sesión de estudio.");
        }
        queueEvent(ctx, "phaseEnd", end);
        render(ctx);
    }

    /* ------------------------------------------------------------------------------------------ */
    /* Notificaciones y alarma                                                                     */
    /* ------------------------------------------------------------------------------------------ */

    /** Dibuja (o quita) la notificación en curso según el estado guardado y programa la alarma. */
    static void render(Context ctx) {
        JSONObject s = loadState(ctx);
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (s == null || !s.optBoolean("started")) {
            nm.cancel(ONGOING_ID);
            cancelAlarm(ctx);
            return;
        }
        ensureOngoingChannel(ctx);

        boolean running = s.optBoolean("running");
        boolean isBreak = "break".equals(s.optString("phase"));
        long endsAt = s.optLong("endsAt");
        long remaining = running ? Math.max(0, endsAt - System.currentTimeMillis()) : s.optLong("remainingMs");
        String subject = s.optString("subject", "");
        long phaseTotal = s.optLong("phaseTotalMs", isBreak ? s.optLong("shortBreakMs") : s.optLong("focusMs"));
        boolean untouched = !running && remaining >= phaseTotal;
        boolean waiting = untouched && !isBreak && s.optInt("focusCount") > 0;

        String title;
        String text;
        if (isBreak) {
            title = running ? "Pausa ☕ · vuelves a estudiar en" : untouched ? "Hora de una pausa ☕" : "Pausa en espera";
            text = running
                ? "Descansa: levántate, estírate y toma agua"
                : untouched ? "Toca «Empezar» para tu pausa de " + Math.round(phaseTotal / 60000.0) + " min" : "Quedan " + clock(remaining) + " de pausa";
        } else if (waiting) {
            title = "¡A estudiar! 📚";
            text = "Pausa terminada · siguiente sesión de " + Math.round(s.optLong("focusMs") / 60000.0) + " min";
        } else {
            title = running ? "Concentración" + (subject.isEmpty() ? "" : " · " + subject) : "Sesión en pausa";
            text = running
                ? (subject.isEmpty() ? "Modo estudio" : subject) + " · sesión " + (s.optInt("focusCount") % Math.max(1, s.optInt("longEvery", 4)) + 1) + " de " + s.optInt("longEvery", 4)
                : "Quedan " + clock(remaining) + (subject.isEmpty() ? "" : " · " + subject);
        }

        int phaseColor = parseColor(isBreak ? "#2E7D32" : s.optString("color"), Color.parseColor("#00639B"));
        int glyph = isBreak ? R.drawable.ic_stat_study_break : R.drawable.ic_stat_study_timer;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, ONGOING_CHANNEL)
            .setSmallIcon(glyph)
            .setLargeIcon(circleIcon(ctx, glyph, phaseColor))
            .setContentTitle(title)
            .setContentText(text)
            .setColor(phaseColor)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            // Android 16: «actualización en vivo» (pastilla en la barra de estado, arriba de todo)
            .setRequestPromotedOngoing(true)
            // Grupo propio: Android no la junta con los avisos de pausa
            .setGroup("study_timer_live")
            .setContentIntent(openAppIntent(ctx));

        if (running) {
            // Cuenta regresiva en vivo del sistema: no hace falta actualizar la notificación cada segundo
            b.setWhen(endsAt).setShowWhen(true).setUsesChronometer(true).setChronometerCountDown(true);
            b.addAction(0, "Pausar", actionIntent(ctx, ACTION_PAUSE, 1));
        } else {
            b.setShowWhen(false);
            b.setShortCriticalText(isBreak ? "Pausa" : waiting ? "¡A estudiar!" : "En pausa");
            b.addAction(0, untouched ? "Empezar" : "Reanudar", actionIntent(ctx, ACTION_RESUME, 2));
        }
        b.addAction(0, "Detener", actionIntent(ctx, ACTION_STOP, 3));

        try {
            nm.notify(ONGOING_ID, b.build());
        } catch (SecurityException ignored) {
            // Sin permiso de notificaciones: el temporizador sigue dentro de la app
        }
        if (running) scheduleAlarm(ctx, endsAt);
        else cancelAlarm(ctx);
    }

    /** Aviso con sonido del fin de una fase (canal propio del tono elegido en Ajustes). */
    private static void alert(Context ctx, JSONObject s, String tone, String title, String text) {
        boolean soundOn = s.optBoolean("soundOn", true);
        String channelId = ensureAlertChannel(ctx, soundOn ? tone : "silent");
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channelId)
            .setSmallIcon(R.drawable.ic_stat_study_break)
            .setLargeIcon(circleIcon(ctx, R.drawable.ic_stat_study_break, Color.parseColor("#2E7D32")))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setColor(parseColor("#2E7D32", Color.GREEN))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setAutoCancel(true)
            .setContentIntent(openAppIntent(ctx));
        try {
            NotificationManagerCompat.from(ctx).notify(ALERT_ID, b.build());
        } catch (SecurityException ignored) {
            // Sin permiso de notificaciones
        }
    }

    private static void ensureOngoingChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(OLD_ONGOING_CHANNEL) != null) nm.deleteNotificationChannel(OLD_ONGOING_CHANNEL);
        if (nm.getNotificationChannel(ONGOING_CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(ONGOING_CHANNEL, "Modo estudio en curso", NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription("Cuenta regresiva de la sesión de estudio, con pausar y detener");
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    /** Un canal por tono (Android no deja cambiar el sonido de un canal ya creado). */
    private static String ensureAlertChannel(Context ctx, String tone) {
        String safeTone = tone == null || !tone.matches("[a-z0-9_]{1,40}") ? "default" : tone;
        String channelId = ALERT_CHANNEL_PREFIX + safeTone;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return channelId;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null || nm.getNotificationChannel(channelId) != null) return channelId;
        NotificationChannel ch = new NotificationChannel(channelId, "Modo estudio: pausas (" + safeTone + ")", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Aviso al empezar y al terminar cada pausa del modo estudio");
        ch.enableVibration(true);
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        String rawName = "silent".equals(safeTone) ? "tone_silent" : safeTone;
        int resId = ctx.getResources().getIdentifier(rawName, "raw", ctx.getPackageName());
        if (resId != 0) {
            Uri uri = Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + ctx.getPackageName() + "/" + resId);
            ch.setSound(uri, attrs);
        }
        nm.createNotificationChannel(ch);
        return channelId;
    }

    private static void scheduleAlarm(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        PendingIntent pi = actionIntent(ctx, ACTION_PHASE_END, 4);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (SecurityException e) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    private static void cancelAlarm(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(actionIntent(ctx, ACTION_PHASE_END, 4));
    }

    private static PendingIntent actionIntent(Context ctx, String action, int requestCode) {
        Intent intent = new Intent(ctx, StudyTimerReceiver.class).setAction(action);
        return PendingIntent.getBroadcast(ctx, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent openAppIntent(Context ctx) {
        Intent intent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (intent == null) intent = new Intent(ctx, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(ctx, 5, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Círculo del color de la fase con el ícono en blanco, para el ícono grande de la notificación. */
    private static Bitmap circleIcon(Context ctx, int drawableRes, int color) {
        int size = Math.round(64 * ctx.getResources().getDisplayMetrics().density);
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(color);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint);
        Drawable glyph = ContextCompat.getDrawable(ctx, drawableRes);
        if (glyph != null) {
            glyph = DrawableCompat.wrap(glyph.mutate());
            DrawableCompat.setTint(glyph, Color.WHITE);
            int pad = Math.round(size * 0.24f);
            glyph.setBounds(pad, pad, size - pad, size - pad);
            glyph.draw(canvas);
        }
        return bitmap;
    }

    private static int parseColor(String hex, int fallback) {
        try {
            return Color.parseColor(hex);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static String clock(long ms) {
        long total = (ms + 999) / 1000;
        return String.format(Locale.ROOT, "%d:%02d", total / 60, total % 60);
    }
}
