package com.agenda.universitaria.room;

import android.content.Context;
import androidx.annotation.NonNull;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.nearby.Nearby;
import com.google.android.gms.nearby.connection.AdvertisingOptions;
import com.google.android.gms.nearby.connection.ConnectionInfo;
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback;
import com.google.android.gms.nearby.connection.ConnectionResolution;
import com.google.android.gms.nearby.connection.ConnectionsClient;
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes;
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo;
import com.google.android.gms.nearby.connection.DiscoveryOptions;
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback;
import com.google.android.gms.nearby.connection.Payload;
import com.google.android.gms.nearby.connection.PayloadCallback;
import com.google.android.gms.nearby.connection.PayloadTransferUpdate;
import com.google.android.gms.nearby.connection.Strategy;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Sala Local por cercanía: Google Nearby Connections (Bluetooth, BLE y Wi-Fi Direct), sin red wifi.
 *
 * Es un transporte de mensajes de texto entre teléfonos, nada más. Encima viaja exactamente el
 * mismo protocolo cifrado que por la red local (peticiones, respuestas y eventos SSE se arman en
 * TypeScript, ver nearbyLink.ts), así que el motor de la sala, el PIN, los chats privados y los
 * bloques de archivos con progreso son los mismos.
 *
 * - Topología P2P_STAR: el anfitrión se anuncia; los invitados lo descubren y se conectan a él.
 * - Las conexiones se aceptan sin código de verificación: quien no sepa el PIN no puede descifrar
 *   nada ni entrar a la sala (lo valida el motor).
 * - Mensajes de hasta 32 KB: Payload.fromBytes. Mayores (un bloque de archivo cifrado, ~0,9 MB):
 *   Payload.fromStream, que se lee en un hilo aparte. Se prefiere a Payload.fromFile porque no
 *   deja copias en la carpeta pública de descargas (Android 9 y anteriores) ni archivos que borrar.
 */
public final class NearbyRoomTransport {

    public interface Listener {
        void onEndpointFound(String endpointId, String name);
        void onEndpointLost(String endpointId);
        void onConnected(String endpointId, String name);
        void onConnectionFailed(String endpointId, String reason);
        void onDisconnected(String endpointId);
        void onMessage(String endpointId, String data);
    }

    /** Identifica el servicio: solo se ven entre sí las salas de esta app y esta versión del protocolo. */
    static final String SERVICE_ID = "com.agenda.universitaria.localroom.v3";
    private static final Strategy STRATEGY = Strategy.P2P_STAR;
    /** Tope de un mensaje recibido (un bloque cifrado ocupa ~0,9 MB). */
    private static final int MAX_MESSAGE_BYTES = LocalRoomServer.MAX_BODY_BYTES;

    private final ConnectionsClient client;
    private final Listener listener;
    private final Set<String> connected = ConcurrentHashMap.newKeySet();
    private final Map<String, String> names = new ConcurrentHashMap<>();
    private final ExecutorService readers = Executors.newCachedThreadPool();
    private volatile boolean advertising = false;
    private volatile boolean discovering = false;
    private volatile String advertisingName = null;

    public NearbyRoomTransport(Context context, Listener listener) {
        this.client = Nearby.getConnectionsClient(context);
        this.listener = listener;
    }

    /** Nearby necesita los servicios de Google Play (no están, p. ej., en teléfonos Huawei recientes). */
    public static boolean isAvailable(Context context) {
        try {
            return GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS;
        } catch (Exception e) {
            return false;
        }
    }

    /* ------------------------------------------------------------------ Conexiones */

    private final PayloadCallback payloadCallback = new PayloadCallback() {
        @Override
        public void onPayloadReceived(@NonNull String endpointId, @NonNull Payload payload) {
            if (payload.getType() == Payload.Type.BYTES) {
                byte[] bytes = payload.asBytes();
                if (bytes != null) listener.onMessage(endpointId, new String(bytes, StandardCharsets.UTF_8));
            } else if (payload.getType() == Payload.Type.STREAM) {
                Payload.Stream stream = payload.asStream();
                if (stream == null) return;
                // El flujo se va llenando mientras llega: se lee completo en otro hilo
                readers.execute(() -> {
                    try (InputStream in = stream.asInputStream()) {
                        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                        byte[] chunk = new byte[32 * 1024];
                        int n;
                        while ((n = in.read(chunk)) != -1) {
                            buffer.write(chunk, 0, n);
                            if (buffer.size() > MAX_MESSAGE_BYTES) throw new IOException("too-large");
                        }
                        listener.onMessage(endpointId, buffer.toString(StandardCharsets.UTF_8.name()));
                    } catch (IOException ignored) {
                        // Mensaje cortado o anómalo: el protocolo lo reintenta o lo da por perdido
                    }
                });
            }
        }

        @Override
        public void onPayloadTransferUpdate(@NonNull String endpointId, @NonNull PayloadTransferUpdate update) {
            // El avance se mide por bloques en la interfaz (transferProgress), no por mensaje
        }
    };

    private final ConnectionLifecycleCallback lifecycle = new ConnectionLifecycleCallback() {
        @Override
        public void onConnectionInitiated(@NonNull String endpointId, @NonNull ConnectionInfo info) {
            names.put(endpointId, info.getEndpointName());
            client.acceptConnection(endpointId, payloadCallback);
        }

        @Override
        public void onConnectionResult(@NonNull String endpointId, @NonNull ConnectionResolution result) {
            if (result.getStatus().getStatusCode() == ConnectionsStatusCodes.STATUS_OK) {
                connected.add(endpointId);
                String name = names.get(endpointId);
                listener.onConnected(endpointId, name == null ? "" : name);
            } else {
                names.remove(endpointId);
                listener.onConnectionFailed(endpointId, ConnectionsStatusCodes.getStatusCodeString(result.getStatus().getStatusCode()));
            }
        }

        @Override
        public void onDisconnected(@NonNull String endpointId) {
            connected.remove(endpointId);
            names.remove(endpointId);
            listener.onDisconnected(endpointId);
        }
    };

    private final EndpointDiscoveryCallback discovery = new EndpointDiscoveryCallback() {
        @Override
        public void onEndpointFound(@NonNull String endpointId, @NonNull DiscoveredEndpointInfo info) {
            if (SERVICE_ID.equals(info.getServiceId())) listener.onEndpointFound(endpointId, info.getEndpointName());
        }

        @Override
        public void onEndpointLost(@NonNull String endpointId) {
            listener.onEndpointLost(endpointId);
        }
    };

    private static boolean hasCode(Exception e, int code) {
        return e instanceof ApiException && ((ApiException) e).getStatusCode() == code;
    }

    /* ------------------------------------------------------------------ Anfitrión */

    public interface Done {
        void ok();
        void fail(String message);
    }

    public void startAdvertising(String name, Done done) {
        advertisingName = name;
        AdvertisingOptions options = new AdvertisingOptions.Builder().setStrategy(STRATEGY).build();
        client.startAdvertising(name, SERVICE_ID, lifecycle, options)
            .addOnSuccessListener(unused -> {
                advertising = true;
                done.ok();
            })
            .addOnFailureListener(e -> {
                // Ya se estaba anunciando (p. ej. al volver de segundo plano): no es un error
                if (hasCode(e, ConnectionsStatusCodes.STATUS_ALREADY_ADVERTISING)) {
                    advertising = true;
                    done.ok();
                } else {
                    done.fail(e.getMessage());
                }
            });
    }

    public void stopAdvertising() {
        if (advertising) client.stopAdvertising();
        advertising = false;
    }

    /** Al volver a primer plano se vuelve a anunciar si la sala sigue abierta. */
    public void resumeAdvertising() {
        String name = advertisingName;
        if (name != null && !advertising) {
            startAdvertising(name, new Done() {
                @Override
                public void ok() {}

                @Override
                public void fail(String message) {}
            });
        }
    }

    /* ------------------------------------------------------------------ Invitado */

    public void startDiscovery(Done done) {
        DiscoveryOptions options = new DiscoveryOptions.Builder().setStrategy(STRATEGY).build();
        client.startDiscovery(SERVICE_ID, discovery, options)
            .addOnSuccessListener(unused -> {
                discovering = true;
                done.ok();
            })
            .addOnFailureListener(e -> {
                if (hasCode(e, ConnectionsStatusCodes.STATUS_ALREADY_DISCOVERING)) {
                    discovering = true;
                    done.ok();
                } else {
                    done.fail(e.getMessage());
                }
            });
    }

    public void stopDiscovery() {
        if (discovering) client.stopDiscovery();
        discovering = false;
    }

    public void connect(String endpointId, String myName, Done done) {
        if (connected.contains(endpointId)) {
            done.ok();
            return;
        }
        // Buscar mientras se conecta ocupa la radio y vuelve lenta la conexión
        stopDiscovery();
        client.requestConnection(myName, endpointId, lifecycle)
            .addOnSuccessListener(unused -> done.ok())
            .addOnFailureListener(e -> {
                if (hasCode(e, ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT)) done.ok();
                else done.fail(e.getMessage());
            });
    }

    /* ------------------------------------------------------------------ Mensajes */

    public boolean isConnected(String endpointId) {
        return connected.contains(endpointId);
    }

    public void send(String endpointId, String data) {
        if (!connected.contains(endpointId) || data == null) return;
        byte[] bytes = data.getBytes(StandardCharsets.UTF_8);
        Payload payload = bytes.length <= ConnectionsClient.MAX_BYTES_DATA_SIZE
            ? Payload.fromBytes(bytes)
            : Payload.fromStream(new ByteArrayInputStream(bytes));
        client.sendPayload(endpointId, payload);
    }

    public void disconnect(String endpointId) {
        client.disconnectFromEndpoint(endpointId);
        connected.remove(endpointId);
        names.remove(endpointId);
    }

    /** Apaga todo: anuncio, búsqueda y conexiones (al salir de la sala o cerrar la app). */
    public void stopAll() {
        advertisingName = null;
        stopAdvertising();
        stopDiscovery();
        client.stopAllEndpoints();
        connected.clear();
        names.clear();
    }

    /**
     * En segundo plano se deja de BUSCAR (batería). El anuncio de una sala abierta y sus conexiones
     * siguen (el servicio en primer plano mantiene viva la app): nadie sale por minimizar.
     */
    public void pause() {
        stopDiscovery();
    }

    public boolean isAdvertising() {
        return advertising;
    }
}
