import React from 'react';
import { Bluetooth, MapPinOff, ShieldCheck, Wifi } from 'lucide-react';
import { Modal, ModalActions } from '../../../shared/components/Modal';
import { ROOM_FILLED_BUTTON, ROOM_TONAL_BUTTON } from './roomStyles';

interface NearbyPermissionDialogProps {
  /** El usuario ya lo negó: hay que activarlo desde los Ajustes del teléfono. */
  denied: boolean;
  /** host: abrir una sala (sin ubicación) · guest: buscar salas (Google Nearby exige ubicación precisa). */
  purpose: 'host' | 'guest';
  onContinue: () => void;
  onClose: () => void;
}

/**
 * Explicación previa al permiso de «dispositivos cercanos» (antes de que Android muestre el suyo):
 * qué se usa, para qué y qué NO se usa.
 */
export const NearbyPermissionDialog: React.FC<NearbyPermissionDialogProps> = ({ denied, purpose, onContinue, onClose }) => (
  <Modal isOpen onClose={onClose} title={purpose === 'guest' ? 'Buscar salas sin wifi' : 'Sala también por cercanía'} maxWidth="sm">
    <ul className="space-y-3">
      <Row icon={<Bluetooth className="h-4 w-4" />} title="Dispositivos cercanos">
        {purpose === 'guest'
          ? 'Bluetooth y Wi-Fi Direct para encontrar salas a pocos metros y conectarse sin red wifi ni datos.'
          : 'Bluetooth y Wi-Fi Direct para que los teléfonos cercanos encuentren tu sala aunque no estén en tu wifi.'}
      </Row>
      <Row icon={<ShieldCheck className="h-4 w-4" />} title="Igual de privado">
        Todo viaja cifrado con el PIN de la sala, como por wifi.
      </Row>
      <Row icon={<MapPinOff className="h-4 w-4" />} title={purpose === 'guest' ? 'Ubicación: elige «Precisa»' : 'Sin tu ubicación'}>
        {purpose === 'guest'
          ? 'Google exige este permiso para buscar dispositivos por Bluetooth y Wi-Fi Direct. La app no lee ni guarda tu ubicación; solo busca salas.'
          : 'Para abrir la sala no se pide tu ubicación (salvo en Android 11 o anterior, donde el sistema la exige para usar Bluetooth).'}
      </Row>
      <Row icon={<Wifi className="h-4 w-4" />} title="Solo mientras lo usas">
        La búsqueda se apaga al entrar a una sala, al salir de esta pantalla o al dejar la app en segundo plano.
      </Row>
    </ul>
    {denied && (
      <p className="mt-4 rounded-2xl bg-amber-500/12 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-100">
        {purpose === 'guest'
          ? 'Falta un permiso. Actívalo en Ajustes del teléfono → Apps → Agenda Universitaria → Permisos: Dispositivos cercanos y Ubicación (precisa).'
          : 'El permiso está desactivado. Actívalo en Ajustes del teléfono → Apps → Agenda Universitaria → Permisos → Dispositivos cercanos.'}
      </p>
    )}
    <ModalActions>
      <button type="button" className={ROOM_TONAL_BUTTON} onClick={onClose}>
        Ahora no
      </button>
      <button type="button" className={ROOM_FILLED_BUTTON} onClick={onContinue}>
        {denied ? 'Intentar de nuevo' : 'Continuar'}
      </button>
    </ModalActions>
  </Modal>
);

const Row: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <li className="flex items-start gap-3">
    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">{icon}</span>
    <span className="min-w-0">
      <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{title}</span>
      <span className="block text-sm text-[var(--color-md-on-surface-variant)]">{children}</span>
    </span>
  </li>
);
