import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agenda.universitaria',
  appName: 'Agenda Universitaria',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
