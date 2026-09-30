/**
 * Application version, injected at build time from the git tag (VITE_APP_VERSION,
 * see lib/version.sh): "1.4.0" on a release, "1.4.0-7-g3d79b93" between two
 * releases, "dev" when the build was not started through the scripts.
 */
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';

/** True for a build made exactly on a release tag. */
export const IS_RELEASE = /^\d+\.\d+\.\d+$/.test(APP_VERSION);
