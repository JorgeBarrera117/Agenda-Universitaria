package com.agenda.universitaria;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);

        // 1. Permitir que la ventana use el espacio del notch/cámara en formato horizontal (elimina la franja gris izquierda)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        // 2. Barra de estado del sistema: color institucional azul marino
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().setStatusBarColor(Color.parseColor("#081d33"));
        }

        // 3. Delimitar la barra de notificaciones para que no estorbe los botones de la app:
        // Se aplica padding superior dinámico (igual a la altura de la barra de estado),
        // pero manteniendo los laterales en 0 para ocupar toda la pantalla horizontal sin franjas grises.
        final View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    int statusBarTop = 0;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        android.graphics.Insets sb = insets.getInsets(WindowInsets.Type.statusBars());
                        statusBarTop = sb.top;
                    } else {
                        statusBarTop = insets.getSystemWindowInsetTop();
                    }
                    v.setPadding(0, statusBarTop, 0, 0);
                    return insets;
                }
            });
            content.requestApplyInsets();
        }
    }
}
