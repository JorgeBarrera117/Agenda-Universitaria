package com.agenda.universitaria.room;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.agenda.universitaria.R;
import java.lang.ref.WeakReference;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Puente de la Sala de Intercambio Local con la interfaz (src/shared/plugins/localRoom.ts).
 * - Anfitrión: abre LocalRoomServer y reenvía cada petición y conexión SSE como evento.
 * - Invitado: HTTP y SSE nativos (LocalRoomServer.Client).
 * - Por cercanía (Fase 3): NearbyRoomTransport (Bluetooth y Wi-Fi Direct, sin red wifi). Sus
 *   permisos de "dispositivos cercanos" se piden solo al usarla, según la versión de Android.
 */
@CapacitorPlugin(
    name = "LocalRoom",
    permissions = {
        @Permission(alias = LocalRoomPlugin.ALIAS_BLUETOOTH, strings = {
            Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT
        }),
        @Permission(alias = LocalRoomPlugin.ALIAS_WIFI, strings = { Manifest.permission.NEARBY_WIFI_DEVICES }),
        @Permission(alias = LocalRoomPlugin.ALIAS_LOCATION, strings = {
            Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION
        }),
        @Permission(alias = LocalRoomPlugin.ALIAS_NOTIFICATIONS, strings = { Manifest.permission.POST_NOTIFICATIONS }),
    }
)
public class LocalRoomPlugin extends Plugin {

    static final String ALIAS_BLUETOOTH = "nearbyBluetooth";
    static final String ALIAS_WIFI = "nearbyWifi";
    static final String ALIAS_LOCATION = "nearbyLocation";
    static final String ALIAS_NOTIFICATIONS = "roomNotifications";
    static final String EXTRA_OPEN_ROOM = "agenda_open_local_room";
    static final String EXTRA_OPEN_CHAT = "agenda_open_local_room_chat";

    private static WeakReference<LocalRoomPlugin> instance = new WeakReference<>(null);
    /** La app está en primer plano (solo entonces NO se notifica: la sala ya se ve en pantalla). */
    private volatile boolean foreground = true;

    @Override
    public void load() {
        instance = new WeakReference<>(this);
        // Arranque en frío desde una notificación de la sala
        if (getActivity() != null) deliverOpenRequest(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        deliverOpenRequest(intent);
    }

    private void deliverOpenRequest(Intent intent) {
        if (intent == null || !intent.getBooleanExtra(EXTRA_OPEN_ROOM, false)) return;
        JSObject event = new JSObject();
        String chat = intent.getStringExtra(EXTRA_OPEN_CHAT);
        if (chat != null) event.put("chat", chat);
        intent.removeExtra(EXTRA_OPEN_ROOM);
        intent.removeExtra(EXTRA_OPEN_CHAT);
        // Retenido hasta que la interfaz escuche (arranque en frío)
        notifyListeners("roomOpenRequest", event, true);
    }

    /** El servicio pide salir de la sala (botón de la notificación). false = no hay interfaz viva. */
    static boolean emitNotificationAction(String action) {
        LocalRoomPlugin plugin = instance.get();
        if (plugin == null || plugin.getBridge() == null) return false;
        JSObject event = new JSObject();
        event.put("action", action);
        plugin.notifyListeners("roomNotificationAction", event, true);
        return true;
    }

    /* ------------------------------------------------------------------ Servicio en primer plano */

    private Intent serviceIntent(PluginCall call, String action) {
        Intent intent = new Intent(getContext(), LocalRoomForegroundService.class).setAction(action);
        intent.putExtra(LocalRoomForegroundService.EXTRA_ROOM, call.getString("roomName", "Sala Local"));
        intent.putExtra(LocalRoomForegroundService.EXTRA_SUBTITLE, call.getString("subtitle", "Conectado"));
        intent.putExtra(LocalRoomForegroundService.EXTRA_HOST, Boolean.TRUE.equals(call.getBoolean("isHost", false)));
        return intent;
    }

    /**
     * El WebView corre en un proceso aparte (renderer). Por defecto, cuando no se ve, Android lo
     * pasa a segundo plano y con la pantalla apagada casi no recibe CPU: el JavaScript de la sala
     * (motor del anfitrión, mensajes, avisos) quedaba en pausa hasta volver a la app (comprobado en
     * Android 17). Mientras haya sala, el renderer conserva la prioridad del servicio en primer plano.
     */
    private void keepRendererAwake(boolean keep) {
        roomActive = keep;
        if (getBridge() == null) return;
        getBridge().executeOnMainThread(() -> {
            android.webkit.WebView webView = getBridge().getWebView();
            if (webView != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                webView.setRendererPriorityPolicy(android.webkit.WebView.RENDERER_PRIORITY_IMPORTANT, !keep);
            }
        });
        if (keep) registerScreenOffReceiver();
        else unregisterScreenOffReceiver();
    }

    /* ------------------------------------------------------------------ WebView activo sin pantalla */
    // Chromium deja de ejecutar el JavaScript del WebView cuando su ventana pasa a «no visible»
    // (al apagar la pantalla): la conexión seguía viva, pero los mensajes se procesaban recién al
    // volver a la app (comprobado en Android 17). Mientras haya sala, tras pausar o apagar la
    // pantalla se le vuelve a indicar que su ventana está visible, como hacen los plugins de
    // segundo plano de Cordova. No dibuja nada: solo sigue ejecutando el motor de la sala.

    private volatile boolean roomActive = false;
    private android.content.BroadcastReceiver screenOffReceiver;

    private void keepWebViewRunning() {
        if (!roomActive || getBridge() == null) return;
        android.webkit.WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.postDelayed(() -> {
            if (roomActive) webView.dispatchWindowVisibilityChanged(android.view.View.VISIBLE);
        }, 1000);
    }

    private void registerScreenOffReceiver() {
        if (screenOffReceiver != null) return;
        screenOffReceiver = new android.content.BroadcastReceiver() {
            @Override
            public void onReceive(android.content.Context context, Intent intent) {
                keepWebViewRunning();
            }
        };
        android.content.IntentFilter filter = new android.content.IntentFilter(Intent.ACTION_SCREEN_OFF);
        ContextCompat.registerReceiver(getContext(), screenOffReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    private void unregisterScreenOffReceiver() {
        if (screenOffReceiver == null) return;
        try {
            getContext().unregisterReceiver(screenOffReceiver);
        } catch (IllegalArgumentException ignored) {
            // Ya no estaba registrado
        }
        screenOffReceiver = null;
    }

    /** Inicia o actualiza la notificación persistente de la sala. */
    @PluginMethod
    public void startRoomService(PluginCall call) {
        try {
            ContextCompat.startForegroundService(getContext(), serviceIntent(call, LocalRoomForegroundService.ACTION_START));
            keepRendererAwake(true);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo mantener la sala en segundo plano: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopRoomService(PluginCall call) {
        stopRoomServiceInternal();
        call.resolve();
    }

    private void stopRoomServiceInternal() {
        keepRendererAwake(false);
        try {
            getContext().startService(new Intent(getContext(), LocalRoomForegroundService.class).setAction(LocalRoomForegroundService.ACTION_STOP));
        } catch (Exception ignored) {
            // El servicio ya no corría
        }
    }

    @PluginMethod
    public void roomNotificationStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("permission", notificationPermission());
        call.resolve(result);
    }

    private String notificationPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            return NotificationManagerCompat.from(getContext()).areNotificationsEnabled() ? "granted" : "denied";
        }
        PermissionState state = getPermissionState(ALIAS_NOTIFICATIONS);
        return state == PermissionState.GRANTED ? "granted" : state == PermissionState.DENIED ? "denied" : "prompt";
    }

    @PluginMethod
    public void requestRoomNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || "granted".equals(notificationPermission())) {
            roomNotificationCallback(call);
            return;
        }
        requestPermissionForAlias(ALIAS_NOTIFICATIONS, call, "roomNotificationCallback");
    }

    @PermissionCallback
    private void roomNotificationCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("permission", notificationPermission());
        call.resolve(result);
    }

    /**
     * Aviso de mensaje, chat privado o elemento. Solo se muestra con la app en segundo plano; tocarlo
     * abre la sala (o el chat privado). Una notificación por conversación, que se actualiza.
     */
    @PluginMethod
    public void notifyRoomEvent(PluginCall call) {
        JSObject result = new JSObject();
        if (foreground) {
            result.put("shown", false);
            call.resolve(result);
            return;
        }
        String key = call.getString("key", "room");
        String chat = call.getString("chat");
        int id = 7400 + Math.abs(key.hashCode() % 500);
        postMessage(id, call.getString("title", "Sala Local"), call.getString("body", ""), chat);
        result.put("shown", true);
        call.resolve(result);
    }

    /** La sala terminó: se apaga el servicio y, si la app no está a la vista, se avisa. */
    @PluginMethod
    public void notifyRoomClosed(PluginCall call) {
        stopRoomServiceInternal();
        if (!foreground) postMessage(7399, call.getString("title", "La sala se ha cerrado"), call.getString("body", ""), null);
        call.resolve();
    }

    private void postMessage(int id, String title, String body, String chat) {
        try {
            LocalRoomForegroundService.ensureChannels(getContext());
            NotificationManagerCompat manager = NotificationManagerCompat.from(getContext());
            if (!manager.areNotificationsEnabled()) return;
            NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), LocalRoomForegroundService.CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_stat_agenda)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setContentIntent(LocalRoomForegroundService.openRoomIntent(getContext(), chat, id))
                .setAutoCancel(true)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setGroup(MESSAGE_GROUP);
            manager.notify(id, builder.build());
            pendingChats.put(id, chat == null ? "" : chat);
            // Resumen propio del grupo: sin él, Android agrupa solo y su resumen abre la app sin la
            // sala. Tocar el grupo abre la sala; cada aviso expandido abre su chat.
            NotificationCompat.Builder summary = new NotificationCompat.Builder(getContext(), LocalRoomForegroundService.CHANNEL_MESSAGES)
                .setSmallIcon(R.drawable.ic_stat_agenda)
                .setContentTitle("Sala Local")
                .setContentText("Mensajes nuevos en la sala")
                .setContentIntent(LocalRoomForegroundService.openRoomIntent(getContext(), summaryChat(), SUMMARY_ID))
                .setAutoCancel(true)
                .setGroup(MESSAGE_GROUP)
                .setGroupSummary(true)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN);
            manager.notify(SUMMARY_ID, summary.build());
        } catch (SecurityException ignored) {
            // Sin permiso de notificaciones: la sala sigue funcionando igual
        }
    }

    private static final String MESSAGE_GROUP = "com.agenda.universitaria.LOCAL_ROOM_MESSAGES";
    private static final int SUMMARY_ID = 7398;
    /** Avisos pendientes → chat que abren ("" = la sala). */
    private final Map<Integer, String> pendingChats = new ConcurrentHashMap<>();

    /** Si todos los avisos pendientes son del mismo chat privado, el grupo abre ese chat; si no, la sala. */
    private String summaryChat() {
        String only = null;
        for (String chat : pendingChats.values()) {
            if (chat.isEmpty() || (only != null && !only.equals(chat))) return null;
            only = chat;
        }
        return only;
    }

    /** Al volver a la app se quitan los avisos de mensajes (ya se ven en pantalla). */
    private void clearMessageNotifications() {
        NotificationManager manager = (NotificationManager) getContext().getSystemService(android.content.Context.NOTIFICATION_SERVICE);
        pendingChats.clear();
        if (manager == null) return;
        for (android.service.notification.StatusBarNotification active : manager.getActiveNotifications()) {
            if (active.getId() >= SUMMARY_ID && active.getId() < 7900) manager.cancel(active.getId());
        }
    }

    private LocalRoomServer server;
    private LocalRoomServer.Client client;
    private final ExecutorService requests = Executors.newCachedThreadPool();

    /* ------------------------------------------------------------------ Anfitrión */

    @PluginMethod
    public void startServer(PluginCall call) {
        stopServerInternal();
        final LocalRoomServer[] holder = new LocalRoomServer[1];
        LocalRoomServer created = new LocalRoomServer(new LocalRoomServer.Listener() {
            @Override
            public void onRequest(String id, String body, String remote) {
                JSObject event = new JSObject();
                event.put("id", id);
                event.put("body", body);
                event.put("remote", remote);
                notifyListeners("roomRequest", event);
            }

            @Override
            public void onStreamOpen(String streamId, String query, String remote) {
                JSObject event = new JSObject();
                event.put("streamId", streamId);
                event.put("query", query);
                event.put("remote", remote);
                notifyListeners("roomStreamOpen", event);
            }

            @Override
            public void onStreamClosed(String streamId) {
                JSObject event = new JSObject();
                event.put("streamId", streamId);
                notifyListeners("roomStreamClosed", event);
            }

            @Override
            public void onStopped(String reason) {
                synchronized (LocalRoomPlugin.this) {
                    if (server == holder[0]) server = null;
                }
                JSObject event = new JSObject();
                event.put("reason", reason);
                notifyListeners("roomStopped", event);
            }
        });
        holder[0] = created;
        try {
            LocalRoomServer.Info info = created.start();
            synchronized (this) {
                server = created;
            }
            JSObject result = new JSObject();
            result.put("port", info.port);
            result.put("hosts", new JSArray(info.hosts));
            call.resolve(result);
        } catch (Exception e) {
            created.stop();
            if ("NO_LAN".equals(e.getMessage())) call.reject("NO_LAN", "NO_LAN");
            else call.reject("No se pudo abrir la sala: " + e.getMessage());
        }
    }

    private synchronized void stopServerInternal() {
        if (server != null) {
            server.stop();
            server = null;
        }
    }

    private synchronized LocalRoomServer currentServer() {
        return server;
    }

    @PluginMethod
    public void stopServer(PluginCall call) {
        stopServerInternal();
        call.resolve();
    }

    @PluginMethod
    public void respond(PluginCall call) {
        LocalRoomServer current = currentServer();
        String id = call.getString("id");
        if (current != null && id != null) current.respond(id, call.getInt("status", 500), call.getString("body", ""));
        call.resolve();
    }

    @PluginMethod
    public void push(PluginCall call) {
        LocalRoomServer current = currentServer();
        String streamId = call.getString("streamId");
        String data = call.getString("data");
        // La escritura puede tardar con una red lenta: fuera del hilo del puente
        if (current != null && streamId != null && data != null) requests.execute(() -> current.push(streamId, data));
        call.resolve();
    }

    @PluginMethod
    public void closeStream(PluginCall call) {
        LocalRoomServer current = currentServer();
        String streamId = call.getString("streamId");
        if (current != null && streamId != null) requests.execute(() -> current.closeStream(streamId));
        call.resolve();
    }

    /* ------------------------------------------------------------------ Invitado */

    private synchronized LocalRoomServer.Client client() {
        if (client == null) {
            client = new LocalRoomServer.Client(new LocalRoomServer.Client.StreamListener() {
                @Override
                public void onData(String streamId, String data) {
                    JSObject event = new JSObject();
                    event.put("streamId", streamId);
                    event.put("data", data);
                    notifyListeners("roomClientData", event);
                }

                @Override
                public void onEnd(String streamId, String error) {
                    JSObject event = new JSObject();
                    event.put("streamId", streamId);
                    if (error != null) event.put("error", error);
                    notifyListeners("roomClientEnd", event);
                }
            });
        }
        return client;
    }

    @PluginMethod
    public void clientRequest(PluginCall call) {
        String url = call.getString("url");
        String body = call.getString("body", "");
        int timeoutMs = call.getInt("timeoutMs", 20_000);
        if (url == null) {
            call.reject("Falta la dirección");
            return;
        }
        requests.execute(() -> {
            try {
                LocalRoomServer.Client.Response response = LocalRoomServer.Client.request(url, body, timeoutMs);
                JSObject result = new JSObject();
                result.put("status", response.status);
                result.put("body", response.body);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("No se pudo conectar: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void clientOpenStream(PluginCall call) {
        String url = call.getString("url");
        String streamId = call.getString("streamId");
        try {
            client().openStream(url, streamId);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo conectar: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clientCloseStream(PluginCall call) {
        String streamId = call.getString("streamId");
        if (streamId != null) client().closeStream(streamId);
        call.resolve();
    }

    /* ------------------------------------------------------------------ Por cercanía (Nearby) */

    private NearbyRoomTransport nearby;
    /** Conexiones pedidas por el invitado: se resuelven cuando Nearby confirma o falla. */
    private final Map<String, PluginCall> pendingConnects = new ConcurrentHashMap<>();

    private synchronized NearbyRoomTransport nearby() {
        if (nearby == null) {
            nearby = new NearbyRoomTransport(getContext(), new NearbyRoomTransport.Listener() {
                @Override
                public void onEndpointFound(String endpointId, String name) {
                    JSObject event = new JSObject();
                    event.put("endpointId", endpointId);
                    event.put("name", name);
                    notifyListeners("nearbyFound", event);
                }

                @Override
                public void onEndpointLost(String endpointId) {
                    JSObject event = new JSObject();
                    event.put("endpointId", endpointId);
                    notifyListeners("nearbyLost", event);
                }

                @Override
                public void onConnected(String endpointId, String name) {
                    PluginCall call = pendingConnects.remove(endpointId);
                    if (call != null) call.resolve();
                    JSObject event = new JSObject();
                    event.put("endpointId", endpointId);
                    event.put("name", name);
                    notifyListeners("nearbyConnected", event);
                }

                @Override
                public void onConnectionFailed(String endpointId, String reason) {
                    PluginCall call = pendingConnects.remove(endpointId);
                    if (call != null) call.reject("No se pudo conectar con la sala cercana (" + reason + ").");
                }

                @Override
                public void onDisconnected(String endpointId) {
                    JSObject event = new JSObject();
                    event.put("endpointId", endpointId);
                    notifyListeners("nearbyDisconnected", event);
                }

                @Override
                public void onMessage(String endpointId, String data) {
                    JSObject event = new JSObject();
                    event.put("endpointId", endpointId);
                    event.put("data", data);
                    notifyListeners("nearbyMessage", event);
                }
            });
        }
        return nearby;
    }

    /**
     * Permisos de cercanía que corresponden a esta versión de Android.
     * discovery = buscar salas: Google Nearby exige además la ubicación precisa en todas las versiones
     * (anunciar no la necesita desde Android 12; antes, el Bluetooth la exigía siempre).
     */
    private String[] nearbyAliases(boolean discovery) {
        List<String> aliases = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) aliases.add(ALIAS_BLUETOOTH);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) aliases.add(ALIAS_WIFI);
        if (discovery || Build.VERSION.SDK_INT < Build.VERSION_CODES.S) aliases.add(ALIAS_LOCATION);
        return aliases.toArray(new String[0]);
    }

    /** granted | prompt | denied (denied = el usuario los negó y hay que ir a Ajustes). */
    private String nearbyPermissionState(boolean discovery) {
        String result = "granted";
        for (String alias : nearbyAliases(discovery)) {
            PermissionState state = getPermissionState(alias);
            if (state == PermissionState.DENIED) return "denied";
            if (state != PermissionState.GRANTED) result = "prompt";
        }
        return result;
    }

    @PluginMethod
    public void nearbyStatus(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", NearbyRoomTransport.isAvailable(getContext()));
        result.put("permission", nearbyPermissionState(false));
        result.put("discoveryPermission", nearbyPermissionState(true));
        call.resolve(result);
    }

    private static boolean isDiscovery(PluginCall call) {
        return "guest".equals(call.getString("purpose"));
    }

    @PluginMethod
    public void requestNearbyPermissions(PluginCall call) {
        String[] aliases = nearbyAliases(isDiscovery(call));
        if (aliases.length == 0 || "granted".equals(nearbyPermissionState(isDiscovery(call)))) {
            nearbyPermissionsCallback(call);
            return;
        }
        requestPermissionForAliases(aliases, call, "nearbyPermissionsCallback");
    }

    @PermissionCallback
    private void nearbyPermissionsCallback(PluginCall call) {
        JSObject result = new JSObject();
        result.put("permission", nearbyPermissionState(isDiscovery(call)));
        call.resolve(result);
    }

    private boolean nearbyReady(PluginCall call, boolean discovery) {
        if (!NearbyRoomTransport.isAvailable(getContext())) {
            call.reject("Este teléfono no tiene los servicios de Google Play que necesitan las salas cercanas.", "NO_GMS");
            return false;
        }
        if (!"granted".equals(nearbyPermissionState(discovery))) {
            call.reject("Falta el permiso de dispositivos cercanos.", "NO_PERMISSION");
            return false;
        }
        return true;
    }

    private NearbyRoomTransport.Done done(PluginCall call, String failMessage) {
        return new NearbyRoomTransport.Done() {
            @Override
            public void ok() {
                call.resolve();
            }

            @Override
            public void fail(String message) {
                call.reject(failMessage + (message == null ? "" : " (" + message + ")"));
            }
        };
    }

    @PluginMethod
    public void nearbyStartAdvertising(PluginCall call) {
        if (!nearbyReady(call, false)) return;
        String name = call.getString("name", "Sala");
        nearby().startAdvertising(name, done(call, "No se pudo anunciar la sala por cercanía. Revisa que el Bluetooth esté activado."));
    }

    @PluginMethod
    public void nearbyStartDiscovery(PluginCall call) {
        if (!nearbyReady(call, true)) return;
        nearby().startDiscovery(done(call, "No se pudo buscar salas cercanas. Revisa que el Bluetooth esté activado."));
    }

    @PluginMethod
    public void nearbyStopDiscovery(PluginCall call) {
        if (nearby != null) nearby.stopDiscovery();
        call.resolve();
    }

    @PluginMethod
    public void nearbyConnect(PluginCall call) {
        if (!nearbyReady(call, true)) return;
        String endpointId = call.getString("endpointId");
        if (endpointId == null) {
            call.reject("Falta la sala");
            return;
        }
        if (nearby().isConnected(endpointId)) {
            call.resolve();
            return;
        }
        call.setKeepAlive(true);
        pendingConnects.put(endpointId, call);
        nearby().connect(endpointId, call.getString("name", "Invitado"), new NearbyRoomTransport.Done() {
            @Override
            public void ok() {
                // Se resuelve en onConnected (cuando ambos aceptan)
            }

            @Override
            public void fail(String message) {
                PluginCall pending = pendingConnects.remove(endpointId);
                if (pending != null) pending.reject("No se pudo conectar con la sala cercana" + (message == null ? "." : " (" + message + ")."));
            }
        });
    }

    @PluginMethod
    public void nearbySend(PluginCall call) {
        String endpointId = call.getString("endpointId");
        String data = call.getString("data");
        if (nearby != null && endpointId != null && data != null) nearby.send(endpointId, data);
        call.resolve();
    }

    @PluginMethod
    public void nearbyDisconnect(PluginCall call) {
        String endpointId = call.getString("endpointId");
        if (nearby != null && endpointId != null) nearby.disconnect(endpointId);
        call.resolve();
    }

    @PluginMethod
    public void nearbyStopAll(PluginCall call) {
        if (nearby != null) nearby.stopAll();
        for (PluginCall pending : pendingConnects.values()) pending.reject("Cancelado");
        pendingConnects.clear();
        call.resolve();
    }

    @Override
    protected void handleOnStop() {
        keepWebViewRunning();
        super.handleOnStop();
    }

    @Override
    protected void handleOnPause() {
        foreground = false;
        keepWebViewRunning();
        // Batería: en segundo plano no se BUSCAN salas. La sala abierta (anuncio y conexiones) sigue:
        // solo se sale con «Salir de la sala» o cuando el anfitrión la cierra.
        if (nearby != null) nearby.pause();
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        foreground = true;
        if (nearby != null) nearby.resumeAdvertising();
        clearMessageNotifications();
        super.handleOnResume();
    }

    @Override
    protected void handleOnDestroy() {
        stopRoomServiceInternal();
        if (nearby != null) nearby.stopAll();
        stopServerInternal();
        synchronized (this) {
            if (client != null) client.closeAll();
        }
        super.handleOnDestroy();
    }
}
