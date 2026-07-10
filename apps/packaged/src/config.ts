// Packaged runtime config contract — types and env-key constants only.
//
// The WebUI packaging type is a no-Electron, terminal-launched distribution
// (daemon + web in server mode). Its launcher builds a `PackagedConfig`
// directly from the resolved bundle layout (see `webui/launcher.ts`
// `resolveLauncherConfig`) and the headless path builds one from
// `OD_DATA_DIR`/XDG (see `headless.ts`). Neither reads config through this
// module, so the former Electron-based `readPackagedConfig()` — which depended
// on `import("electron")` and the Electron-only `process.resourcesPath` — has
// been removed. What remains is the shared shape (`PackagedConfig`,
// `RawPackagedConfig`) and the env-key constants that callers key off.

export const PACKAGED_CONFIG_PATH_ENV = "OD_PACKAGED_CONFIG_PATH";
export const PACKAGED_NAMESPACE_ENV = "OD_PACKAGED_NAMESPACE";
export const PACKAGED_WEB_OUTPUT_MODE_OVERRIDE_ENV = "OD_PACKAGED_ALLOW_WEB_OUTPUT_MODE_OVERRIDE";
export const PACKAGED_WEB_STANDALONE_ROOT_ENV = "OD_WEB_STANDALONE_ROOT";
export const PACKAGED_WEB_OUTPUT_MODE_ENV = "OD_WEB_OUTPUT_MODE";

export type PackagedWebOutputMode = "server" | "standalone";
export type PackagedAmrProfile = "prod" | "test" | "local";

export type RawPackagedConfig = {
  amrProfile?: string;
  appVersion?: string;
  daemonCliEntryRelative?: string;
  daemonSidecarEntryRelative?: string;
  namespace?: string;
  namespaceBaseRoot?: string;
  nodeCommandRelative?: string;
  resourceRoot?: string;
  // Baked by tools/pack from OPEN_DESIGN_TELEMETRY_RELAY_URL and forwarded to
  // the daemon at runtime; Langfuse credentials never ship in packaged config.
  telemetryRelayUrl?: string;
  updateMetadataUrl?: string;
  // PostHog product-analytics ingest key, baked by tools/pack from
  // process.env.POSTHOG_KEY at packaging time. Forwarded to the daemon
  // sidecar's spawn env as POSTHOG_KEY. `phc_` keys are public ingest
  // tokens (write-only event capture); embedding them in the bundle is
  // the PostHog-recommended pattern. The integration short-circuits when
  // either this is absent or the user has declined Privacy → metrics.
  posthogKey?: string;
  posthogHost?: string;
  webSidecarEntryRelative?: string;
  webStandaloneRoot?: string;
  webOutputMode?: string;
};

export type PackagedConfig = {
  amrProfile: PackagedAmrProfile | null;
  appVersion: string | null;
  daemonCliEntry: string | null;
  daemonSidecarEntry: string | null;
  namespace: string;
  namespaceBaseRoot: string;
  nodeCommand: string | null;
  resourceRoot: string;
  telemetryRelayUrl: string | null;
  updateMetadataUrl: string | null;
  posthogKey: string | null;
  posthogHost: string | null;
  webSidecarEntry: string | null;
  webStandaloneRoot: string | null;
  webOutputMode: PackagedWebOutputMode;
};
