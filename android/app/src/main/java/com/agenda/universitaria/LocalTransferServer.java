package com.agenda.universitaria;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Servidor HTTP temporal para pasar datos de teléfono a teléfono por la red local (wifi o punto
 * de acceso). Es el equivalente de electron/transferServer.cjs, con el mismo protocolo, para que
 * cualquier dispositivo pueda escanear el QR de cualquier otro:
 *
 *   GET  /agenda-transfer/v1/hello     → {"app":"agenda-universitaria","mode":…,"pcName":…}
 *   POST /agenda-transfer/v1/upload    (modo receive) → recibe los datos cifrados
 *   GET  /agenda-transfer/v1/download  (modo send)    → entrega los datos cifrados
 *
 * Cada petición exige la cabecera X-Agenda-Token, de un solo uso. La sesión dura 5 minutos como
 * máximo y atiende una sola transferencia. Los datos llegan y salen ya cifrados (AES-256-GCM desde
 * la interfaz): este servidor nunca ve el contenido.
 *
 * Es Java puro (sin clases de Android) para poder probarlo también fuera del teléfono.
 */
public final class LocalTransferServer {

    public interface Listener {
        /** type: connected | received | sent | expired | blocked | error. payload solo en received. */
        void onEvent(String type, String payload);
    }

    public static final class Info {
        public final int port;
        public final List<String> hosts;
        public final String token;
        public final long expiresAt;

        Info(int port, List<String> hosts, String token, long expiresAt) {
            this.port = port;
            this.hosts = hosts;
            this.token = token;
            this.expiresAt = expiresAt;
        }
    }

    private static final String BASE_PATH = "/agenda-transfer/v1";
    private static final long SESSION_TTL_MS = 5 * 60_000L;
    /** Tope del cuerpo recibido (texto base64 del respaldo cifrado). */
    private static final int MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
    private static final int MAX_HEADER_BYTES = 16 * 1024;
    private static final int MAX_BAD_REQUESTS = 20;
    private static final int MAX_HOSTS = 4;

    private final String mode;
    private final byte[] payload;
    private final String deviceName;
    private final Listener listener;

    private final AtomicBoolean finished = new AtomicBoolean(false);
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final AtomicInteger badRequests = new AtomicInteger(0);
    private final ExecutorService workers = Executors.newCachedThreadPool();
    private final ScheduledExecutorService timer = Executors.newSingleThreadScheduledExecutor();
    private ServerSocket serverSocket;
    private String token;

    public LocalTransferServer(String mode, byte[] payload, String deviceName, Listener listener) {
        if (!"receive".equals(mode) && !"send".equals(mode)) throw new IllegalArgumentException("Modo no válido");
        if ("send".equals(mode) && (payload == null || payload.length == 0)) throw new IllegalArgumentException("No hay datos para enviar");
        this.mode = mode;
        this.payload = payload;
        this.deviceName = deviceName;
        this.listener = listener;
    }

    /** Abre el servidor en un puerto libre de todas las interfaces. Lanza IOException("NO_LAN") sin red local. */
    public Info start() throws IOException {
        List<String> hosts = lanAddresses();
        if (hosts.isEmpty()) throw new IOException("NO_LAN");

        // Token hexadecimal (java.util.Base64 no existe en Android 7)
        byte[] random = new byte[18];
        new SecureRandom().nextBytes(random);
        StringBuilder hex = new StringBuilder();
        for (byte value : random) hex.append(String.format(Locale.ROOT, "%02x", value & 0xff));
        token = hex.toString();

        serverSocket = new ServerSocket(0, 16);
        long expiresAt = System.currentTimeMillis() + SESSION_TTL_MS;
        timer.schedule(() -> finish("expired", null), SESSION_TTL_MS, TimeUnit.MILLISECONDS);

        Thread acceptor = new Thread(this::acceptLoop, "agenda-transfer-accept");
        acceptor.setDaemon(true);
        acceptor.start();
        return new Info(serverSocket.getLocalPort(), hosts, token, expiresAt);
    }

    /** Cierra la sesión sin avisar (el usuario canceló). */
    public void stop() {
        finish(null, null);
    }

    private void acceptLoop() {
        while (!finished.get()) {
            try {
                Socket socket = serverSocket.accept();
                workers.execute(() -> handle(socket));
            } catch (IOException e) {
                if (!finished.get()) finish("error", null);
                return;
            }
        }
    }

    private void finish(String type, String eventPayload) {
        if (!finished.compareAndSet(false, true)) return;
        try {
            if (serverSocket != null) serverSocket.close();
        } catch (IOException ignored) {
            // Ya estaba cerrado
        }
        timer.shutdownNow();
        workers.shutdown();
        if (type != null && listener != null) listener.onEvent(type, eventPayload);
    }

    /* ------------------------------------------------------------------ HTTP mínimo */

    private void handle(Socket socket) {
        try (Socket s = socket) {
            s.setSoTimeout(60_000);
            InputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream out = s.getOutputStream();

            String head = readHead(in);
            if (head == null) return;
            String[] lines = head.split("\r\n");
            String[] requestLine = lines[0].split(" ");
            if (requestLine.length < 2) {
                respondJson(out, 400, "{\"error\":\"bad-request\"}");
                return;
            }
            String method = requestLine[0];
            String path = requestLine[1];
            int query = path.indexOf('?');
            if (query >= 0) path = path.substring(0, query);
            Map<String, String> headers = new HashMap<>();
            for (int i = 1; i < lines.length; i++) {
                int colon = lines[i].indexOf(':');
                if (colon > 0) headers.put(lines[i].substring(0, colon).trim().toLowerCase(Locale.ROOT), lines[i].substring(colon + 1).trim());
            }

            if (finished.get()) {
                respondJson(out, 410, "{\"error\":\"closed\"}");
                return;
            }
            if (!path.startsWith(BASE_PATH + "/")) {
                respondJson(out, 404, "{\"error\":\"not-found\"}");
                return;
            }
            if (!tokensMatch(headers.get("x-agenda-token"))) {
                respondJson(out, 403, "{\"error\":\"forbidden\"}");
                if (badRequests.incrementAndGet() >= MAX_BAD_REQUESTS) finish("blocked", null);
                return;
            }

            String route = path.substring(BASE_PATH.length());
            if ("/hello".equals(route) && "GET".equals(method)) {
                respondJson(out, 200, "{\"app\":\"agenda-universitaria\",\"mode\":\"" + mode + "\",\"pcName\":" + jsonString(deviceName) + "}");
                if (listener != null) listener.onEvent("connected", null);
                return;
            }

            if ("/upload".equals(route) && "POST".equals(method) && "receive".equals(mode)) {
                long length;
                try {
                    length = Long.parseLong(headers.getOrDefault("content-length", "-1"));
                } catch (NumberFormatException e) {
                    length = -1;
                }
                if (length < 0) {
                    respondJson(out, 411, "{\"error\":\"length-required\"}");
                    return;
                }
                if (length > MAX_UPLOAD_BYTES) {
                    respondJson(out, 413, "{\"error\":\"too-large\"}");
                    return;
                }
                if (!busy.compareAndSet(false, true)) {
                    respondJson(out, 409, "{\"error\":\"busy\"}");
                    return;
                }
                byte[] body = readExactly(in, (int) length);
                if (body == null) {
                    busy.set(false);
                    return;
                }
                respondJson(out, 200, "{\"ok\":true}");
                finish("received", new String(body, StandardCharsets.UTF_8));
                return;
            }

            if ("/download".equals(route) && "GET".equals(method) && "send".equals(mode)) {
                if (!busy.compareAndSet(false, true)) {
                    respondJson(out, 409, "{\"error\":\"busy\"}");
                    return;
                }
                try {
                    respond(out, 200, "text/plain; charset=utf-8", payload);
                } catch (IOException e) {
                    // Se cortó a medias: se permite reintentar mientras dure la sesión
                    busy.set(false);
                    return;
                }
                finish("sent", null);
                return;
            }

            respondJson(out, 404, "{\"error\":\"not-found\"}");
        } catch (IOException ignored) {
            // Conexión cortada o lenta: no afecta a la sesión
        }
    }

    /** Lee la cabecera HTTP hasta la línea en blanco. */
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
        respond(out, status, "application/json; charset=utf-8", json.getBytes(StandardCharsets.UTF_8));
    }

    private static void respond(OutputStream out, int status, String contentType, byte[] body) throws IOException {
        String head = "HTTP/1.1 " + status + " " + reason(status) + "\r\n"
            + "Content-Type: " + contentType + "\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Cache-Control: no-store\r\n"
            + "Connection: close\r\n\r\n";
        out.write(head.getBytes(StandardCharsets.ISO_8859_1));
        out.write(body);
        out.flush();
    }

    private static String reason(int status) {
        switch (status) {
            case 200: return "OK";
            case 400: return "Bad Request";
            case 403: return "Forbidden";
            case 404: return "Not Found";
            case 409: return "Conflict";
            case 410: return "Gone";
            case 411: return "Length Required";
            case 413: return "Payload Too Large";
            default: return "Error";
        }
    }

    private boolean tokensMatch(String received) {
        if (received == null || token == null) return false;
        return MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), received.getBytes(StandardCharsets.UTF_8));
    }

    private static String jsonString(String value) {
        StringBuilder sb = new StringBuilder("\"");
        for (char c : (value == null ? "" : value).toCharArray()) {
            if (c == '"' || c == '\\') sb.append('\\').append(c);
            else if (c < 0x20) sb.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
            else sb.append(c);
        }
        return sb.append('"').toString();
    }

    /* ------------------------------------------------------------------ Direcciones de la red local */

    public static boolean isPrivateIPv4(byte[] a) {
        int b0 = a[0] & 0xff;
        int b1 = a[1] & 0xff;
        return b0 == 10 || (b0 == 172 && b1 >= 16 && b1 <= 31) || (b0 == 192 && b1 == 168);
    }

    /**
     * IPv4 privadas de este teléfono: wifi y punto de acceso primero. Se descartan los datos
     * móviles (rmnet, ccmni…): sus 10.x son de la operadora y nadie cercano llega a ellas.
     */
    public static List<String> lanAddresses() {
        List<String[]> found = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName().toLowerCase(Locale.ROOT);
                if (name.startsWith("rmnet") || name.startsWith("ccmni") || name.startsWith("pdp") || name.startsWith("dummy") || name.startsWith("v4-")) continue;
                boolean preferred = name.startsWith("wlan") || name.startsWith("ap") || name.startsWith("swlan") || name.startsWith("eth") || name.startsWith("wifi");
                for (InetAddress address : Collections.list(ni.getInetAddresses())) {
                    if (!(address instanceof Inet4Address) || !isPrivateIPv4(address.getAddress())) continue;
                    String ip = address.getHostAddress();
                    int rank = (preferred ? 0 : 10) + (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : 2);
                    found.add(new String[] { String.valueOf(rank), ip });
                }
            }
        } catch (Exception ignored) {
            // Sin permiso o sin interfaces: lista vacía
        }
        found.sort((x, y) -> Integer.compare(Integer.parseInt(x[0]), Integer.parseInt(y[0])));
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (String[] entry : found) {
            if (unique.size() >= MAX_HOSTS) break;
            unique.add(entry[1]);
        }
        return new ArrayList<>(unique);
    }
}
