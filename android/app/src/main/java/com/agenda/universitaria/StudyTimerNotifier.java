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
import android.content.res.ColorStateList;
import android.graphics.drawable.Drawable;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.text.format.DateFormat;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.DrawableCompat;
import java.util.Locale;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Modo estudio en Android: notificación en curso con el tiempo que queda en grande (cronómetro del
 * sistema dentro de una vista propia), la fase, una barra de avance y botones con ícono
 * (Pausar/Reanudar, Saltar y Detener), más la alarma exacta del fin de cada fase. El cambio de fase
 * no publica otra tarjeta: la misma notificación suena una vez con el tono de esa fase.
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
    static final String ACTION_SKIP = "com.agenda.universitaria.study.SKIP";
    /** Redibuja la barra de avance cada minuto mientras corre (sin despertar el teléfono). */
    static final String ACTION_TICK = "com.agenda.universitaria.study.TICK";
    private static final long TICK_MS = 60_000L;
    private static final String BREAK_HEX = "#2E7D32";
    static final String ACTION_PHASE_END = "com.agenda.universitaria.study.PHASE_END";

    private static final String PREFS = "study_timer_native";
    private static final String KEY_STATE = "state";
    private static final String KEY_EVENTS = "events";
    private static final int ONGOING_ID = 7_777_100;
    /** Aviso suelto: solo cuando no queda notificación en curso (ver finishPhase). */
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
                case ACTION_SKIP:
                    skipPhase(ctx, s, now);
                    return "skip";
                case ACTION_TICK:
                    render(ctx);
                    return null;
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
     * Avisa con la misma notificación en curso (suena una vez con el tono de la fase).
     */
    private static void finishPhase(Context ctx, JSONObject s, long end) throws Exception {
        boolean focusEnded = "focus".equals(s.optString("phase"));
        String tone;
        String message;
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
            tone = s.optString("breakTone");
            message = auto
                ? "Sesión terminada. Levántate, estírate y toma agua."
                : "Sesión terminada. Toca Empezar para tu descanso de " + Math.round(breakMs / 60000.0) + " min.";
        } else {
            long focusMs = s.optLong("focusMs");
            boolean auto = s.optBoolean("autoStartFocus", false);
            int longEvery = Math.max(1, s.optInt("longEvery", 4));
            int doneCount = s.optInt("focusCount");
            // El descanso que termina era el largo: cierre de ciclo, con su propio sonido
            boolean wasLong = doneCount > 0 && doneCount % longEvery == 0;
            s.put("phase", "focus");
            s.put("phaseTotalMs", focusMs);
            s.put("remainingMs", focusMs);
            s.put("running", auto);
            if (auto) s.put("endsAt", end + focusMs);
            saveState(ctx, s);
            tone = wasLong && !s.optString("longResumeTone").isEmpty() ? s.optString("longResumeTone") : s.optString("resumeTone");
            message = wasLong
                ? (auto ? "Terminó el descanso largo. Nuevo ciclo en marcha." : "Terminó el descanso largo. Toca Empezar para un nuevo ciclo.")
                : (auto ? "Se acabó el descanso. Ya estás estudiando otra vez." : "Se acabó el descanso. Toca Empezar para la siguiente sesión.");
        }
        queueEvent(ctx, "phaseEnd", end);
        if (!focusEnded && s.optInt("focusCount") == 0 && !s.optBoolean("running")) {
            // Sin sesiones hechas (y sin que empiece sola la siguiente), terminar el descanso es
            // volver al principio: la app quita la notificación en curso, así que el aviso va
            // aparte (sigue siendo una sola tarjeta)
            render(ctx);
            standaloneAlert(ctx, s, tone, "Se acabó el descanso", "Toca para empezar tu siguiente sesión de estudio.");
        } else {
            render(ctx, tone, message);
        }
    }

    /** Aviso suelto (se descarta al tocarlo); solo cuando no queda notificación en curso. */
    private static void standaloneAlert(Context ctx, JSONObject s, String tone, String title, String text) {
        String channelId = ensureAlertChannel(ctx, s.optBoolean("soundOn", true) ? tone : "silent");
        int color = parseColor(s.optString("color"), Color.parseColor("#00639B"));
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channelId)
            .setSmallIcon(R.drawable.ic_stat_study_timer)
            .setLargeIcon(circleIcon(ctx, R.drawable.ic_stat_study_timer, color))
            .setContentTitle(title)
            .setContentText(text)
            .setColor(color)
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

    /**
     * «Saltar» desde la notificación: como el botón de la app, pasa a la siguiente fase sin
     * empezarla (saltar la concentración no la cuenta como sesión hecha).
     */
    private static void skipPhase(Context ctx, JSONObject s, long now) throws Exception {
        int longEvery = Math.max(1, s.optInt("longEvery", 4));
        int focusCount = s.optInt("focusCount");
        if ("focus".equals(s.optString("phase"))) {
            boolean isLong = focusCount > 0 && focusCount % longEvery == 0;
            long breakMs = isLong ? s.optLong("longBreakMs") : s.optLong("shortBreakMs");
            s.put("phase", "break");
            s.put("phaseTotalMs", breakMs);
            s.put("remainingMs", breakMs);
        } else {
            long focusMs = s.optLong("focusMs");
            s.put("phase", "focus");
            s.put("phaseTotalMs", focusMs);
            s.put("remainingMs", focusMs);
            // Sin sesiones hechas, volver a concentración es volver al principio
            if (focusCount == 0) s.put("started", false);
        }
        s.put("running", false);
        saveState(ctx, s);
        queueEvent(ctx, "skip", now);
        render(ctx);
    }

    /* ------------------------------------------------------------------------------------------ */
    /* Notificaciones y alarma                                                                     */
    /* ------------------------------------------------------------------------------------------ */

    /** Dibuja (o quita) la notificación en curso según el estado guardado y programa la alarma. */
    static void render(Context ctx) {
        render(ctx, null, null);
    }

    /**
     * Con `alertTone`, la misma notificación se publica una vez en el canal de ese tono (suena y
     * aparece arriba) con `alertMessage` como detalle; el siguiente redibujo vuelve al canal silencioso
     * con el mismo id. Así un cambio de fase nunca deja dos tarjetas en la bandeja.
     */
    static void render(Context ctx, String alertTone, String alertMessage) {
        JSONObject s = loadState(ctx);
        NotificationManagerCompat nm = NotificationManagerCompat.from(ctx);
        if (s == null || !s.optBoolean("started")) {
            nm.cancel(ONGOING_ID);
            cancelAlarm(ctx);
            cancelTick(ctx);
            return;
        }
        ensureOngoingChannel(ctx);
        // Con la notificación en curso, el aviso suelto sobra (así nunca hay dos tarjetas)
        nm.cancel(ALERT_ID);

        boolean running = s.optBoolean("running");
        boolean isBreak = "break".equals(s.optString("phase"));
        long endsAt = s.optLong("endsAt");
        long now = System.currentTimeMillis();
        long remaining = running ? Math.max(0, endsAt - now) : s.optLong("remainingMs");
        String subject = s.optString("subject", "");
        long phaseTotal = s.optLong("phaseTotalMs", isBreak ? s.optLong("shortBreakMs") : s.optLong("focusMs"));
        boolean untouched = !running && remaining >= phaseTotal;
        int every = Math.max(1, s.optInt("longEvery", 4));
        int focusCount = s.optInt("focusCount");
        boolean waiting = untouched && !isBreak && focusCount > 0;
        // Durante la pausa, focusCount ya cuenta la sesión que acaba de terminar
        boolean isLongBreak = isBreak && focusCount > 0 && focusCount % every == 0;
        int sessionNumber = isBreak ? ((focusCount - 1) % every) + 1 : (focusCount % every) + 1;
        String session = "Sesión " + Math.max(1, sessionNumber) + " de " + every + (subject.isEmpty() ? "" : " · " + subject);
        String breakName = isLongBreak ? "Descanso largo" : "Descanso corto";

        // Fase (junto al tiempo) y detalle (debajo), sin emojis: los íconos ya dicen la fase
        String phase;
        String detail;
        if (isBreak) {
            phase = running || untouched ? breakName : "En pausa";
            detail = !running && !untouched ? breakName + " · toca Reanudar para seguir" : running
                ? "Vuelves a estudiar a las " + DateFormat.getTimeFormat(ctx).format(new java.util.Date(endsAt))
                : "Toca Empezar para tu descanso de " + Math.round(phaseTotal / 60000.0) + " min";
        } else if (waiting) {
            phase = "A estudiar";
            detail = "Toca Empezar · " + session;
        } else {
            phase = running || untouched ? "Concentración" : "En pausa";
            detail = running || untouched ? session : "Concentración · " + session;
        }
        if (alertMessage != null) detail = alertMessage;

        int phaseColor = parseColor(isBreak ? BREAK_HEX : s.optString("color"), Color.parseColor("#00639B"));
        int glyph = isBreak ? R.drawable.ic_stat_study_break : R.drawable.ic_stat_study_timer;
        int totalSec = (int) Math.max(1, phaseTotal / 1000);
        int elapsedSec = (int) Math.min(totalSec, Math.max(0, (phaseTotal - remaining) / 1000));

        RemoteViews small = timerViews(ctx, R.layout.notification_study_timer, running, remaining, phase, null, totalSec, elapsedSec, phaseColor);
        RemoteViews big = timerViews(ctx, R.layout.notification_study_timer_big, running, remaining, phase, detail, totalSec, elapsedSec, phaseColor);

        boolean alerting = alertTone != null;
        String channel = alerting ? ensureAlertChannel(ctx, s.optBoolean("soundOn", true) ? alertTone : "silent") : ONGOING_CHANNEL;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channel)
            .setSmallIcon(glyph)
            .setLargeIcon(circleIcon(ctx, glyph, phaseColor))
            // Título y texto para lectores de pantalla y para Android si no puede mostrar la vista
            .setContentTitle(clock(remaining) + " · " + phase)
            .setContentText(detail)
            .setCustomContentView(small)
            .setCustomBigContentView(big)
            .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
            .setColor(phaseColor)
            .setOngoing(true)
            .setShowWhen(false)
            .setOnlyAlertOnce(!alerting)
            .setSilent(!alerting)
            .setPriority(alerting ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(alerting ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(openAppIntent(ctx));

        // Acciones con ícono: Pausar o Empezar/Reanudar (cambia con el estado), Saltar y Detener
        if (running) {
            b.addAction(R.drawable.ic_notif_action_pause, "Pausar", actionIntent(ctx, ACTION_PAUSE, 1));
        } else {
            b.addAction(R.drawable.ic_notif_action_play, untouched ? "Empezar" : "Reanudar", actionIntent(ctx, ACTION_RESUME, 2));
        }
        b.addAction(R.drawable.ic_notif_action_skip, "Saltar", actionIntent(ctx, ACTION_SKIP, 6));
        b.addAction(R.drawable.ic_notif_action_stop, "Detener", actionIntent(ctx, ACTION_STOP, 3));

        try {
            nm.notify(ONGOING_ID, b.build());
        } catch (SecurityException ignored) {
            // Sin permiso de notificaciones: el temporizador sigue dentro de la app
        }
        if (running) {
            scheduleAlarm(ctx, endsAt);
            scheduleTick(ctx, Math.min(endsAt, now + TICK_MS));
        } else {
            cancelAlarm(ctx);
            cancelTick(ctx);
        }
    }

    /** Vista de la notificación: cronómetro (corre solo si está en marcha), fase, detalle y avance. */
    private static RemoteViews timerViews(Context ctx, int layout, boolean running, long remaining, String phase, String detail,
                                          int totalSec, int elapsedSec, int color) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), layout);
        // Cuenta regresiva: la base es «cuándo llega a cero» en el reloj del sistema; detenido, muestra lo que queda
        v.setChronometer(R.id.study_chrono, SystemClock.elapsedRealtime() + remaining, running ? null : chronoText(remaining), running);
        v.setChronometerCountDown(R.id.study_chrono, true);
        v.setTextViewText(R.id.study_phase, phase);
        if (detail != null) v.setTextViewText(R.id.study_detail, detail);
        v.setProgressBar(R.id.study_progress, totalSec, elapsedSec, false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            v.setColorStateList(R.id.study_progress, "setProgressTintList", ColorStateList.valueOf(color));
        }
        return v;
    }

    private static void scheduleTick(Context ctx, long at) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        // RTC (no _WAKEUP): solo cuando el teléfono está despierto, no gasta batería
        am.set(AlarmManager.RTC, at, actionIntent(ctx, ACTION_TICK, 7));
    }

    private static void cancelTick(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am != null) am.cancel(actionIntent(ctx, ACTION_TICK, 7));
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

    /** Mismo formato que el cronómetro del sistema: 04:58, 24:56 o 1:05:00. */
    private static String chronoText(long ms) {
        long total = (ms + 999) / 1000;
        long h = total / 3600;
        long m = (total % 3600) / 60;
        long sec = total % 60;
        return h > 0
            ? String.format(Locale.ROOT, "%d:%02d:%02d", h, m, sec)
            : String.format(Locale.ROOT, "%02d:%02d", m, sec);
    }

    private static String clock(long ms) {
        long total = (ms + 999) / 1000;
        return String.format(Locale.ROOT, "%d:%02d", total / 60, total % 60);
    }
}
