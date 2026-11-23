package com.agenda.universitaria.room;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Puente de la Sala de Intercambio Local con la interfaz (src/shared/plugins/localRoom.ts).
 * - Anfitrión: abre LocalRoomServer y reenvía cada petición y conexión SSE como evento.
 * - Invitado: HTTP y SSE nativos (LocalRoomServer.Client).
 * No necesita permisos nuevos: usa la red local que ya usa «Pasar datos con otro dispositivo».
 */
@CapacitorPlugin(name = "LocalRoom")
public class LocalRoomPlugin extends Plugin {

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

    @Override
    protected void handleOnDestroy() {
        stopServerInternal();
        synchronized (this) {
            if (client != null) client.closeAll();
        }
        super.handleOnDestroy();
    }
}
