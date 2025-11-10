/**
 * Predictor.js
 * Runs local movement simulation for client-side prediction
 * Predicts entity state based on inputs before server confirmation
 */

class Predictor {
    /**
     * Creates a predictor
     * @param {Object} options - Configuration options
     * @param {Object} options.movementController - Movement controller instance
     * @param {boolean} options.enablePrediction - Enable prediction (default: true)
     * @param {number} options.maxPredictionTime - Max time to predict ahead in ms (default: 1000)
     */
    constructor(options = {}) {
        this.movementController = options.movementController || null;
        this.enablePrediction = options.enablePrediction !== undefined ? options.enablePrediction : true;
        this.maxPredictionTime = options.maxPredictionTime || 1000;

        this.predictedTransform = null;
        this.lastServerTransform = null;
        this.lastServerTime = 0;
        this.predictionError = 0;
    }

    /**
     * Updates the last known server state
     * @param {Object} transform - Server transform
     * @param {number} timestamp - Server timestamp
     */
    updateServerState(transform, timestamp = performance.now()) {
        this.lastServerTransform = this._cloneTransform(transform);
        this.lastServerTime = timestamp;

        // Calculate prediction error if we have a predicted state
        if (this.predictedTransform) {
            this.predictionError = this._calculateError(
                this.predictedTransform,
                this.lastServerTransform
            );
        }
    }

    /**
     * Predicts entity state based on input
     * @param {Object} input - Input data
     * @param {number} deltaTime - Time delta in seconds
     * @param {Object} currentTransform - Current transform (optional, uses last server state if not provided)
     * @returns {Object} Predicted transform
     */
    predict(input, deltaTime, currentTransform = null) {
        if (!this.enablePrediction) {
            return currentTransform || this.lastServerTransform;
        }

        // Start from current or last known server state
        const baseTransform = currentTransform || this.lastServerTransform;

        if (!baseTransform) {
            console.warn('No base transform available for prediction');
            return null;
        }

        // Clone the transform for prediction
        let predictedTransform = this._cloneTransform(baseTransform);

        // Apply movement if controller is available
        if (this.movementController) {
            predictedTransform = this._applyMovement(predictedTransform, input, deltaTime);
        } else {
            // Simple prediction without movement controller
            predictedTransform = this._applyBasicMovement(predictedTransform, input, deltaTime);
        }

        this.predictedTransform = predictedTransform;

        return predictedTransform;
    }

    /**
     * Predicts multiple inputs in sequence
     * @param {Array} inputs - Array of input records
     * @param {Object} startTransform - Starting transform
     * @returns {Object} Final predicted transform
     */
    predictSequence(inputs, startTransform) {
        let transform = this._cloneTransform(startTransform);

        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i].input;
            const deltaTime = this._calculateDeltaTime(inputs, i);

            transform = this.predict(input, deltaTime, transform);
        }

        return transform;
    }

    /**
     * Applies movement using the movement controller
     * @private
     */
    _applyMovement(transform, input, deltaTime) {
        // Create a temporary transform for the controller
        const tempTransform = this._cloneTransform(transform);

        // Apply movement based on input
        if (input.forward) {
            tempTransform.position = this._moveInDirection(
                tempTransform.position,
                tempTransform.rotation,
                { x: 0, y: 0, z: -1 },
                this.movementController.maxSpeed || 5,
                deltaTime
            );
        }

        if (input.backward) {
            tempTransform.position = this._moveInDirection(
                tempTransform.position,
                tempTransform.rotation,
                { x: 0, y: 0, z: 1 },
                this.movementController.maxSpeed || 5,
                deltaTime
            );
        }

        if (input.left) {
            tempTransform.position = this._moveInDirection(
                tempTransform.position,
                tempTransform.rotation,
                { x: -1, y: 0, z: 0 },
                this.movementController.maxSpeed || 5,
                deltaTime
            );
        }

        if (input.right) {
            tempTransform.position = this._moveInDirection(
                tempTransform.position,
                tempTransform.rotation,
                { x: 1, y: 0, z: 0 },
                this.movementController.maxSpeed || 5,
                deltaTime
            );
        }

        // Apply rotation
        if (input.rotateLeft) {
            tempTransform.rotation = this._rotateY(
                tempTransform.rotation,
                (this.movementController.rotationSpeed || 3) * deltaTime
            );
        }

        if (input.rotateRight) {
            tempTransform.rotation = this._rotateY(
                tempTransform.rotation,
                -(this.movementController.rotationSpeed || 3) * deltaTime
            );
        }

        return tempTransform;
    }

    /**
     * Applies basic movement without a controller
     * @private
     */
    _applyBasicMovement(transform, input, deltaTime) {
        const speed = 5; // Default speed
        const rotationSpeed = 3; // Default rotation speed

        const result = this._cloneTransform(transform);

        // Basic forward/backward
        if (input.forward) {
            result.position.z -= speed * deltaTime;
        }
        if (input.backward) {
            result.position.z += speed * deltaTime;
        }

        // Basic strafe
        if (input.left) {
            result.position.x -= speed * deltaTime;
        }
        if (input.right) {
            result.position.x += speed * deltaTime;
        }

        return result;
    }

    /**
     * Moves in a direction relative to rotation
     * @private
     */
    _moveInDirection(position, rotation, direction, speed, deltaTime) {
        // Apply quaternion rotation to direction vector
        const rotatedDir = this._applyQuaternionToVector(direction, rotation);

        return {
            x: position.x + rotatedDir.x * speed * deltaTime,
            y: position.y + rotatedDir.y * speed * deltaTime,
            z: position.z + rotatedDir.z * speed * deltaTime
        };
    }

    /**
     * Rotates a quaternion around Y axis
     * @private
     */
    _rotateY(quaternion, angle) {
        // Create rotation quaternion for Y axis
        const halfAngle = angle / 2;
        const s = Math.sin(halfAngle);
        const c = Math.cos(halfAngle);

        const rotQuat = { x: 0, y: s, z: 0, w: c };

        // Multiply quaternions
        return this._multiplyQuaternions(quaternion, rotQuat);
    }

    /**
     * Multiplies two quaternions
     * @private
     */
    _multiplyQuaternions(q1, q2) {
        return {
            x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
            y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
            z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
            w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
        };
    }

    /**
     * Applies quaternion rotation to a vector
     * @private
     */
    _applyQuaternionToVector(vector, quaternion) {
        const qx = quaternion.x, qy = quaternion.y, qz = quaternion.z, qw = quaternion.w;
        const vx = vector.x, vy = vector.y, vz = vector.z;

        // Calculate quat * vector
        const ix = qw * vx + qy * vz - qz * vy;
        const iy = qw * vy + qz * vx - qx * vz;
        const iz = qw * vz + qx * vy - qy * vx;
        const iw = -qx * vx - qy * vy - qz * vz;

        // Calculate result * inverse quat
        return {
            x: ix * qw + iw * -qx + iy * -qz - iz * -qy,
            y: iy * qw + iw * -qy + iz * -qx - ix * -qz,
            z: iz * qw + iw * -qz + ix * -qy - iy * -qx
        };
    }

    /**
     * Calculates delta time between input records
     * @private
     */
    _calculateDeltaTime(inputs, index) {
        if (index === 0) {
            return 0.016; // Default 60fps
        }

        const currentTime = inputs[index].timestamp;
        const previousTime = inputs[index - 1].timestamp;

        return (currentTime - previousTime) / 1000; // Convert to seconds
    }

    /**
     * Calculates prediction error
     * @private
     */
    _calculateError(predicted, actual) {
        const dx = predicted.position.x - actual.position.x;
        const dy = predicted.position.y - actual.position.y;
        const dz = predicted.position.z - actual.position.z;

        return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
     * Gets the last predicted transform
     * @returns {Object|null} Predicted transform
     */
    getPredictedTransform() {
        return this.predictedTransform;
    }

    /**
     * Gets the last prediction error
     * @returns {number} Prediction error magnitude
     */
    getPredictionError() {
        return this.predictionError;
    }

    /**
     * Enables or disables prediction
     * @param {boolean} enabled - Enable prediction
     */
    setPredictionEnabled(enabled) {
        this.enablePrediction = enabled;
    }

    /**
     * Resets prediction state
     */
    reset() {
        this.predictedTransform = null;
        this.lastServerTransform = null;
        this.lastServerTime = 0;
        this.predictionError = 0;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Predictor;
}
