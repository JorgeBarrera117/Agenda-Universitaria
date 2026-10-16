package com.agenda.universitaria;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    private static final String TEMP_BACKUP_FILE = "export_backup_temp.json";

    @PluginMethod
    public void updateWidgetData(PluginCall call) {
        String dataJson = call.getString("dataJson");

        if (dataJson != null) {
            Context context = getContext();
            SharedPreferences prefs = context.getSharedPreferences(AgendaWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putString("widget_data", dataJson).commit();

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

                fileUri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (fileUri != null) {
                    try (OutputStream out = context.getContentResolver().openOutputStream(fileUri)) {
                        out.write(content.getBytes(StandardCharsets.UTF_8));
                        out.flush();
                    }
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

        try {
            Context context = getContext();
            File cacheDir = context.getCacheDir();
            File shareFile = new File(cacheDir, fileName);
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

            Intent chooser = Intent.createChooser(sendIntent, "Guardar o compartir copia de seguridad");
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(chooser);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Error al compartir archivo: " + e.getMessage());
        }
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
}
