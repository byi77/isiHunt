import type { CapacitorConfig } from '@capacitor/cli';

// Native Huelle fuer iOS (ADR-0015). Die App ist der unveraenderte Vite-Build
// aus `dist/`; `npx cap sync ios` kopiert ihn ins Xcode-Projekt.
const config: CapacitorConfig = {
  // Bleibt nach dem ersten TestFlight-Upload fuer immer an diesem App-Eintrag
  // haengen - eine Aenderung waere eine neue App in App Store Connect.
  appId: 'io.github.byi77.isihunt',
  appName: 'isiHunt',
  webDir: 'dist',
  ios: {
    // Der Canvas fuellt den ganzen Bildschirm; Notch und Home-Indikator
    // behandelt das Spiel schon im Web selbst ueber `env(safe-area-inset-*)`.
    contentInset: 'never',
    backgroundColor: '#0b1020',
  },
};

export default config;
