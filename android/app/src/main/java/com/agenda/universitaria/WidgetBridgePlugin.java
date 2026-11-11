package com.agenda.universitaria;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.inputmethod.InputMethodInfo;
import android.view.inputmethod.InputMethodManager;
import android.webkit.MimeTypeMap;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final String TEMP_BACKUP_FILE = "export_backup_temp.json";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        String dataJson = call.getString("dataJson");

        if (dataJson != null) {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(AgendaWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString("widget_data", dataJson).apply();

            // Actualizar ambos widgets colocados en la pantalla de inicio
            AgendaWidgetProvider.updateAllWidgets(context);
            ScheduleDayWidgetProvider.updateAllWidgets(context);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } else {
            call.reject("dataJson no puede ser nulo");
        }
    }

    @PluginMethod
    public void saveToDownloads(PluginCall call) {
        String content = call.getString("content");
        String fileName = call.getString("fileName", "agenda_universitaria_backup.json");

        if (content == null) {
            call.reject("El contenido no puede estar vacío");
            return;
        }

        try {
            Context context = getContext();
            Uri fileUri = null;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
                values.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);

                fileUri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (fileUri != null) {
                    try (OutputStream out = context.getContentResolver().openOutputStream(fileUri)) {
                        if (out != null) {
                            out.write(content.getBytes(StandardCharsets.UTF_8));
                            out.flush();
                        }
                    }

                    // Liberar IS_PENDING para publicar el archivo completo al sistema
                    values.clear();
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    context.getContentResolver().update(fileUri, values, null, null);
                }
            } else {
                File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                if (!downloadsDir.exists()) {
                    downloadsDir.mkdirs();
                }
                File targetFile = new File(downloadsDir, fileName);
                try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                    fos.write(content.getBytes(StandardCharsets.UTF_8));
                    fos.flush();
                }
                fileUri = Uri.fromFile(targetFile);
            }

            if (fileUri != null) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("fileName", fileName);
                call.resolve(ret);
            } else {
                call.reject("No se pudo crear el archivo en Descargas");
            }
        } catch (Exception e) {
            call.reject("Error al guardar en Descargas: " + e.getMessage());
        }
    }

    @PluginMethod
    public void shareJsonFile(PluginCall call) {
        String content = call.getString("content");
        String fileName = call.getString("fileName", "agenda_universitaria_backup.json");

        if (content == null) {
            call.reject("El contenido no puede estar vacío");
            return;
        }

        // El nombre llega desde JavaScript: solo se usa su último segmento para que "../" no
        // escriba fuera de la caché, y se fuerza la extensión .json (WhatsApp muestra el tipo por ella)
        String safeName = new File(fileName).getName().replaceAll("[^A-Za-z0-9._-]", "_");
        if (safeName.isEmpty() || safeName.startsWith(".")) {
            safeName = "agenda_universitaria_backup.json";
        }
        if (!safeName.toLowerCase().endsWith(".json")) {
            safeName = safeName + ".json";
        }

        try {
            Context context = getContext();
            File cacheDir = context.getCacheDir();
            File shareFile = new File(cacheDir, safeName);
            try (FileOutputStream fos = new FileOutputStream(shareFile)) {
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }

            Uri fileUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                shareFile
            );

            Intent sendIntent = new Intent(Intent.ACTION_SEND);
            sendIntent.setType("application/json");
            sendIntent.putExtra(Intent.EXTRA_STREAM, fileUri);
            sendIntent.putExtra(Intent.EXTRA_SUBJECT, "Copia de Seguridad - Agenda Universitaria");
            sendIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // 1. El permiso temporal de lectura viaja con el ClipData. createChooser solo copia al
            //    selector el ClipData y los flags que el intent destino ya tenga; si el URI va solo en
            //    EXTRA_STREAM, la app elegida (WhatsApp, Gmail…) no puede abrirlo y envía 0 kB.
            sendIntent.setClipData(ClipData.newUri(context.getContentResolver(), safeName, fileUri));

            Intent chooser = Intent.createChooser(sendIntent, "Guardar o compartir copia de seguridad");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // 2. Respaldo para lanzadores que no propagan el ClipData: permiso explícito a cada app
            //    capaz de recibir el archivo. Se consulta sendIntent (consultar el chooser solo
            //    devuelve el selector del sistema); en Android 11+ la lista depende de <queries>
            //    en AndroidManifest.xml.
            List<ResolveInfo> targets = context.getPackageManager()
                .queryIntentActivities(sendIntent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo target : targets) {
                context.grantUriPermission(
                    target.activityInfo.packageName,
                    fileUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            }

            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al compartir archivo: " + e.getMessage());
        }
    }

    @PluginMethod
    public void copyImageToClipboard(PluginCall call) {
        String base64Data = call.getString("base64Data");
        if (base64Data == null || base64Data.trim().isEmpty()) {
            call.reject("No hay datos de imagen para copiar.");
            return;
        }

        try {
            String mimeType = call.getString("mimeType");
            if (base64Data.startsWith("data:")) {
                int commaIndex = base64Data.indexOf(",");
                if (commaIndex != -1) {
                    String header = base64Data.substring(5, commaIndex);
                    if (header.contains(";")) {
                        mimeType = header.substring(0, header.indexOf(";"));
                    }
                    base64Data = base64Data.substring(commaIndex + 1);
                }
            }
            // Solo formatos de imagen que WhatsApp y los teclados aceptan; cualquier otro valor
            // recibido desde JS (p. ej. "text/html") se trata como PNG
            if (!"image/jpeg".equals(mimeType) && !"image/png".equals(mimeType)) {
                mimeType = "image/png";
            }

            byte[] imageBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);

            Context context = getContext();
            File clipDir = new File(context.getCacheDir(), "shared_clip");
            if (!clipDir.exists()) {
                clipDir.mkdirs();
            }

            // Nombre único por copia: el historial del portapapeles (p. ej. el de GBoard) guarda los
            // URI anteriores; si siempre se sobrescribiera el mismo archivo, todas esas entradas
            // mostrarían la última foto. Se conservan solo las 5 copias más recientes.
            String extension = "image/jpeg".equals(mimeType) ? ".jpg" : ".png";
            File[] previous = clipDir.listFiles();
            if (previous != null && previous.length >= 5) {
                java.util.Arrays.sort(previous, (a, b) -> Long.compare(a.lastModified(), b.lastModified()));
                for (int i = 0; i <= previous.length - 5; i++) {
                    //noinspection ResultOfMethodCallIgnored
                    previous[i].delete();
                }
            }
            File clipFile = new File(clipDir, "clipboard_image_" + System.currentTimeMillis() + extension);
            try (FileOutputStream fos = new FileOutputStream(clipFile)) {
                fos.write(imageBytes);
                fos.flush();
            }

            Uri contentUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                clipFile
            );

            // ClipData explícito con mimeType y comodín image/* para compatibilidad con teclados (GBoard)
            // y aplicaciones de mensajería (WhatsApp, Telegram)
            ClipDescription description = new ClipDescription(
                "Image",
                new String[]{ mimeType, "image/*", ClipDescription.MIMETYPE_TEXT_URILIST }
            );
            ClipData.Item item = new ClipData.Item(contentUri);
            ClipData clipData = new ClipData(description, item);

            // Pre-conceder permisos explícitos de lectura a apps de envío (WhatsApp, Telegram) y teclados (GBoard)
            try {
                Intent sendIntent = new Intent(Intent.ACTION_SEND);
                sendIntent.setType(mimeType);
                List<ResolveInfo> targets = context.getPackageManager()
                    .queryIntentActivities(sendIntent, PackageManager.MATCH_DEFAULT_ONLY);
                for (ResolveInfo target : targets) {
                    context.grantUriPermission(
                        target.activityInfo.packageName,
                        contentUri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION
                    );
                }
            } catch (Exception ignored) {
            }

            try {
                InputMethodManager imm = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
                if (imm != null) {
                    List<InputMethodInfo> imis = imm.getEnabledInputMethodList();
                    for (InputMethodInfo imi : imis) {
                        context.grantUriPermission(
                            imi.getPackageName(),
                            contentUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        );
                    }
                }
            } catch (Exception ignored) {
            }

            final String finalMimeType = mimeType;
            getActivity().runOnUiThread(() -> {
                try {
                    // Feedback háptico nativo del sistema
                    try {
                        getActivity().getWindow().getDecorView().performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS);
                    } catch (Exception ignored) {
                    }

                    ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (clipboard != null) {
                        clipboard.setPrimaryClip(clipData);

                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("mimeType", finalMimeType);
                        call.resolve(ret);
                    } else {
                        call.reject("No se pudo obtener el servicio de portapapeles del sistema.");
                    }
                } catch (Exception ex) {
                    call.reject("Error al asignar al portapapeles: " + ex.getMessage());
                }
            });

        } catch (Exception e) {
            call.reject("Error al procesar la imagen para el portapapeles: " + e.getMessage());
        }
    }

    /** Tamaño máximo que se lee del portapapeles (una foto de cámara rara vez supera los 15 MB). */
    private static final int MAX_CLIPBOARD_IMAGE_BYTES = 20 * 1024 * 1024;

    /**
     * Devuelve la imagen que hay en el portapapeles de Android (copiada en esta app, WhatsApp,
     * Chrome…) como data URL. El WebView no siempre la entrega en el evento "paste", así que el
     * botón "Pegar imagen" del editor la pide aquí. El portapapeles se consulta en el hilo de UI
     * (Android 10+ solo lo permite a la app en primer plano) y el archivo se lee en otro hilo.
     */
    @PluginMethod
    public void readImageFromClipboard(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Context context = getContext();
                ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData clip = clipboard != null ? clipboard.getPrimaryClip() : null;
                if (clip == null || clip.getItemCount() == 0) {
                    resolveNoClipboardImage(call);
                    return;
                }

                Uri imageUri = null;
                String imageMime = null;
                for (int i = 0; i < clip.getItemCount() && imageUri == null; i++) {
                    Uri uri = clip.getItemAt(i).getUri();
                    if (uri == null) continue;
                    String type = context.getContentResolver().getType(uri);
                    if (type == null && clip.getDescription() != null) {
                        for (int m = 0; m < clip.getDescription().getMimeTypeCount(); m++) {
                            String candidate = clip.getDescription().getMimeType(m);
                            if (candidate != null && candidate.startsWith("image/") && !candidate.equals("image/*")) {
                                type = candidate;
                                break;
                            }
                        }
                    }
                    if (type != null && type.startsWith("image/")) {
                        imageUri = uri;
                        imageMime = type.equals("image/*") ? "image/png" : type;
                    }
                }
                if (imageUri == null) {
                    resolveNoClipboardImage(call);
                    return;
                }

                final Uri finalUri = imageUri;
                final String finalMime = imageMime;
                new Thread(() -> {
                    try (InputStream in = context.getContentResolver().openInputStream(finalUri)) {
                        if (in == null) {
                            call.reject("No se pudo abrir la imagen del portapapeles.");
                            return;
                        }
                        java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream();
                        byte[] buffer = new byte[16 * 1024];
                        int read;
                        int total = 0;
                        while ((read = in.read(buffer)) != -1) {
                            total += read;
                            if (total > MAX_CLIPBOARD_IMAGE_BYTES) {
                                call.reject("La imagen del portapapeles es demasiado grande.");
                                return;
                            }
                            out.write(buffer, 0, read);
                        }
                        String base64 = android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP);
                        JSObject ret = new JSObject();
                        ret.put("hasImage", true);
                        ret.put("mimeType", finalMime);
                        ret.put("dataUrl", "data:" + finalMime + ";base64," + base64);
                        call.resolve(ret);
                    } catch (SecurityException se) {
                        call.reject("Android no dio permiso para leer la imagen copiada.");
                    } catch (Exception ex) {
                        call.reject("Error al leer la imagen del portapapeles: " + ex.getMessage());
                    }
                }).start();
            } catch (Exception e) {
                call.reject("Error al consultar el portapapeles: " + e.getMessage());
            }
        });
    }

    private static void resolveNoClipboardImage(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("hasImage", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void exportJsonFile(PluginCall call) {
        String content = call.getString("content");
        String fileName = call.getString("fileName", "agenda_universitaria_backup.json");

        if (content == null) {
            call.reject("El contenido no puede estar vacío");
            return;
        }

        try {
            // Guardar temporalmente en cache para evitar desbordes de memoria en llamadas asíncronas
            File tempFile = new File(getContext().getCacheDir(), TEMP_BACKUP_FILE);
            try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                fos.write(content.getBytes(StandardCharsets.UTF_8));
                fos.flush();
            }

            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("*/*");
            intent.putExtra(Intent.EXTRA_TITLE, fileName);

            startActivityForResult(call, intent, "saveFileResult");
        } catch (Exception e) {
            call.reject("Error al preparar exportación: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void saveFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri targetUri = result.getData().getData();
            if (targetUri != null) {
                File tempFile = new File(getContext().getCacheDir(), TEMP_BACKUP_FILE);
                try (InputStream in = new FileInputStream(tempFile);
                     OutputStream out = getContext().getContentResolver().openOutputStream(targetUri)) {
                    if (out != null) {
                        byte[] buffer = new byte[8192];
                        int bytesRead;
                        while ((bytesRead = in.read(buffer)) != -1) {
                            out.write(buffer, 0, bytesRead);
                        }
                        out.flush();

                        tempFile.delete();

                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("canceled", false);
                        call.resolve(ret);
                        return;
                    }
                } catch (Exception e) {
                    call.reject("Error al escribir el archivo: " + e.getMessage());
                    return;
                }
            }
        }

        // Si el usuario canceló la selección de archivo
        File tempFile = new File(getContext().getCacheDir(), TEMP_BACKUP_FILE);
        if (tempFile.exists()) {
            tempFile.delete();
        }

        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("canceled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void pickAndReadJsonFile(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        String[] mimeTypes = {"application/json", "text/plain", "application/octet-stream"};
        intent.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes);

        startActivityForResult(call, intent, "openFileResult");
    }

    @ActivityCallback
    private void openFileResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Uri fileUri = result.getData().getData();
            if (fileUri != null) {
                try {
                    try {
                        getContext().getContentResolver().takePersistableUriPermission(
                            fileUri,
                            Intent.FLAG_GRANT_READ_URI_PERMISSION
                        );
                    } catch (Exception ignored) {
                    }

                    try (InputStream in = getContext().getContentResolver().openInputStream(fileUri);
                         BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                        if (in == null) {
                            call.reject("No se pudo abrir el archivo seleccionado.");
                            return;
                        }

                        StringBuilder sb = new StringBuilder();
                        char[] buffer = new char[8192];
                        int bytesRead;
                        while ((bytesRead = reader.read(buffer)) != -1) {
                            sb.append(buffer, 0, bytesRead);
                        }

                        String content = sb.toString().trim();
                        if (content.isEmpty()) {
                            call.reject("El archivo seleccionado está vacío (0 bytes). Verifica que elegiste la copia de seguridad correcta.");
                            return;
                        }

                        JSObject ret = new JSObject();
                        ret.put("success", true);
                        ret.put("content", content);
                        ret.put("canceled", false);
                        call.resolve(ret);
                        return;
                    }
                } catch (Exception e) {
                    call.reject("Error al leer el archivo seleccionado: " + e.getMessage());
                    return;
                }
            }
        }

        // Si el usuario canceló la selección de archivo
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("canceled", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void openDocument(PluginCall call) {
        String base64Data = call.getString("base64Data");
        String fileName = call.getString("fileName", "document");
        String mimeType = call.getString("mimeType");

        if (base64Data == null || base64Data.isEmpty()) {
            call.reject("El archivo no tiene contenido.");
            return;
        }

        try {
            Context context = getContext();
            File docsDir = new File(context.getCacheDir(), "shared_docs");
            if (!docsDir.exists()) {
                docsDir.mkdirs();
            }

            // Sanitizar nombre de archivo para evitar caracteres no válidos en el sistema de archivos
            String safeFileName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
            File targetFile = new File(docsDir, safeFileName);

            byte[] fileBytes = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT);
            try (FileOutputStream fos = new FileOutputStream(targetFile)) {
                fos.write(fileBytes);
                fos.flush();
            }

            String resolvedMimeType = resolveMimeType(safeFileName, mimeType);

            Uri fileUri = FileProvider.getUriForFile(
                context,
                context.getPackageName() + ".fileprovider",
                targetFile
            );

            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(fileUri, resolvedMimeType);
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            Intent chooser = Intent.createChooser(viewIntent, "Abrir documento con");
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            // Conceder explícitamente permisos de lectura de URI a las aplicaciones receptoras
            List<ResolveInfo> resInfoList = context.getPackageManager().queryIntentActivities(viewIntent, PackageManager.MATCH_DEFAULT_ONLY);
            for (ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                context.grantUriPermission(packageName, fileUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("mimeType", resolvedMimeType);
            call.resolve(ret);
        } catch (android.content.ActivityNotFoundException anfe) {
            // Si la aplicación específica no está instalada, intentar abrir con selector genérico
            try {
                Context context = getContext();
                String safeFileName = fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
                File targetFile = new File(new File(context.getCacheDir(), "shared_docs"), safeFileName);
                Uri fileUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    targetFile
                );
                Intent genericIntent = new Intent(Intent.ACTION_VIEW);
                genericIntent.setDataAndType(fileUri, "*/*");
                genericIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                genericIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                Intent chooser = Intent.createChooser(genericIntent, "Abrir documento con");
                chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(chooser);

                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("mimeType", "*/*");
                call.resolve(ret);
            } catch (Exception e2) {
                call.reject("No se encontró ninguna aplicación para abrir este archivo: " + e2.getMessage());
            }
        } catch (Exception e) {
            call.reject("Error al abrir el documento: " + e.getMessage());
        }
    }

    private String resolveMimeType(String fileName, String providedMime) {
        if (providedMime != null && !providedMime.isEmpty() && !providedMime.equals("application/octet-stream") && !providedMime.equals("*/*")) {
            return providedMime;
        }

        String ext = "";
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex >= 0 && dotIndex < fileName.length() - 1) {
            ext = fileName.substring(dotIndex + 1).toLowerCase();
        }

        switch (ext) {
            case "pdf":
                return "application/pdf";
            case "ppt":
                return "application/vnd.ms-powerpoint";
            case "pptx":
                return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            case "doc":
                return "application/msword";
            case "docx":
                return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xls":
                return "application/vnd.ms-excel";
            case "xlsx":
                return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "txt":
                return "text/plain";
            case "csv":
                return "text/csv";
            case "png":
                return "image/png";
            case "jpg":
            case "jpeg":
                return "image/jpeg";
            case "mp4":
                return "video/mp4";
            case "mp3":
                return "audio/mpeg";
            case "zip":
                return "application/zip";
            default:
                String fromMap = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                return (fromMap != null) ? fromMap : "*/*";
        }
    }
}
