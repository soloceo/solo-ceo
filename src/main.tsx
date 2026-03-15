import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function bootstrap() {
  const cap = (window as any).Capacitor;
  const isNative = typeof cap !== 'undefined' && cap?.isNativePlatform?.();
  const platform: string = cap?.getPlatform?.() ?? 'web'; // 'ios' | 'android' | 'web'

  // On native mobile there are no macOS traffic-light buttons —
  // remove the 80 px left clearance we added for Electron.
  document.documentElement.style.setProperty(
    '--mobile-header-pl',
    isNative
      ? 'max(env(safe-area-inset-left), 16px)'   // iOS / Android
      : 'max(env(safe-area-inset-left), 16px)'    // macOS Electron (native title bar)
  );

  // Top padding: on mobile use safe-area-inset-top for notch/status bar;
  // on Electron the title bar is handled natively so no extra padding needed.
  document.documentElement.style.setProperty(
    '--mobile-header-pt',
    isNative
      ? 'max(env(safe-area-inset-top), 44px)'    // iOS notch / Dynamic Island / Android status bar
      : '0px'                                      // macOS Electron
  );

  // Tag the root element so CSS can key off platform if needed
  document.documentElement.dataset.platform = platform;

  // Install Supabase interceptor on ALL platforms (Electron, iOS, Android, Web).
  // It handles: online → Supabase cloud, offline → local sql.js with queue.
  const { installSupabaseInterceptor } = await import('./db/supabase-interceptor');
  await installSupabaseInterceptor();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap();
