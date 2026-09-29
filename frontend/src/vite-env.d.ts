/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Application version from the git tag, injected by the scripts (lib/version.sh) */
  readonly VITE_APP_VERSION?: string
  /** App icon URL (dev or prod, with a content hash), set by vite.config.ts */
  readonly VITE_APP_ICON: string
}
