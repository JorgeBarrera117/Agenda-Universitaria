package com.agenda.universitaria.room;

import android.Manifest;
import android.os.Build;
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
    }
)
public class LocalRoomPlugin extends Plugin {

    static final String ALIAS_BLUETOOTH = "nearbyBluetooth";
    static final String ALIAS_WIFI = "nearbyWifi";
    static final String ALIAS_LOCATION = "nearbyLocation";

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
    protected void handleOnPause() {
        // Batería: en segundo plano no se anuncia ni se busca; las conexiones abiertas siguen
        if (nearby != null) nearby.pause();
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        if (nearby != null) nearby.resumeAdvertising();
        super.handleOnResume();
    }

    @Override
    protected void handleOnDestroy() {
        if (nearby != null) nearby.stopAll();
        stopServerInternal();
        synchronized (this) {
            if (client != null) client.closeAll();
        }
        super.handleOnDestroy();
    }
}
