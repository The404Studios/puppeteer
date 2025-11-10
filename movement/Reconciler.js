/**
 * Reconciler.js
 * Adjusts client prediction based on authoritative server snapshots
 * Implements server reconciliation for client-side prediction
 */

class Reconciler {
    /**
     * Creates a reconciler
     * @param {Object} options - Configuration options
     * @param {Object} options.predictor - Predictor instance
     * @param {Object} options.inputBuffer - InputBuffer instance
     * @param {number} options.reconciliationThreshold - Minimum error to trigger reconciliation (default: 0.1)
     * @param {boolean} options.enableSmoothing - Enable smooth corrections (default: true)
     */
    constructor(options = {}) {
        this.predictor = options.predictor || null;
        this.inputBuffer = options.inputBuffer || null;
        this.reconciliationThreshold = options.reconciliationThreshold || 0.1;
        this.enableSmoothing = options.enableSmoothing !== undefined ? options.enableSmoothing : true;

        this.reconciliationCount = 0;
        this.totalError = 0;
        this.maxError = 0;
        this.lastReconciliationTime = 0;
    }

    /**
     * Reconciles client state with server state
     * @param {Object} clientTransform - Current client-predicted transform
     * @param {Object} serverTransform - Authoritative server transform
     * @param {number} lastProcessedInputSequence - Last input sequence processed by server
     * @returns {Object} Reconciled transform
     */
    reconcile(clientTransform, serverTransform, lastProcessedInputSequence) {
        // Calculate the prediction error
        const error = this._calculateError(clientTransform, serverTransform);

        // Update statistics
        this.totalError += error;
        this.maxError = Math.max(this.maxError, error);

        // If error is below threshold, no reconciliation needed
        if (error < this.reconciliationThreshold) {
            return clientTransform;
        }

        this.reconciliationCount++;
        this.lastReconciliationTime = performance.now();

        // Mark inputs as processed
        if (this.inputBuffer) {
            this.inputBuffer.markProcessed(lastProcessedInputSequence);
        }

        // Start from server state
        let reconciledTransform = this._cloneTransform(serverTransform);

        // Replay unprocessed inputs
        if (this.predictor && this.inputBuffer) {
            const unprocessedInputs = this.inputBuffer.getInputsAfter(lastProcessedInputSequence);

            if (unprocessedInputs.length > 0) {
                reconciledTransform = this.predictor.predictSequence(
                    unprocessedInputs,
                    serverTransform
                );
            }
        }

        return reconciledTransform;
    }

    /**
     * Performs a full reconciliation with input replay
     * @param {Object} serverTransform - Server transform
     * @param {number} serverSequence - Server's last processed input sequence
     * @param {number} serverTimestamp - Server timestamp
     * @returns {Object} Reconciled transform
     */
    fullReconciliation(serverTransform, serverSequence, serverTimestamp) {
        if (!this.predictor || !this.inputBuffer) {
            console.warn('Predictor or InputBuffer not set, cannot perform full reconciliation');
            return serverTransform;
        }

        // Update server state in predictor
        this.predictor.updateServerState(serverTransform, serverTimestamp);

        // Mark inputs as processed
        this.inputBuffer.markProcessed(serverSequence);

        // Get all inputs that need to be replayed
        const inputsToReplay = this.inputBuffer.getInputsAfter(serverSequence);

        if (inputsToReplay.length === 0) {
            // No inputs to replay, use server state
            return this._cloneTransform(serverTransform);
        }

        // Replay inputs from server state
        let reconciledTransform = this._cloneTransform(serverTransform);

        for (const inputRecord of inputsToReplay) {
            const deltaTime = this._calculateDeltaTime(inputRecord, inputsToReplay);
            reconciledTransform = this.predictor.predict(
                inputRecord.input,
                deltaTime,
                reconciledTransform
            );
        }

        this.reconciliationCount++;
        this.lastReconciliationTime = performance.now();

        return reconciledTransform;
    }

    /**
     * Performs a quick reconciliation without full replay
     * @param {Object} clientTransform - Client transform
     * @param {Object} serverTransform - Server transform
     * @returns {Object} Reconciled transform
     */
    quickReconciliation(clientTransform, serverTransform) {
        const error = this._calculateError(clientTransform, serverTransform);

        if (error < this.reconciliationThreshold) {
            return clientTransform;
        }

        // Simple interpolation towards server state
        const t = Math.min(error / 5.0, 0.5); // Adjust more for larger errors

        return {
            position: this._lerpVector3(clientTransform.position, serverTransform.position, t),
            rotation: this._slerpQuaternion(clientTransform.rotation, serverTransform.rotation, t),
            scale: clientTransform.scale || { x: 1, y: 1, z: 1 }
        };
    }

    /**
     * Calculates the error between client and server transforms
     * @private
     */
    _calculateError(clientTransform, serverTransform) {
        const dx = clientTransform.position.x - serverTransform.position.x;
        const dy = clientTransform.position.y - serverTransform.position.y;
        const dz = clientTransform.position.z - serverTransform.position.z;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Calculates delta time for an input
     * @private
     */
    _calculateDeltaTime(inputRecord, allInputs) {
        const index = allInputs.indexOf(inputRecord);

        if (index === 0) {
            return 0.016; // Default 60fps
        }

        const currentTime = inputRecord.timestamp;
        const previousTime = allInputs[index - 1].timestamp;

        return (currentTime - previousTime) / 1000; // Convert to seconds
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
     * Clones a transform
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
     * Gets reconciliation statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            reconciliationCount: this.reconciliationCount,
            averageError: this.reconciliationCount > 0 ? this.totalError / this.reconciliationCount : 0,
            maxError: this.maxError,
            lastReconciliationTime: this.lastReconciliationTime,
            timeSinceLastReconciliation: performance.now() - this.lastReconciliationTime
        };
    }

    /**
     * Resets statistics
     */
    resetStats() {
        this.reconciliationCount = 0;
        this.totalError = 0;
        this.maxError = 0;
        this.lastReconciliationTime = 0;
    }

    /**
     * Sets the predictor
     * @param {Object} predictor - Predictor instance
     */
    setPredictor(predictor) {
        this.predictor = predictor;
    }

    /**
     * Sets the input buffer
     * @param {Object} inputBuffer - InputBuffer instance
     */
    setInputBuffer(inputBuffer) {
        this.inputBuffer = inputBuffer;
    }

    /**
     * Sets the reconciliation threshold
     * @param {number} threshold - New threshold
     */
    setReconciliationThreshold(threshold) {
        this.reconciliationThreshold = threshold;
    }

    /**
     * Enables or disables smoothing
     * @param {boolean} enabled - Enable smoothing
     */
    setSmoothingEnabled(enabled) {
        this.enableSmoothing = enabled;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Reconciler;
}
