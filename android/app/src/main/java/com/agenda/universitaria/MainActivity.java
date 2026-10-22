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

        // 2. Barras del sistema (Estado superior y Botones de Navegación inferiores de Android)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
            getWindow().clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_NAVIGATION);
            getWindow().setStatusBarColor(Color.parseColor("#081d33"));
            getWindow().setNavigationBarColor(Color.parseColor("#101418"));
        }

        // 3. Adaptación universal a todos los tamaños de pantalla y barras de navegación inferiores de Android:
        // Se respetan tanto la barra de estado superior (statusBars) como la barra de 3 botones / gestos
        // inferior o lateral (navigationBars), manteniendo displayCutout libre para evitar franjas grises.
        final View content = findViewById(android.R.id.content);
        if (content != null) {
            content.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
                @Override
                public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                    int statusBarTop = 0;
                    int navBottom = 0;
                    int navLeft = 0;
                    int navRight = 0;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        android.graphics.Insets sysBars = insets.getInsets(
                                WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars()
                        );
                        statusBarTop = sysBars.top;
                        navBottom = sysBars.bottom;
                        navLeft = sysBars.left;
                        navRight = sysBars.right;
                    } else {
                        statusBarTop = insets.getSystemWindowInsetTop();
                        navBottom = insets.getSystemWindowInsetBottom();
                        navLeft = insets.getSystemWindowInsetLeft();
                        navRight = insets.getSystemWindowInsetRight();
                    }
                    v.setPadding(navLeft, statusBarTop, navRight, navBottom);
                    return insets;
                }
            });
            content.requestApplyInsets();
        }
    }
}
