import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { roomContactRepository } from '../repositories/roomContactRepository';
import type { RoomContact } from '../types/room';

/** Compañeros guardados en vivo (Dexie) y un conjunto de huellas para saber si alguien ya está guardado. */
export function useRoomContacts(): { contacts: RoomContact[]; savedIds: ReadonlySet<string> } {
  const contacts = useLiveQuery(() => roomContactRepository.list(), [], [] as RoomContact[]);
  const savedIds = useMemo(() => new Set(contacts.map((c) => c.deviceId)), [contacts]);
  return { contacts, savedIds };
}
