/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />
declare const __APP_VERSION__: string;

/** Global debounce timers used by search inputs */
interface Window {
  __cliSearchT?: ReturnType<typeof setTimeout>;
  __finSearchT?: ReturnType<typeof setTimeout>;
}
