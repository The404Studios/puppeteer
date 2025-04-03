// === puppeteer/config/InterpolationConfig.js ===
export const DEFAULT_INTERPOLATION_CONFIG = {
  maxSnapshots: 30,               // Maximum number of snapshots to store per entity
  interpolationDelay: 100,        // Delay in ms to smooth out network jitter
  allowExtrapolation: true,       // Whether to extrapolate when no future snapshot is available
  maxExtrapolationTime: 0.5,      // Maximum time in seconds to extrapolate
  snapshotExpirationTime: 10000,  // Time in ms after which snapshots are considered expired
  blendDuration: 0.2,             // Duration in seconds for blending between states
};