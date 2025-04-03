// === puppeteer/interp/Interpolator.js ===
import Snapshot from '../core/Snapshot.js';
import { log } from '../utils/Logger.js';
import { now } from '../utils/Clock.js';
import { DEFAULT_INTERPOLATION_CONFIG } from '../config/InterpolationConfig.js';

export class Interpolator {
  constructor(config = {}) {
    this.config = { ...DEFAULT_INTERPOLATION_CONFIG, ...config };
    this.snapshots = [];
    this.lastUpdateTime = 0;
    this.entities = new Map();
    this.velocityCache = new Map();
  }
  
  addSnapshot(entityId, snapshot) {
    if (!this.entities.has(entityId)) {
      this.entities.set(entityId, []);
    }
    
    const snapshots = this.entities.get(entityId);
    
    // Insert snapshot in chronological order
    let insertIndex = snapshots.length;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      if (snapshots[i].timestamp <= snapshot.timestamp) {
        insertIndex = i + 1;
        break;
      }
    }
    
    snapshots.splice(insertIndex, 0, snapshot);
    
    // Calculate and cache velocity if we have at least 2 snapshots
    if (snapshots.length >= 2) {
      const current = snapshots[insertIndex];
      const prev = snapshots[insertIndex > 0 ? insertIndex - 1 : 0];
      
      if (current.timestamp > prev.timestamp) {
        const dt = (current.timestamp - prev.timestamp) / 1000; // Convert to seconds
        if (dt > 0) {
          const displacement = current.transform.position.sub(prev.transform.position);
          const velocity = displacement.divideScalar(dt);
          this.velocityCache.set(entityId, velocity);
        }
      }
    }
    
    // Enforce snapshot limit
    while (snapshots.length > this.config.maxSnapshots) {
      snapshots.shift();
    }
    
    this.lastUpdateTime = now();
  }
  
  clearSnapshots(entityId) {
    if (this.entities.has(entityId)) {
      this.entities.delete(entityId);
      this.velocityCache.delete(entityId);
    }
  }
  
  clearAllSnapshots() {
    this.entities.clear();
    this.velocityCache.clear();
  }
  
  getInterpolatedSnapshot(entityId, time) {
    const snapshots = this.entities.get(entityId);
    if (!snapshots || snapshots.length === 0) {
      return null;
    }
    
    // If we only have one snapshot, return it
    if (snapshots.length === 1) {
      return snapshots[0];
    }
    
    // Find the two snapshots that surround the requested time
    let before = null;
    let after = null;
    
    for (let i = 0; i < snapshots.length; i++) {
      if (snapshots[i].timestamp <= time) {
        before = snapshots[i];
      } else {
        after = snapshots[i];
        break;
      }
    }
    
    // If we don't have a "before" snapshot, use the first one
    if (!before) {
      before = snapshots[0];
    }
    
    // If we don't have an "after" snapshot, we need to extrapolate
    if (!after) {
      if (this.config.allowExtrapolation) {
        const velocity = this.velocityCache.get(entityId);
        const deltaTime = (time - before.timestamp) / 1000; // Convert to seconds
        
        if (deltaTime > this.config.maxExtrapolationTime) {
          // Clamp extrapolation time
          return before.extrapolate(this.config.maxExtrapolationTime, velocity);
        }
        
        return before.extrapolate(deltaTime, velocity);
      }
      
      return before;
    }
    
    // Calculate interpolation factor (t)
    const t = (time - before.timestamp) / (after.timestamp - before.timestamp);
    
    // Return interpolated snapshot
    return before.interpolate(after, Math.max(0, Math.min(1, t)));
  }
  
  getInterpolatedTransform(entityId, time = now() - this.config.interpolationDelay) {
    const snapshot = this.getInterpolatedSnapshot(entityId, time);
    return snapshot ? snapshot.transform : null;
  }
  
  getLatestSnapshot(entityId) {
    const snapshots = this.entities.get(entityId);
    return snapshots && snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }
  
  getVelocity(entityId) {
    return this.velocityCache.get(entityId) || null;
  }
  
  update() {
    // Clean up old snapshots
    const currentTime = now();
    const expirationTime = currentTime - this.config.snapshotExpirationTime;
    
    for (const [entityId, snapshots] of this.entities.entries()) {
      // Remove expired snapshots
      while (snapshots.length > 1 && snapshots[0].timestamp < expirationTime) {
        snapshots.shift();
      }
      
      // Remove empty entity entries
      if (snapshots.length === 0) {
        this.entities.delete(entityId);
        this.velocityCache.delete(entityId);
      }
    }
  }
}
