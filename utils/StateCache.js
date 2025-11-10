/**
 * StateCache.js
 * Interval-based state caching with register optimization
 * Maintains multiple timeline caches for frame-perfect playback
 * Uses delta compression and predictive encoding
 */

const RingBuffer = require('./RingBuffer.js');
const DeltaCompression = require('./DeltaCompression.js');

class StateCache {
    /**
     * Creates a state cache
     * @param {Object} options - Configuration options
     * @param {number} options.capacity - Cache capacity per entity (default: 128)
     * @param {number} options.interval - Keyframe interval in ms (default: 1000)
     * @param {boolean} options.useDelta - Use delta compression (default: true)
     * @param {boolean} options.usePrediction - Use predictive encoding (default: true)
     * @param {number} options.maxHistory - Maximum history for prediction (default: 4)
     */
    constructor(options = {}) {
        this.capacity = options.capacity || 128;
        this.interval = options.interval || 1000;
        this.useDelta = options.useDelta !== undefined ? options.useDelta : true;
        this.usePrediction = options.usePrediction !== undefined ? options.usePrediction : true;
        this.maxHistory = options.maxHistory || 4;

        // Entity caches (entityId -> cache structure)
        this.caches = new Map();

        // Global keyframes (for full state snapshots at intervals)
        this.keyframes = new Map(); // entityId -> RingBuffer of keyframes

        // Statistics
        this.stats = {
            entities: 0,
            totalStates: 0,
            totalKeyframes: 0,
            compressionRatio: 0,
            hitRate: 0,
            hits: 0,
            misses: 0
        };
    }

    /**
     * Registers an entity in the cache
     * @param {string} entityId - Entity ID
     * @param {Object} initialState - Initial state
     */
    registerEntity(entityId, initialState) {
        if (this.caches.has(entityId)) {
            return; // Already registered
        }

        // Create ring buffer for this entity
        const buffer = new RingBuffer(this.capacity, {
            trackIntervals: true,
            interpolate: true
        });

        // Create keyframe buffer
        const keyframeBuffer = new RingBuffer(32, { trackIntervals: false });

        // Initialize cache structure
        this.caches.set(entityId, {
            buffer,
            lastKeyframeTime: 0,
            lastState: initialState,
            history: [initialState],
            deltaCount: 0,
            keyframeCount: 0
        });

        this.keyframes.set(entityId, keyframeBuffer);

        // Write initial keyframe
        keyframeBuffer.write({
            state: this._cloneState(initialState),
            isKeyframe: true
        }, performance.now());

        this.stats.entities++;
        this.stats.totalKeyframes++;
    }

    /**
     * Updates entity state
     * @param {string} entityId - Entity ID
     * @param {Object} state - New state
     * @param {number} timestamp - Timestamp (default: performance.now())
     */
    updateState(entityId, state, timestamp = performance.now()) {
        if (!this.caches.has(entityId)) {
            this.registerEntity(entityId, state);
            return;
        }

        const cache = this.caches.get(entityId);
        const timeSinceKeyframe = timestamp - cache.lastKeyframeTime;

        // Determine if we need a keyframe
        const needsKeyframe = timeSinceKeyframe >= this.interval;

        if (needsKeyframe) {
            // Store full state as keyframe
            this._writeKeyframe(entityId, state, timestamp);
        } else if (this.useDelta) {
            // Store delta from last state
            this._writeDelta(entityId, state, timestamp);
        } else {
            // Store full state
            cache.buffer.write(this._cloneState(state), timestamp);
        }

        // Update history for prediction
        cache.history.push(this._cloneState(state));
        if (cache.history.length > this.maxHistory) {
            cache.history.shift();
        }

        cache.lastState = state;
        this.stats.totalStates++;
    }

    /**
     * Writes a keyframe
     * @private
     */
    _writeKeyframe(entityId, state, timestamp) {
        const cache = this.caches.get(entityId);
        const keyframeBuffer = this.keyframes.get(entityId);

        // Write full state to keyframe buffer
        keyframeBuffer.write({
            state: this._cloneState(state),
            isKeyframe: true
        }, timestamp);

        // Also write to main buffer with keyframe marker
        cache.buffer.write({
            state: this._cloneState(state),
            isKeyframe: true
        }, timestamp);

        cache.lastKeyframeTime = timestamp;
        cache.keyframeCount++;
        this.stats.totalKeyframes++;
    }

    /**
     * Writes a delta state
     * @private
     */
    _writeDelta(entityId, state, timestamp) {
        const cache = this.caches.get(entityId);

        let delta;
        if (this.usePrediction && cache.history.length >= 2) {
            // Use predictive delta
            delta = DeltaCompression.computePredictiveDelta(cache.history, state);
        } else {
            // Use regular delta
            delta = DeltaCompression.computeTransformDelta(cache.lastState, state);
        }

        // Only write if there are changes
        if (delta.changed) {
            cache.buffer.write({
                delta,
                isDelta: true,
                baseTime: cache.lastKeyframeTime
            }, timestamp);

            cache.deltaCount++;
        }
    }

    /**
     * Gets state at a specific time
     * @param {string} entityId - Entity ID
     * @param {number} timestamp - Query timestamp
     * @param {boolean} interpolate - Enable interpolation (default: true)
     * @returns {Object|null} State at timestamp or null
     */
    getState(entityId, timestamp, interpolate = true) {
        if (!this.caches.has(entityId)) {
            this.stats.misses++;
            return null;
        }

        const cache = this.caches.get(entityId);

        // Try to read from buffer
        let entry = cache.buffer.readAt(timestamp, false);

        if (!entry) {
            // Try keyframe buffer
            const keyframeBuffer = this.keyframes.get(entityId);
            entry = keyframeBuffer.readAt(timestamp, false);

            if (!entry) {
                this.stats.misses++;
                return null;
            }
        }

        this.stats.hits++;

        // If it's a full state, return it
        if (entry.state) {
            return this._cloneState(entry.state);
        }

        // If it's a delta, reconstruct from keyframe
        if (entry.isDelta) {
            const keyframe = this._findKeyframe(entityId, entry.baseTime);
            if (!keyframe) {
                this.stats.misses++;
                return null;
            }

            // Apply delta to keyframe
            return DeltaCompression.applyTransformDelta(keyframe.state, entry.delta);
        }

        this.stats.misses++;
        return null;
    }

    /**
     * Finds the keyframe for a given time
     * @private
     */
    _findKeyframe(entityId, timestamp) {
        const keyframeBuffer = this.keyframes.get(entityId);
        if (!keyframeBuffer) return null;

        // Find the keyframe at or before the timestamp
        return keyframeBuffer.readAt(timestamp, false);
    }

    /**
     * Gets state with smooth interpolation
     * @param {string} entityId - Entity ID
     * @param {number} timestamp - Query timestamp
     * @param {string} method - Interpolation method ('catmullrom', 'hermite', 'squad')
     * @returns {Object|null} Interpolated state
     */
    getInterpolatedState(entityId, timestamp, method = 'catmullrom') {
        if (!this.caches.has(entityId)) {
            return null;
        }

        const cache = this.caches.get(entityId);

        // Get states around the timestamp
        const range = cache.buffer.getRange(timestamp - 100, timestamp + 100);

        if (range.length < 4) {
            // Not enough data for advanced interpolation, use simple
            return this.getState(entityId, timestamp);
        }

        // Find the 4 states that bracket the timestamp
        let beforeIndex = -1;
        let afterIndex = -1;

        for (let i = 0; i < range.length; i++) {
            if (range[i].timestamp <= timestamp) {
                beforeIndex = i;
            }
            if (range[i].timestamp >= timestamp && afterIndex === -1) {
                afterIndex = i;
                break;
            }
        }

        // Need p0, p1, p2, p3 where p1 and p2 bracket the timestamp
        if (beforeIndex >= 1 && afterIndex !== -1 && afterIndex < range.length - 1) {
            const states = [
                this._resolveState(entityId, range[beforeIndex - 1]),
                this._resolveState(entityId, range[beforeIndex]),
                this._resolveState(entityId, range[afterIndex]),
                this._resolveState(entityId, range[afterIndex + 1])
            ];

            if (states.every(s => s !== null)) {
                const AdvancedInterpolation = require('../interp/AdvancedInterpolation.js');

                // Calculate t between p1 and p2
                const t = (timestamp - range[beforeIndex].timestamp) /
                         (range[afterIndex].timestamp - range[beforeIndex].timestamp);

                return AdvancedInterpolation.interpolateTransform(states, t, method);
            }
        }

        // Fallback to simple interpolation
        return this.getState(entityId, timestamp);
    }

    /**
     * Resolves a state from a cache entry
     * @private
     */
    _resolveState(entityId, entry) {
        if (entry.data.state) {
            return entry.data.state;
        }

        if (entry.data.isDelta) {
            const keyframe = this._findKeyframe(entityId, entry.data.baseTime);
            if (!keyframe) return null;

            return DeltaCompression.applyTransformDelta(keyframe.state, entry.data.delta);
        }

        return null;
    }

    /**
     * Clears cache for an entity
     * @param {string} entityId - Entity ID
     */
    clearEntity(entityId) {
        if (this.caches.has(entityId)) {
            const cache = this.caches.get(entityId);
            cache.buffer.clear();

            const keyframeBuffer = this.keyframes.get(entityId);
            keyframeBuffer.clear();

            cache.history = [];
            cache.deltaCount = 0;
            cache.keyframeCount = 0;

            this.stats.entities--;
        }
    }

    /**
     * Clears all caches
     */
    clearAll() {
        for (const [entityId] of this.caches) {
            this.clearEntity(entityId);
        }
    }

    /**
     * Gets cache statistics
     * @returns {Object} Statistics
     */
    getStats() {
        // Calculate compression ratio
        const totalDeltaSize = Array.from(this.caches.values())
            .reduce((sum, cache) => sum + cache.deltaCount, 0);
        const totalKeyframeSize = Array.from(this.caches.values())
            .reduce((sum, cache) => sum + cache.keyframeCount, 0);

        const compressionRatio = totalKeyframeSize > 0 ?
            totalDeltaSize / (totalDeltaSize + totalKeyframeSize) : 0;

        const hitRate = (this.stats.hits + this.stats.misses) > 0 ?
            (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 : 0;

        return {
            ...this.stats,
            compressionRatio: compressionRatio.toFixed(3),
            hitRate: hitRate.toFixed(2) + '%',
            averageStatesPerEntity: this.stats.entities > 0 ?
                (this.stats.totalStates / this.stats.entities).toFixed(1) : 0,
            averageKeyframesPerEntity: this.stats.entities > 0 ?
                (this.stats.totalKeyframes / this.stats.entities).toFixed(1) : 0
        };
    }

    /**
     * Gets entity-specific statistics
     * @param {string} entityId - Entity ID
     * @returns {Object|null} Statistics or null
     */
    getEntityStats(entityId) {
        if (!this.caches.has(entityId)) {
            return null;
        }

        const cache = this.caches.get(entityId);
        const bufferStats = cache.buffer.getStats();

        return {
            ...bufferStats,
            deltaCount: cache.deltaCount,
            keyframeCount: cache.keyframeCount,
            historySize: cache.history.length,
            compressionRatio: cache.keyframeCount > 0 ?
                (cache.deltaCount / (cache.deltaCount + cache.keyframeCount)).toFixed(3) : 0
        };
    }

    /**
     * Clones a state object
     * @private
     */
    _cloneState(state) {
        return {
            position: { ...state.position },
            rotation: { ...state.rotation },
            scale: state.scale ? { ...state.scale } : { x: 1, y: 1, z: 1 }
        };
    }

    /**
     * Exports cache data
     * @param {string} entityId - Entity ID
     * @returns {Object|null} Exported data
     */
    exportCache(entityId) {
        if (!this.caches.has(entityId)) {
            return null;
        }

        const cache = this.caches.get(entityId);
        const keyframeBuffer = this.keyframes.get(entityId);

        return {
            entityId,
            states: cache.buffer.export(),
            keyframes: keyframeBuffer.export(),
            history: cache.history,
            stats: this.getEntityStats(entityId)
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateCache;
}
