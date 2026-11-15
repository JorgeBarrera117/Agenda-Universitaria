package com.agenda.universitaria;

import android.content.Context;

import com.getcapacitor.PluginCall;

/**
 * Canal «play» (Google Play): la app NO se actualiza sola. Google Play no permite que una app se
 * actualice por fuera de la tienda («Device and Network Abuse»), así que esta versión no incluye
 * la descarga del APK ni el permiso REQUEST_INSTALL_PACKAGES (lo quita src/play/AndroidManifest.xml).
 * Las actualizaciones las instala Google Play. La web lo sabe por WidgetBridge.getDistribution().
 */
final class AppUpdater {

    static final String CHANNEL = "play";

    private static final String STORE_MESSAGE = "En la versión de Google Play, las actualizaciones llegan desde la tienda.";

    interface ProgressListener {
        void onProgress(long downloaded, long total, int percent);
    }

    private AppUpdater() {}

    static boolean canInstallPackages(Context context) {
        return false;
    }

    static void openInstallPermissionSettings(Context context) {
        // Nada que abrir: esta versión no instala paquetes
    }

    static void download(Context context, PluginCall call, ProgressListener listener) {
        call.reject(STORE_MESSAGE, "STORE_MANAGED");
    }

    static void install(Context context, PluginCall call) {
        call.reject(STORE_MESSAGE, "STORE_MANAGED");
    }
}
