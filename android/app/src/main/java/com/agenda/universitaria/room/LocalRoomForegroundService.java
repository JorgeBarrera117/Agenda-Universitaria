package com.agenda.universitaria.room;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import com.agenda.universitaria.MainActivity;
import com.agenda.universitaria.R;

/**
 * Mantiene viva la Sala Local con la app en segundo plano o la pantalla bloqueada.
 *
 * Mientras el estudiante está en una sala (anfitrión o invitado), este servicio en primer plano:
 * - evita que Android / HyperOS congele el proceso: el WebView (KeepRunning de Capacitor), el
 *   servidor HTTP/SSE de la red local, el cliente SSE y las conexiones de Nearby siguen activos;
 * - mantiene la CPU (wake lock parcial) y el wifi en alto rendimiento (WifiLock), porque con la
 *   pantalla apagada Android duerme el wifi y la sala se cortaría;
 * - muestra la notificación persistente con el nombre de la sala, los participantes y la acción
 *   «Salir de la sala» (o «Cerrar sala» si es el anfitrión).
 * Solo se detiene cuando el estudiante sale o el anfitrión cierra la sala (nunca al minimizar).
 */
public class LocalRoomForegroundService extends Service {

    static final String ACTION_START = "com.agenda.universitaria.room.START";
    static final String ACTION_STOP = "com.agenda.universitaria.room.STOP";
    static final String ACTION_LEAVE = "com.agenda.universitaria.room.LEAVE";
    static final String EXTRA_ROOM = "roomName";
    static final String EXTRA_SUBTITLE = "subtitle";
    static final String EXTRA_HOST = "isHost";

    static final String CHANNEL_ONGOING = "local_room_ongoing";
    static final String CHANNEL_MESSAGES = "local_room_messages";
    static final int NOTIFICATION_ID = 7301;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    static void ensureChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel ongoing = new NotificationChannel(CHANNEL_ONGOING, "Sala Local activa", NotificationManager.IMPORTANCE_LOW);
        ongoing.setDescription("Mantiene la Sala Local conectada mientras usas otras apps.");
        ongoing.setShowBadge(false);
        manager.createNotificationChannel(ongoing);
        NotificationChannel messages = new NotificationChannel(CHANNEL_MESSAGES, "Mensajes de la Sala Local", NotificationManager.IMPORTANCE_HIGH);
        messages.setDescription("Mensajes, chats privados y elementos compartidos mientras la app está en segundo plano.");
        manager.createNotificationChannel(messages);
    }

    /** Abre la app en la sala (o en un chat privado) al tocar una notificación. */
    static PendingIntent openRoomIntent(Context context, @Nullable String chat, int requestCode) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(LocalRoomPlugin.EXTRA_OPEN_ROOM, true);
        if (chat != null) open.putExtra(LocalRoomPlugin.EXTRA_OPEN_CHAT, chat);
        return PendingIntent.getActivity(context, requestCode, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private Notification build(String roomName, String subtitle, boolean isHost) {
        Intent leave = new Intent(this, LocalRoomForegroundService.class).setAction(ACTION_LEAVE);
        PendingIntent leaveIntent = PendingIntent.getService(this, 1, leave, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, CHANNEL_ONGOING)
            .setSmallIcon(R.drawable.ic_stat_agenda)
            .setContentTitle(roomName)
            .setContentText(subtitle)
            .setContentIntent(openRoomIntent(this, null, 0))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(R.drawable.ic_notif_action_stop, isHost ? "Cerrar sala" : "Salir de la sala", leaveIntent)
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if (ACTION_STOP.equals(action)) {
            shutdown();
            return START_NOT_STICKY;
        }
        if (ACTION_LEAVE.equals(action)) {
            // La interfaz sale de la sala (o la cierra) y después detiene este servicio. Si la
            // interfaz ya no existe, no hay sala que mantener: se detiene aquí.
            if (!LocalRoomPlugin.emitNotificationAction("leave")) shutdown();
            return START_NOT_STICKY;
        }
        ensureChannels(this);
        String roomName = intent == null ? null : intent.getStringExtra(EXTRA_ROOM);
        String subtitle = intent == null ? null : intent.getStringExtra(EXTRA_SUBTITLE);
        boolean isHost = intent != null && intent.getBooleanExtra(EXTRA_HOST, false);
        Notification notification = build(roomName == null ? "Sala Local" : roomName, subtitle == null ? "Conectado" : subtitle, isHost);
        int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type);
        acquireLocks();
        // Si Android mata el proceso, la sala ya no existe (vive en la memoria de la app): no reiniciar
        return START_NOT_STICKY;
    }

    private void acquireLocks() {
        if (wakeLock == null) {
            PowerManager power = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (power != null) {
                wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "AgendaUniversitaria:LocalRoom");
                wakeLock.setReferenceCounted(false);
                wakeLock.acquire();
            }
        }
        if (wifiLock == null) {
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifi != null) {
                int mode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? WifiManager.WIFI_MODE_FULL_LOW_LATENCY : WifiManager.WIFI_MODE_FULL_HIGH_PERF;
                wifiLock = wifi.createWifiLock(mode, "AgendaUniversitaria:LocalRoom");
                wifiLock.setReferenceCounted(false);
                wifiLock.acquire();
            }
        }
    }

    private void releaseLocks() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
        if (wifiLock != null && wifiLock.isHeld()) wifiLock.release();
        wifiLock = null;
    }

    private void shutdown() {
        releaseLocks();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        releaseLocks();
        super.onDestroy();
    }

    /** Al quitar la app de recientes, la sala (que vive en la interfaz) se pierde: se apaga todo. */
    @Override
    public void onTaskRemoved(Intent rootIntent) {
        shutdown();
        super.onTaskRemoved(rootIntent);
    }
}
