/**
 * LagCompensator.js
 * Smooths prediction errors on the client side
 * Handles correction of position/rotation when server state differs from prediction
 */

class LagCompensator {
    /**
     * Creates a lag compensator
     * @param {Object} options - Configuration options
     * @param {number} options.smoothingDuration - Duration to smooth corrections in ms (default: 100)
     * @param {number} options.snapThreshold - Distance threshold for instant snapping (default: 5.0)
     * @param {number} options.minCorrectionThreshold - Minimum error to apply correction (default: 0.01)
     * @param {boolean} options.smoothRotation - Enable rotation smoothing (default: true)
     */
    constructor(options = {}) {
        this.smoothingDuration = options.smoothingDuration || 100;
        this.snapThreshold = options.snapThreshold || 5.0;
        this.minCorrectionThreshold = options.minCorrectionThreshold || 0.01;
        this.smoothRotation = options.smoothRotation !== undefined ? options.smoothRotation : true;

        this.corrections = new Map(); // entityId -> correction state
        this.errorHistory = new Map(); // entityId -> array of recent errors
        this.maxErrorHistorySize = 10;
    }

    /**
     * Applies a server correction for an entity
     * @param {string} entityId - Entity ID
     * @param {Object} currentTransform - Current predicted transform
     * @param {Object} serverTransform - Authoritative server transform
     * @param {number} timestamp - Current timestamp
     */
    applyCorrection(entityId, currentTransform, serverTransform, timestamp = performance.now()) {
        // Calculate position error
        const positionError = this._calculatePositionError(
            currentTransform.position,
            serverTransform.position
        );

        // Calculate rotation error
        const rotationError = this._calculateRotationError(
            currentTransform.rotation,
            serverTransform.rotation
        );

        // Track error history
        this._trackError(entityId, positionError, rotationError);

        // If error is below threshold, no correction needed
        if (positionError < this.minCorrectionThreshold && rotationError < this.minCorrectionThreshold) {
            this.corrections.delete(entityId);
            return currentTransform;
        }

        // If error is very large, snap immediately
        if (positionError > this.snapThreshold) {
            console.warn(`Large position error (${positionError.toFixed(2)}), snapping to server state`);
            this.corrections.delete(entityId);
            return this._cloneTransform(serverTransform);
        }

        // Create smooth correction
        this.corrections.set(entityId, {
            startTransform: this._cloneTransform(currentTransform),
            targetTransform: this._cloneTransform(serverTransform),
            startTime: timestamp,
            endTime: timestamp + this.smoothingDuration,
            positionError,
            rotationError
        });

        return currentTransform;
    }

    /**
     * Gets the corrected transform for an entity
     * @param {string} entityId - Entity ID
     * @param {Object} currentTransform - Current transform
     * @param {number} timestamp - Current timestamp
     * @returns {Object} Corrected transform
     */
    getCorrectedTransform(entityId, currentTransform, timestamp = performance.now()) {
        const correction = this.corrections.get(entityId);

        if (!correction) {
            return currentTransform;
        }

        // Calculate interpolation factor
        const elapsed = timestamp - correction.startTime;
        const duration = correction.endTime - correction.startTime;
        let t = Math.min(elapsed / duration, 1.0);

        // Apply easing for smoother correction
        t = this._easeOutCubic(t);

        // Interpolate position
        const position = this._lerpVector3(
            correction.startTransform.position,
            correction.targetTransform.position,
            t
        );

        // Interpolate rotation
        let rotation;
        if (this.smoothRotation) {
            rotation = this._slerpQuaternion(
                correction.startTransform.rotation,
                correction.targetTransform.rotation,
                t
            );
        } else {
            rotation = correction.targetTransform.rotation;
        }

        // Check if correction is complete
        if (t >= 1.0) {
            this.corrections.delete(entityId);
        }

        return {
            position,
            rotation,
            scale: currentTransform.scale || { x: 1, y: 1, z: 1 }
        };
    }

    /**
     * Calculates position error magnitude
     * @private
     */
    _calculatePositionError(pos1, pos2) {
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const dz = pos2.z - pos1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculates rotation error (angular difference)
     * @private
     */
    _calculateRotationError(rot1, rot2) {
        // Calculate dot product of quaternions
        const dot = rot1.x * rot2.x + rot1.y * rot2.y + rot1.z * rot2.z + rot1.w * rot2.w;
        // Angle between quaternions: 2 * acos(|dot|)
        return 2 * Math.acos(Math.min(Math.abs(dot), 1.0));
    }

    /**
     * Tracks error for statistics
     * @private
     */
    _trackError(entityId, positionError, rotationError) {
        if (!this.errorHistory.has(entityId)) {
            this.errorHistory.set(entityId, []);
        }

        const history = this.errorHistory.get(entityId);
        history.push({ position: positionError, rotation: rotationError, time: performance.now() });

        // Keep only recent history
        if (history.length > this.maxErrorHistorySize) {
            history.shift();
        }
    }

    /**
     * Linear interpolation for Vector3
     * @private
     */
    _lerpVector3(v1, v2, t) {
        return {
            x: v1.x + (v2.x - v1.x) * t,
            y: v1.y + (v2.y - v1.y) * t,
            z: v1.z + (v2.z - v1.z) * t
        };
    }

    /**
     * Spherical linear interpolation for Quaternion
     * @private
     */
    _slerpQuaternion(q1, q2, t) {
        let dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;

        // If the dot product is negative, slerp won't take the shorter path
        // Fix by reversing one quaternion
        let q2x = q2.x, q2y = q2.y, q2z = q2.z, q2w = q2.w;
        if (dot < 0) {
            q2x = -q2x;
            q2y = -q2y;
            q2z = -q2z;
            q2w = -q2w;
            dot = -dot;
        }

        // Clamp dot product
        dot = Math.min(dot, 1.0);

        if (dot > 0.9995) {
            // Quaternions are very close, use linear interpolation
            return this._normalizeQuaternion({
                x: q1.x + (q2x - q1.x) * t,
                y: q1.y + (q2y - q1.y) * t,
                z: q1.z + (q2z - q1.z) * t,
                w: q1.w + (q2w - q1.w) * t
            });
        }

        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        const a = Math.sin((1 - t) * theta) / sinTheta;
        const b = Math.sin(t * theta) / sinTheta;

        return {
            x: q1.x * a + q2x * b,
            y: q1.y * a + q2y * b,
            z: q1.z * a + q2z * b,
            w: q1.w * a + q2w * b
        };
    }

    /**
     * Normalizes a quaternion
     * @private
     */
    _normalizeQuaternion(q) {
        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        if (length === 0) {
            return { x: 0, y: 0, z: 0, w: 1 };
        }
        return {
            x: q.x / length,
            y: q.y / length,
            z: q.z / length,
            w: q.w / length
        };
    }

    /**
     * Easing function for smooth corrections
     * @private
     */
    _easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * Clones a transform object
     * @private
     */
    _cloneTransform(transform) {
        return {
            position: { ...transform.position },
            rotation: { ...transform.rotation },
            scale: transform.scale ? { ...transform.scale } : { x: 1, y: 1, z: 1 }
        };
    }

    /**
     * Gets the average position error for an entity
     * @param {string} entityId - Entity ID
     * @returns {number} Average position error
     */
    getAverageError(entityId) {
        const history = this.errorHistory.get(entityId);
        if (!history || history.length === 0) {
            return 0;
        }

        const sum = history.reduce((acc, entry) => acc + entry.position, 0);
        return sum / history.length;
    }

    /**
     * Gets statistics for all entities
     * @returns {Object} Statistics object
     */
    getStats() {
        const stats = {
            activeCorrections: this.corrections.size,
            entities: {}
        };

        for (const [entityId, history] of this.errorHistory.entries()) {
            if (history.length > 0) {
                const avgPosition = history.reduce((acc, e) => acc + e.position, 0) / history.length;
                const avgRotation = history.reduce((acc, e) => acc + e.rotation, 0) / history.length;

                stats.entities[entityId] = {
                    averagePositionError: avgPosition,
                    averageRotationError: avgRotation,
                    samples: history.length
                };
            }
        }

        return stats;
    }

    /**
     * Checks if an entity is currently being corrected
     * @param {string} entityId - Entity ID
     * @returns {boolean} True if correction is active
     */
    isCorrectingEntity(entityId) {
        return this.corrections.has(entityId);
    }

    /**
     * Cancels correction for an entity
     * @param {string} entityId - Entity ID
     */
    cancelCorrection(entityId) {
        this.corrections.delete(entityId);
    }

    /**
     * Resets all corrections and history
     */
    reset() {
        this.corrections.clear();
        this.errorHistory.clear();
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LagCompensator;
}
