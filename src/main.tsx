import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function bootstrap() {
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string } }).Capacitor;
  const isNative = typeof cap !== 'undefined' && cap?.isNativePlatform?.();
  const platform: string = cap?.getPlatform?.() ?? 'web'; // 'ios' | 'android' | 'web'

  // On native mobile there are no macOS traffic-light buttons —
  // remove the 80 px left clearance we added for Electron.
  document.documentElement.style.setProperty(
    '--mobile-header-pl',
    isNative
      ? 'max(env(safe-area-inset-left, 0px), 16px)'   // iOS / Android
      : 'max(env(safe-area-inset-left, 0px), 16px)'    // macOS Electron (native title bar)
  );

  // Top padding: on mobile use safe-area-inset-top for notch/status bar;
  // on Electron the title bar is handled natively so no extra padding needed.
  const isMobileWeb = !isNative && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  document.documentElement.style.setProperty(
    '--mobile-header-pt',
    isNative
      ? 'max(env(safe-area-inset-top, 0px), 44px)'    // iOS notch / Dynamic Island / Android status bar
      : isMobileWeb
      ? 'env(safe-area-inset-top, 0px)'            // mobile browser — safe area handles notch/island natively
      : '0px'                                      // desktop browser
  );

  // Enable :active pseudo-class on iOS Safari (requires touch listener)
  document.addEventListener('touchstart', () => {}, { passive: true });

  // Tag the root element so CSS can key off platform if needed
  document.documentElement.dataset.platform = platform;

  // Install Supabase interceptor on ALL platforms (Electron, iOS, Android, Web).
  // It handles: online → Supabase cloud, offline → local sql.js with queue.
  try {
    const { installSupabaseInterceptor } = await import('./db/supabase-interceptor');
    await installSupabaseInterceptor();
  } catch (err) {
    console.error('[Bootstrap] Failed to install interceptor:', err);
    // Even if interceptor fails, still render the app
    // Components will show errors but the app won't white-screen
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal error:', err);
  // Last-resort: show something instead of white screen
  const root = document.getElementById('root');
  if (root) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:system-ui;color:#666;gap:12px';
    const p1 = document.createElement('p');
    p1.style.fontSize = '16px';
    p1.textContent = 'App failed to load';
    const p2 = document.createElement('p');
    p2.style.cssText = 'font-size:13px;color:#999';
    p2.textContent = String(err?.message || err);
    const btn = document.createElement('button');
    btn.style.cssText = 'padding:8px 20px;border-radius:8px;border:1px solid #ddd;background:#fff;cursor:pointer;font-size:14px';
    btn.textContent = 'Reload';
    btn.addEventListener('click', () => location.reload());
    wrap.append(p1, p2, btn);
    root.replaceChildren(wrap);
  }
});
