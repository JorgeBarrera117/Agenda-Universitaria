import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agenda.universitaria',
  appName: 'Agenda Universitaria',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_agenda',
      iconColor: '#00639B',
    },
  },
};

export default config;
