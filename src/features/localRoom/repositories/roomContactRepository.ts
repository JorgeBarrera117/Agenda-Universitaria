import { db } from '../../../shared/db/AppDatabase';
import type { RoomContact, RoomMember } from '../types/room';

/**
 * Repositorio de «Compañeros guardados» (Dexie, tabla roomContacts). La interfaz no toca la base
 * directamente: usa este repositorio y el hook useRoomContacts.
 */
export const roomContactRepository = {
  /** Más recientes primero. */
  list(): Promise<RoomContact[]> {
    return db.roomContacts.orderBy('lastSeen').reverse().toArray();
  },

  async peerIds(): Promise<Set<string>> {
    return new Set((await db.roomContacts.toCollection().primaryKeys()).map(String));
  },

  /** Guarda (o actualiza) a un participante de la sala como compañero. */
  async saveMember(member: RoomMember, avatar: string | undefined): Promise<void> {
    if (!member.peerId) throw new Error('Este participante usa una versión que no permite guardarlo.');
    await db.roomContacts.put({ deviceId: member.peerId, name: member.name, color: member.color, avatarThumb: avatar, lastSeen: Date.now() });
  },

  remove(peerId: string): Promise<void> {
    return db.roomContacts.delete(peerId);
  },

  /** Al coincidir en una sala se actualizan nombre, foto y «visto por última vez» de los guardados. */
  async touch(members: readonly RoomMember[], avatars: Readonly<Record<string, string>>): Promise<void> {
    const saved = await this.peerIds();
    const now = Date.now();
    const updates = members.filter((m) => m.peerId && saved.has(m.peerId) && m.status === 'active');
    if (updates.length === 0) return;
    await db.transaction('rw', db.roomContacts, async () => {
      for (const member of updates) {
        const peerId = member.peerId as string;
        await db.roomContacts.update(peerId, { name: member.name, color: member.color, avatarThumb: avatars[member.id], lastSeen: now });
      }
    });
  },
};
