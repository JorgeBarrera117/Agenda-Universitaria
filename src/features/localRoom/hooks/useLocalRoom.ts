import { useSyncExternalStore } from 'react';
import { getRoomStoreState, subscribeRoomStore, type RoomStoreState } from '../services/roomStore';

/** Estado de la sala local de este dispositivo (se actualiza en tiempo real por SSE). */
export function useLocalRoom(): RoomStoreState {
  return useSyncExternalStore(subscribeRoomStore, getRoomStoreState, getRoomStoreState);
}
