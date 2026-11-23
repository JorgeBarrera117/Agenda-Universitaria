package com.agenda.universitaria.room;

import com.agenda.universitaria.LocalTransferServer;
import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Sala de Intercambio Local (Android). Es el equivalente de electron/roomServer.cjs.
 *
 * Anfitrión: servidor HTTP mínimo en la red local que solo hace de puente. No entiende la sala:
 *   POST /room/v1/rpc     → entrega el cuerpo a la interfaz (onRequest) y espera respond()
 *   GET  /room/v1/events  → Server-Sent Events: registra la conexión (onStreamOpen) y escribe lo
 *                           que la interfaz empuja con push(); un comentario cada 15 s la mantiene
 *                           viva y detecta a quien se fue.
 * El motor de la sala (PIN, sala de espera, reglas) vive en TypeScript (roomHostEngine.ts) y todo
 * lo que pasa por aquí ya va cifrado con AES-256-GCM.
 *
 * Invitado (clase Client): HTTP y SSE nativos, porque el WebView corre en https://localhost y
 * bloquea http:// hacia la red local.
 *
 * Java puro (sin clases de Android) para poder probarlo fuera del teléfono.
 */
public final class LocalRoomServer {

    public interface Listener {
        void onRequest(String id, String body, String remote);
        void onStreamOpen(String streamId, String query, String remote);
        void onStreamClosed(String streamId);
        void onStopped(String reason);
    }

    public static final class Info {
        public final int port;
        public final List<String> hosts;

        Info(int port, List<String> hosts) {
            this.port = port;
            this.hosts = hosts;
        }
    }

    static final String BASE_PATH = "/room/v1";
    /** Tope de una petición (un elemento de hasta 10 MB, cifrado y en base64). */
    static final int MAX_BODY_BYTES = 40 * 1024 * 1024;
    private static final int MAX_HEADER_BYTES = 16 * 1024;
    private static final long RESPONSE_TIMEOUT_MS = 30_000L;
    private static final long HEARTBEAT_MS = 15_000L;
    private static final int MAX_STREAMS = 80;

    private static final class Pending {
        final CountDownLatch done = new CountDownLatch(1);
        volatile int status = 504;
        volatile String body = "{\"error\":\"bad-request\"}";
    }

    private static final class Stream {
        final Socket socket;
        final OutputStream out;

        Stream(Socket socket, OutputStream out) {
            this.socket = socket;
            this.out = out;
        }
    }

    private final Listener listener;
    private final AtomicBoolean stopped = new AtomicBoolean(false);
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final Map<String, Stream> streams = new ConcurrentHashMap<>();
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private final ScheduledExecutorService heartbeat = Executors.newSingleThreadScheduledExecutor();
    private final SecureRandom random = new SecureRandom();
    private ServerSocket serverSocket;

    public LocalRoomServer(Listener listener) {
        this.listener = listener;
    }

    /** Abre el servidor en un puerto libre. Lanza IOException("NO_LAN") sin wifi ni punto de acceso. */
    public Info start() throws IOException {
        List<String> hosts = LocalTransferServer.lanAddresses();
        if (hosts.isEmpty()) throw new IOException("NO_LAN");
        serverSocket = new ServerSocket(0, 32);
        Thread acceptor = new Thread(this::acceptLoop, "agenda-room-accept");
        acceptor.setDaemon(true);
        acceptor.start();
        heartbeat.scheduleWithFixedDelay(this::sendHeartbeat, HEARTBEAT_MS, HEARTBEAT_MS, TimeUnit.MILLISECONDS);
        return new Info(serverSocket.getLocalPort(), hosts);
    }

    public void stop() {
        shutdown(null);
    }

    private void shutdown(String reason) {
        if (!stopped.compareAndSet(false, true)) return;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
            // Ya estaba cerrado
        }
        heartbeat.shutdownNow();
        for (Pending p : pending.values()) {
            p.status = 410;
            p.body = "{\"error\":\"gone\"}";
            p.done.countDown();
        }
        pending.clear();
        for (Stream s : streams.values()) closeQuietly(s.socket);
        streams.clear();
        workers.shutdown();
        if (reason != null && listener != null) listener.onStopped(reason);
    }

    private void acceptLoop() {
        while (!stopped.get()) {
            try {
                Socket socket = serverSocket.accept();
                workers.execute(() -> handle(socket));
            } catch (IOException e) {
                if (!stopped.get()) shutdown("se perdió la red local");
                return;
            } catch (RuntimeException e) {
                // Ejecutor cerrado mientras se apagaba
                return;
            }
        }
    }

    /* ------------------------------------------------------------------ Puente con la interfaz */

    public void respond(String id, int status, String body) {
        Pending p = pending.get(id);
        if (p == null) return;
        p.status = status >= 200 && status < 600 ? status : 500;
        p.body = body == null ? "" : body;
        p.done.countDown();
    }

    public void push(String streamId, String data) {
        Stream s = streams.get(streamId);
        if (s == null || data == null) return;
        // Una sola línea (base64): no puede romper el formato SSE
        String clean = data.replace("\r", "").replace("\n", "");
        if (!write(s, "data: " + clean + "\n\n")) dropStream(streamId, true);
    }

    public void closeStream(String streamId) {
        dropStream(streamId, false);
    }

    private boolean write(Stream s, String text) {
        synchronized (s) {
            try {
                s.out.write(text.getBytes(StandardCharsets.UTF_8));
                s.out.flush();
                return true;
            } catch (IOException e) {
                return false;
            }
        }
    }

    private void dropStream(String streamId, boolean notify) {
        Stream s = streams.remove(streamId);
        if (s == null) return;
        closeQuietly(s.socket);
        if (notify && listener != null && !stopped.get()) listener.onStreamClosed(streamId);
    }

    private void sendHeartbeat() {
        for (Map.Entry<String, Stream> entry : streams.entrySet()) {
            if (!write(entry.getValue(), ": ping\n\n")) dropStream(entry.getKey(), true);
        }
    }

    private String newId() {
        byte[] bytes = new byte[9];
        random.nextBytes(bytes);
        StringBuilder hex = new StringBuilder();
        for (byte b : bytes) hex.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        return hex.toString();
    }

    /* ------------------------------------------------------------------ HTTP mínimo */

    private void handle(Socket socket) {
        boolean keepOpen = false;
        try {
            socket.setSoTimeout(60_000);
            InputStream in = new BufferedInputStream(socket.getInputStream());
            OutputStream out = socket.getOutputStream();
            String head = readHead(in);
            if (head == null) return;
            String[] lines = head.split("\r\n");
            String[] requestLine = lines[0].split(" ");
            if (requestLine.length < 2) {
                respondJson(out, 400, "{\"error\":\"bad-request\"}");
                return;
            }
            String method = requestLine[0];
            String target = requestLine[1];
            String path = target;
            String query = "";
            int q = target.indexOf('?');
            if (q >= 0) {
                path = target.substring(0, q);
                query = target.substring(q + 1);
            }
            long length = -1;
            for (int i = 1; i < lines.length; i++) {
                int colon = lines[i].indexOf(':');
                if (colon > 0 && "content-length".equals(lines[i].substring(0, colon).trim().toLowerCase(Locale.ROOT))) {
                    try {
                        length = Long.parseLong(lines[i].substring(colon + 1).trim());
                    } catch (NumberFormatException ignored) {
                        length = -1;
                    }
                }
            }
            String remote = socket.getInetAddress() == null ? "" : socket.getInetAddress().getHostAddress();

            if (stopped.get()) {
                respondJson(out, 410, "{\"error\":\"gone\"}");
                return;
            }

            if ((BASE_PATH + "/rpc").equals(path) && "POST".equals(method)) {
                if (length < 0) {
                    respondJson(out, 411, "{\"error\":\"bad-request\"}");
                    return;
                }
                if (length > MAX_BODY_BYTES) {
                    respondJson(out, 413, "{\"error\":\"too-large\"}");
                    return;
                }
                byte[] body = readExactly(in, (int) length);
                if (body == null) return;
                String id = newId();
                Pending p = new Pending();
                pending.put(id, p);
                if (listener != null) listener.onRequest(id, new String(body, StandardCharsets.UTF_8), remote);
                try {
                    p.done.await(RESPONSE_TIMEOUT_MS, TimeUnit.MILLISECONDS);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
                pending.remove(id);
                respondJson(out, p.status, p.body);
                return;
            }

            if ((BASE_PATH + "/events").equals(path) && "GET".equals(method)) {
                if (streams.size() >= MAX_STREAMS) {
                    respondJson(out, 503, "{\"error\":\"full\"}");
                    return;
                }
                String streamId = newId();
                Stream stream = new Stream(socket, out);
                socket.setSoTimeout(0);
                socket.setTcpNoDelay(true);
                socket.setKeepAlive(true);
                String headers = "HTTP/1.1 200 OK\r\n"
                    + "Content-Type: text/event-stream; charset=utf-8\r\n"
                    + "Cache-Control: no-store\r\n"
                    + "Connection: keep-alive\r\n\r\n"
                    + ": ok\n\n";
                if (!write(stream, headers)) return;
                streams.put(streamId, stream);
                keepOpen = true;
                if (listener != null) listener.onStreamOpen(streamId, query, remote);
                // El hilo queda leyendo: -1 o un error significa que el otro lado se fue
                try {
                    while (in.read() != -1) {
                        // El cliente no debería mandar nada más; se ignora
                    }
                } catch (IOException ignored) {
                    // Conexión cortada
                }
                dropStream(streamId, true);
                return;
            }

            respondJson(out, 404, "{\"error\":\"not-found\"}");
        } catch (IOException ignored) {
            // Conexión lenta o cortada: no afecta a la sala
        } finally {
            if (!keepOpen) closeQuietly(socket);
        }
    }

    private static void closeQuietly(Socket socket) {
        try {
            socket.close();
        } catch (IOException ignored) {
            // Ya cerrado
        }
    }

    private static String readHead(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        int last4 = 0;
        int b;
        while ((b = in.read()) != -1) {
            buffer.write(b);
            if (buffer.size() > MAX_HEADER_BYTES) return null;
            last4 = (last4 << 8) | b;
            if (last4 == 0x0D0A0D0A) return buffer.toString(StandardCharsets.ISO_8859_1.name()).trim();
        }
        return null;
    }

    private static byte[] readExactly(InputStream in, int length) throws IOException {
        byte[] data = new byte[length];
        int read = 0;
        while (read < length) {
            int n = in.read(data, read, length - read);
            if (n < 0) return null;
            read += n;
        }
        return data;
    }

    private static void respondJson(OutputStream out, int status, String json) throws IOException {
        byte[] body = (json == null ? "" : json).getBytes(StandardCharsets.UTF_8);
        String head = "HTTP/1.1 " + status + " " + (status == 200 ? "OK" : "Error") + "\r\n"
            + "Content-Type: application/json; charset=utf-8\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Cache-Control: no-store\r\n"
            + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
        out.flush();
    }

    /* ================================================================== Invitado */

    public static final class Client {

        public interface StreamListener {
            void onData(String streamId, String data);
            void onEnd(String streamId, String error);
        }

        public static final class Response {
            public final int status;
            public final String body;

            Response(int status, String body) {
                this.status = status;
                this.body = body;
            }
        }

        private final Map<String, HttpURLConnection> streams = new ConcurrentHashMap<>();
        private final ExecutorService readers = Executors.newCachedThreadPool();
        private final StreamListener listener;

        public Client(StreamListener listener) {
            this.listener = listener;
        }

        /** Solo direcciones privadas de la red local y rutas de la sala. */
        static URL checkLanUrl(String value) throws IOException {
            URL url = new URL(value);
            if (!"http".equals(url.getProtocol()) || !url.getPath().startsWith(BASE_PATH + "/")) throw new IOException("URL no válida");
            String[] parts = url.getHost().split("\\.");
            if (parts.length != 4) throw new IOException("URL no válida");
            byte[] address = new byte[4];
            for (int i = 0; i < 4; i++) {
                int n;
                try {
                    n = Integer.parseInt(parts[i]);
                } catch (NumberFormatException e) {
                    throw new IOException("URL no válida");
                }
                if (n < 0 || n > 255) throw new IOException("URL no válida");
                address[i] = (byte) n;
            }
            if (!LocalTransferServer.isPrivateIPv4(address)) throw new IOException("URL no válida");
            return url;
        }

        public static Response request(String url, String body, int timeoutMs) throws IOException {
            HttpURLConnection connection = (HttpURLConnection) checkLanUrl(url).openConnection();
            int timeout = Math.max(1_000, Math.min(timeoutMs, 120_000));
            connection.setConnectTimeout(Math.min(timeout, 8_000));
            connection.setReadTimeout(timeout);
            connection.setRequestMethod("POST");
            connection.setDoOutput(true);
            connection.setUseCaches(false);
            byte[] payload = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(payload.length);
            connection.setRequestProperty("Content-Type", "application/json");
            try {
                try (OutputStream out = connection.getOutputStream()) {
                    out.write(payload);
                }
                int status = connection.getResponseCode();
                InputStream stream = status >= 400 ? connection.getErrorStream() : connection.getInputStream();
                String text = "";
                if (stream != null) {
                    try (InputStream in = stream) {
                        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
                        byte[] chunk = new byte[16 * 1024];
                        int n;
                        while ((n = in.read(chunk)) != -1) {
                            buffer.write(chunk, 0, n);
                            if (buffer.size() > MAX_BODY_BYTES) throw new IOException("too-large");
                        }
                        text = buffer.toString(StandardCharsets.UTF_8.name());
                    }
                }
                return new Response(status, text);
            } finally {
                connection.disconnect();
            }
        }

        public void openStream(String url, String streamId) throws IOException {
            if (streamId == null || streamId.isEmpty() || streams.containsKey(streamId)) throw new IOException("Conexión no válida");
            // openConnection() todavía no conecta: se registra antes para que closeStream la alcance
            final HttpURLConnection connection = (HttpURLConnection) checkLanUrl(url).openConnection();
            streams.put(streamId, connection);
            readers.execute(() -> {
                String error = null;
                try {
                    connection.setConnectTimeout(8_000);
                    // El anfitrión manda un latido cada 15 s: 45 s sin nada es una conexión muerta
                    connection.setReadTimeout(45_000);
                    connection.setRequestProperty("Accept", "text/event-stream");
                    connection.setUseCaches(false);
                    int status = connection.getResponseCode();
                    if (status != 200) {
                        error = "status " + status;
                    } else {
                        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                            StringBuilder data = new StringBuilder();
                            String line;
                            while ((line = reader.readLine()) != null) {
                                if (line.isEmpty()) {
                                    if (data.length() > 0) listener.onData(streamId, data.toString());
                                    data.setLength(0);
                                } else if (line.startsWith("data:")) {
                                    data.append(line.substring(5).trim());
                                    if (data.length() > MAX_BODY_BYTES) throw new IOException("too-large");
                                }
                            }
                        }
                    }
                } catch (IOException e) {
                    error = e.getMessage();
                } finally {
                    connection.disconnect();
                    // Si se cerró a propósito (closeStream), ya no está en el mapa y no se avisa
                    if (streams.remove(streamId) != null) listener.onEnd(streamId, error);
                }
            });
        }

        public void closeStream(String streamId) {
            HttpURLConnection connection = streams.remove(streamId);
            if (connection != null) {
                // disconnect() desde otro hilo corta la lectura bloqueada
                readers.execute(connection::disconnect);
            }
        }

        public void closeAll() {
            for (String id : streams.keySet()) closeStream(id);
        }
    }
}
