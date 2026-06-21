/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL của backend, gồm cả context-path. */
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
