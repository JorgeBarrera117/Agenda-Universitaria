import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

export type BackHandlerResult = boolean | void;
export type BackHandlerFn = () => BackHandlerResult | Promise<BackHandlerResult>;

export interface BackHandlerRegistration {
  id: string;
  priority: number;
  handler: BackHandlerFn;
}

/**
 * Niveles de prioridad estandarizados para la pila de navegación de retroceso (LIFO).
 * Los valores numéricos más altos se ejecutan primero.
 */
export const BACK_PRIORITY = {
  /** Visor de imágenes a pantalla completa con zoom o overlays multimedia */
  OVERLAY: 100,
  /** Cuadros de diálogo y formularios modales (crear/editar clase, materia, profesor, confirmación de borrado) */
  MODAL: 80,
  /** Pantallas completas secundarias (Ajustes de la aplicación) */
  SETTINGS: 60,
  /** Vistas internas de un módulo (ej. Editor de notas -> Lector -> Lista) */
  SUBVIEW: 40,
  /** Navegación entre pestañas principales (ej. Materias/Profesores/Apuntes -> Horario) */
  TAB: 20,
  /** Nivel base del sistema */
  ROOT: 0,
} as const;

class BackButtonManager {
  private handlers: BackHandlerRegistration[] = [];
  private isInitialized = false;
  private lastBackPressTime = 0;
  private onExitPromptCallback: (() => void) | null = null;

  /**
   * Inicializa la escucha global del botón de retroceso en Capacitor (Android) y Web.
   */
  public init(options?: { onExitPrompt?: () => void }) {
    if (options?.onExitPrompt) {
      this.onExitPromptCallback = options.onExitPrompt;
    }

    if (this.isInitialized) return;
    this.isInitialized = true;

    // Escuchar el botón físico/gestual de Android mediante el plugin nativo de Capacitor
    if (Capacitor.isNativePlatform()) {
      try {
        CapApp.addListener('backButton', async () => {
          await this.handleBackPress();
        });
      } catch (err) {
        console.warn('Capacitor App plugin no disponible para backButton:', err);
      }
    }

    // Escuchar el evento popstate para navegadores web estándar / PWA en escritorio
    window.addEventListener('popstate', async () => {
      if (!Capacitor.isNativePlatform()) {
        await this.handleBackPress();
      }
    });
  }

  public setExitPromptCallback(callback: () => void) {
    this.onExitPromptCallback = callback;
  }

  /**
   * Registra una acción de retroceso con una prioridad específica.
   * Retorna una función de limpieza para desregistrarla.
   */
  public register(registration: BackHandlerRegistration): () => void {
    // Evitar registros duplicados con el mismo ID
    this.handlers = this.handlers.filter((h) => h.id !== registration.id);
    this.handlers.push(registration);

    // Mantener la pila ordenada de mayor a menor prioridad
    this.handlers.sort((a, b) => b.priority - a.priority);

    return () => {
      this.unregister(registration.id);
    };
  }

  /**
   * Elimina un handler de la pila por su ID.
   */
  public unregister(id: string) {
    this.handlers = this.handlers.filter((h) => h.id !== id);
  }

  /**
   * Ejecuta el retroceso secuencial por orden de prioridad.
   * Si ningún handler maneja el retroceso, activa el escudo de "Doble toque para salir".
   */
  public async handleBackPress(): Promise<boolean> {
    for (const item of this.handlers) {
      try {
        const handled = await item.handler();
        // Si el handler retorna false explícito, delega al siguiente handler de menor prioridad.
        // Si retorna true o void/undefined, se considera consumido y frena la propagación.
        if (handled !== false) {
          return true;
        }
      } catch (err) {
        console.error(`Error ejecutando acción de retroceso [${item.id}]:`, err);
      }
    }

    // Nivel ROOT (Horario sin modales ni pantallas secundarias abiertas)
    const now = Date.now();
    if (now - this.lastBackPressTime < 2000) {
      // Segundo toque en menos de 2 segundos: Salir de la app
      if (Capacitor.isNativePlatform()) {
        try {
          await CapApp.exitApp();
        } catch (err) {
          console.warn('Error al invocar exitApp():', err);
        }
      }
      return true;
    } else {
      // Primer toque: Advertencia al usuario mediante Toast
      this.lastBackPressTime = now;
      this.onExitPromptCallback?.();
      return true;
    }
  }
}

export const backButtonManager = new BackButtonManager();
