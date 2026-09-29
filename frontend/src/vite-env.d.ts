/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Application version from the git tag, injected by the scripts (lib/version.sh) */
  readonly VITE_APP_VERSION?: string
}
