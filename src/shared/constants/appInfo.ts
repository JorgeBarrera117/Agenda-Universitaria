/**
 * ==============================================================================
 * Agenda Universitaria PWA
 * ==============================================================================
 * App desarrollada por Jorge I. Barrera V.
 * Eslogan: "POR Y PARA LOS ESTUDIANTES"
 *
 * Arquitectura: Clean Architecture & Feature-First (Offline-First local storage)
 * Persistencia: Dexie.js / IndexedDB
 * Multiplataforma: Android (Capacitor) + Web PWA
 * ==============================================================================
 */

export const APP_INFO = {
  name: 'Agenda Universitaria',
  shortName: 'AgendaUni',
  version: '1.7.9.8',
  author: 'Jorge I. Barrera V.',
  slogan: 'POR Y PARA LOS ESTUDIANTES',
  description:
    'Desarrollada para estudiantes con Clean Architecture, Dexie.js (IndexedDB local-first) y Capacitor para Android. Funciona 100% sin conexión a internet y tus apuntes son privados.',
} as const;
