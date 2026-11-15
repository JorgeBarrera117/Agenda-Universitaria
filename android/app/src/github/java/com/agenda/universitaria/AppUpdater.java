package com.agenda.universitaria;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.PluginCall;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;

/**
 * Canal «github» (APK de GitHub Releases): la app se actualiza sola. Descarga el APK de la versión
 * publicada, lo verifica y abre el instalador de Android (necesita REQUEST_INSTALL_PACKAGES).
 *
 * La versión de Google Play usa otra clase AppUpdater (src/play) sin nada de esto: Google Play no
 * permite que una app se actualice por fuera de la tienda.
 */
final class AppUpdater {

    /** Canal de distribución que la web consulta con WidgetBridge.getDistribution(). */
    static final String CHANNEL = "github";

    interface ProgressListener {
        void onProgress(long downloaded, long total, int percent);
    }

    private static final String UPDATE_URL_PREFIX = "https://github.com/jorgebarrera117/agenda-universitaria/releases/download/";
    private static final long MAX_UPDATE_BYTES = 150L * 1024 * 1024;
    private static final String UPDATE_APK_NAME = "agenda-update.apk";

    /** APK descargado y verificado, listo para instalar (solo uno a la vez). */
    private static volatile File pendingUpdateApk;

    private AppUpdater() {}

    /** ¿La app puede abrir el instalador? En Android 8+ requiere "Instalar apps desconocidas". */
    static boolean canInstallPackages(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.getPackageManager().canRequestPackageInstalls();
    }

    /** Abre los ajustes del sistema para permitir que esta app instale actualizaciones. */
    static void openInstallPermissionSettings(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
    }

    /**
     * Descarga el APK de una versión publicada en GitHub Releases y lo verifica antes de ofrecer
     * instalarlo:
     * 1. Solo desde https://github.com/JorgeBarrera117/Agenda-Universitaria/releases/download/…
     *    (GitHub redirige al almacenamiento de archivos; HttpURLConnection sigue esa redirección).
     * 2. Huella SHA-256 igual a la publicada en version.json: un archivo alterado o incompleto se borra.
     * 3. Que sea esta misma app (mismo paquete) y una versión más nueva que la instalada.
     * La firma la comprueba Android al instalar: solo acepta una actualización firmada con la misma llave.
     */
    static void download(Context context, PluginCall call, ProgressListener listener) {
        String url = call.getString("url");
        String expectedSha256 = call.getString("sha256", "");
        if (url == null || !url.toLowerCase().startsWith(UPDATE_URL_PREFIX) || !url.toLowerCase().endsWith(".apk")) {
            call.reject("El enlace de la actualización no es de confianza.");
            return;
        }
        if (expectedSha256 == null || !expectedSha256.toLowerCase().matches("^[a-f0-9]{64}$")) {
            call.reject("Falta la huella de seguridad (SHA-256) de la actualización.");
            return;
        }

        new Thread(() -> {
            File dir = new File(context.getCacheDir(), "updates");
            File apk = new File(dir, UPDATE_APK_NAME);
            java.net.HttpURLConnection connection = null;
            try {
                if (!dir.exists()) {
                    //noinspection ResultOfMethodCallIgnored
                    dir.mkdirs();
                }
                //noinspection ResultOfMethodCallIgnored
                apk.delete();
                pendingUpdateApk = null;

                connection = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                int status = connection.getResponseCode();
                if (status != java.net.HttpURLConnection.HTTP_OK) {
                    call.reject("El servidor respondió " + status + " al descargar la actualización.");
                    return;
                }
                // La redirección debe seguir en https (HttpURLConnection no cambia de protocolo, pero se comprueba)
                if (!"https".equalsIgnoreCase(connection.getURL().getProtocol())) {
                    call.reject("La descarga no usa una conexión segura.");
                    return;
                }

                long total = connection.getContentLengthLong();
                if (total > MAX_UPDATE_BYTES) {
                    call.reject("La actualización es demasiado grande.");
                    return;
                }

                java.security.MessageDigest digest = java.security.MessageDigest.getInstance("SHA-256");
                long downloaded = 0;
                int lastPercent = -1;
                try (InputStream in = connection.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        downloaded += read;
                        if (downloaded > MAX_UPDATE_BYTES) {
                            throw new java.io.IOException("La actualización es demasiado grande.");
                        }
                        out.write(buffer, 0, read);
                        digest.update(buffer, 0, read);
                        int percent = total > 0 ? (int) (downloaded * 100 / total) : -1;
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            listener.onProgress(downloaded, total, percent);
                        }
                    }
                }

                StringBuilder hex = new StringBuilder();
                for (byte b : digest.digest()) {
                    hex.append(String.format("%02x", b));
                }
                if (!hex.toString().equalsIgnoreCase(expectedSha256)) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    call.reject("La actualización descargada no coincide con la publicada (huella SHA-256 distinta). Inténtalo de nuevo.");
                    return;
                }

                PackageManager pm = context.getPackageManager();
                PackageInfo archive = pm.getPackageArchiveInfo(apk.getAbsolutePath(), 0);
                PackageInfo installed = pm.getPackageInfo(context.getPackageName(), 0);
                if (archive == null || !context.getPackageName().equals(archive.packageName)) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    call.reject("El archivo descargado no es una actualización de esta app.");
                    return;
                }
                long archiveCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? archive.getLongVersionCode() : archive.versionCode;
                long installedCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? installed.getLongVersionCode() : installed.versionCode;
                if (archiveCode <= installedCode) {
                    //noinspection ResultOfMethodCallIgnored
                    apk.delete();
                    call.reject("La versión descargada no es más nueva que la instalada.");
                    return;
                }

                pendingUpdateApk = apk;
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("versionName", archive.versionName);
                ret.put("sizeBytes", downloaded);
                call.resolve(ret);
            } catch (Exception e) {
                //noinspection ResultOfMethodCallIgnored
                apk.delete();
                call.reject("No se pudo descargar la actualización: " + e.getMessage());
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    /** Abre el instalador de Android con el APK ya descargado y verificado por download(). */
    static void install(Context context, PluginCall call) {
        File apk = pendingUpdateApk;
        if (apk == null || !apk.exists()) {
            call.reject("No hay ninguna actualización descargada.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !context.getPackageManager().canRequestPackageInstalls()) {
            call.reject("Falta el permiso para instalar actualizaciones.", "INSTALL_PERMISSION");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", apk);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("No se pudo abrir el instalador: " + e.getMessage());
        }
    }
}
