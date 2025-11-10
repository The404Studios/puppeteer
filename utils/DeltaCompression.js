/**
 * DeltaCompression.js
 * Delta compression for efficient state updates
 * Only sends changes between states, drastically reducing bandwidth
 */

class DeltaCompression {
    /**
     * Computes delta between two transforms
     * @param {Object} previous - Previous transform state
     * @param {Object} current - Current transform state
     * @param {Object} options - Compression options
     * @returns {Object} Delta object with only changed fields
     */
    static computeTransformDelta(previous, current, options = {}) {
        const threshold = options.threshold || 0.001; // Minimum change to register
        const delta = { changed: false };

        // Position delta (3 floats)
        const posDelta = {
            x: current.position.x - previous.position.x,
            y: current.position.y - previous.position.y,
            z: current.position.z - previous.position.z
        };

        if (Math.abs(posDelta.x) > threshold ||
            Math.abs(posDelta.y) > threshold ||
            Math.abs(posDelta.z) > threshold) {
            delta.position = posDelta;
            delta.changed = true;
        }

        // Rotation delta (quaternion difference)
        const rotDelta = this._computeQuaternionDelta(previous.rotation, current.rotation);
        const rotMagnitude = Math.abs(rotDelta.x) + Math.abs(rotDelta.y) +
                            Math.abs(rotDelta.z) + Math.abs(rotDelta.w);

        if (rotMagnitude > threshold) {
            delta.rotation = rotDelta;
            delta.changed = true;
        }

        // Scale delta (if present)
        if (current.scale && previous.scale) {
            const scaleDelta = {
                x: current.scale.x - previous.scale.x,
                y: current.scale.y - previous.scale.y,
                z: current.scale.z - previous.scale.z
            };

            if (Math.abs(scaleDelta.x) > threshold ||
                Math.abs(scaleDelta.y) > threshold ||
                Math.abs(scaleDelta.z) > threshold) {
                delta.scale = scaleDelta;
                delta.changed = true;
            }
        }

        return delta;
    }

    /**
     * Applies delta to a transform
     * @param {Object} base - Base transform
     * @param {Object} delta - Delta to apply
     * @returns {Object} Resulting transform
     */
    static applyTransformDelta(base, delta) {
        const result = {
            position: { ...base.position },
            rotation: { ...base.rotation },
            scale: base.scale ? { ...base.scale } : { x: 1, y: 1, z: 1 }
        };

        if (delta.position) {
            result.position.x += delta.position.x;
            result.position.y += delta.position.y;
            result.position.z += delta.position.z;
        }

        if (delta.rotation) {
            // Apply quaternion delta
            result.rotation = this._applyQuaternionDelta(base.rotation, delta.rotation);
        }

        if (delta.scale) {
            result.scale.x += delta.scale.x;
            result.scale.y += delta.scale.y;
            result.scale.z += delta.scale.z;
        }

        return result;
    }

    /**
     * Computes quaternion delta (difference quaternion)
     * @private
     */
    static _computeQuaternionDelta(q1, q2) {
        // Delta = q2 * inverse(q1)
        const invQ1 = this._inverseQuaternion(q1);
        return this._multiplyQuaternions(q2, invQ1);
    }

    /**
     * Applies quaternion delta
     * @private
     */
    static _applyQuaternionDelta(base, delta) {
        // Result = delta * base
        return this._multiplyQuaternions(delta, base);
    }

    /**
     * Inverse of a quaternion
     * @private
     */
    static _inverseQuaternion(q) {
        const lengthSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
        return {
            x: -q.x / lengthSq,
            y: -q.y / lengthSq,
            z: -q.z / lengthSq,
            w: q.w / lengthSq
        };
    }

    /**
     * Multiplies two quaternions
     * @private
     */
    static _multiplyQuaternions(q1, q2) {
        return {
            x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
            y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
            z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
            w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
        };
    }

    /**
     * Compresses delta to binary format
     * @param {Object} delta - Delta object
     * @param {Object} options - Compression options
     * @returns {ArrayBuffer} Compressed delta
     */
    static compressDelta(delta, options = {}) {
        const bits = options.bits || 12; // Bits per component
        const maxValue = options.maxValue || 10; // Max delta value

        // Calculate bitmask for present fields
        let mask = 0;
        if (delta.position) mask |= 0b001;
        if (delta.rotation) mask |= 0b010;
        if (delta.scale) mask |= 0b100;

        // Calculate size
        let size = 1; // Mask byte
        if (delta.position) size += 6; // 3 * 2 bytes (16-bit per component)
        if (delta.rotation) size += 6; // 3 * 2 bytes (smallest three)
        if (delta.scale) size += 6;    // 3 * 2 bytes

        const buffer = new ArrayBuffer(size);
        const view = new DataView(buffer);
        let offset = 0;

        // Write mask
        view.setUint8(offset, mask);
        offset += 1;

        // Write position delta
        if (delta.position) {
            view.setInt16(offset, this._quantizeDelta(delta.position.x, maxValue, bits), true);
            offset += 2;
            view.setInt16(offset, this._quantizeDelta(delta.position.y, maxValue, bits), true);
            offset += 2;
            view.setInt16(offset, this._quantizeDelta(delta.position.z, maxValue, bits), true);
            offset += 2;
        }

        // Write rotation delta (smallest three)
        if (delta.rotation) {
            const compressed = this._compressQuaternionDelta(delta.rotation);
            view.setInt16(offset, compressed.a, true);
            offset += 2;
            view.setInt16(offset, compressed.b, true);
            offset += 2;
            view.setInt16(offset, compressed.c, true);
            offset += 2;
        }

        // Write scale delta
        if (delta.scale) {
            view.setInt16(offset, this._quantizeDelta(delta.scale.x, maxValue, bits), true);
            offset += 2;
            view.setInt16(offset, this._quantizeDelta(delta.scale.y, maxValue, bits), true);
            offset += 2;
            view.setInt16(offset, this._quantizeDelta(delta.scale.z, maxValue, bits), true);
            offset += 2;
        }

        return buffer;
    }

    /**
     * Decompresses delta from binary
     * @param {ArrayBuffer} buffer - Compressed buffer
     * @param {Object} options - Decompression options
     * @returns {Object} Delta object
     */
    static decompressDelta(buffer, options = {}) {
        const bits = options.bits || 12;
        const maxValue = options.maxValue || 10;

        const view = new DataView(buffer);
        let offset = 0;

        // Read mask
        const mask = view.getUint8(offset);
        offset += 1;

        const delta = { changed: true };

        // Read position delta
        if (mask & 0b001) {
            delta.position = {
                x: this._dequantizeDelta(view.getInt16(offset, true), maxValue, bits),
                y: this._dequantizeDelta(view.getInt16(offset + 2, true), maxValue, bits),
                z: this._dequantizeDelta(view.getInt16(offset + 4, true), maxValue, bits)
            };
            offset += 6;
        }

        // Read rotation delta
        if (mask & 0b010) {
            const a = view.getInt16(offset, true);
            const b = view.getInt16(offset + 2, true);
            const c = view.getInt16(offset + 4, true);
            delta.rotation = this._decompressQuaternionDelta({ a, b, c });
            offset += 6;
        }

        // Read scale delta
        if (mask & 0b100) {
            delta.scale = {
                x: this._dequantizeDelta(view.getInt16(offset, true), maxValue, bits),
                y: this._dequantizeDelta(view.getInt16(offset + 2, true), maxValue, bits),
                z: this._dequantizeDelta(view.getInt16(offset + 4, true), maxValue, bits)
            };
            offset += 6;
        }

        return delta;
    }

    /**
     * Quantizes a delta value
     * @private
     */
    static _quantizeDelta(value, maxValue, bits) {
        const maxInt = (1 << (bits - 1)) - 1; // -1 for sign bit
        const normalized = Math.max(-1, Math.min(1, value / maxValue));
        return Math.round(normalized * maxInt);
    }

    /**
     * Dequantizes a delta value
     * @private
     */
    static _dequantizeDelta(quantized, maxValue, bits) {
        const maxInt = (1 << (bits - 1)) - 1;
        return (quantized / maxInt) * maxValue;
    }

    /**
     * Compresses quaternion delta using smallest three
     * @private
     */
    static _compressQuaternionDelta(q) {
        const abs = [
            Math.abs(q.x),
            Math.abs(q.y),
            Math.abs(q.z),
            Math.abs(q.w)
        ];
        const maxIndex = abs.indexOf(Math.max(...abs));

        const components = [q.x, q.y, q.z, q.w];
        const sign = components[maxIndex] < 0 ? -1 : 1;

        const small = [];
        for (let i = 0; i < 4; i++) {
            if (i !== maxIndex) {
                small.push(components[i] * sign);
            }
        }

        return {
            a: Math.round(small[0] * 32767),
            b: Math.round(small[1] * 32767),
            c: Math.round(small[2] * 32767),
            index: maxIndex
        };
    }

    /**
     * Decompresses quaternion delta
     * @private
     */
    static _decompressQuaternionDelta(compressed) {
        const small = [
            compressed.a / 32767,
            compressed.b / 32767,
            compressed.c / 32767
        ];

        const sumSquares = small.reduce((sum, val) => sum + val * val, 0);
        const largest = Math.sqrt(Math.max(0, 1 - sumSquares));

        const components = [];
        let smallIndex = 0;
        for (let i = 0; i < 4; i++) {
            if (i === compressed.index) {
                components.push(largest);
            } else {
                components.push(small[smallIndex++]);
            }
        }

        return {
            x: components[0],
            y: components[1],
            z: components[2],
            w: components[3]
        };
    }

    /**
     * Predictive delta encoding
     * Uses velocity prediction to reduce delta size further
     * @param {Array} history - Array of previous states (at least 2)
     * @param {Object} current - Current state
     * @returns {Object} Predicted delta
     */
    static computePredictiveDelta(history, current) {
        if (history.length < 2) {
            // Not enough history, use regular delta
            return this.computeTransformDelta(history[history.length - 1], current);
        }

        // Predict next state based on velocity
        const prev1 = history[history.length - 1];
        const prev2 = history[history.length - 2];

        const predicted = this._predictNextState(prev2, prev1);

        // Compute delta from prediction (should be smaller)
        return this.computeTransformDelta(predicted, current);
    }

    /**
     * Predicts next state using linear extrapolation
     * @private
     */
    static _predictNextState(state1, state2) {
        return {
            position: {
                x: 2 * state2.position.x - state1.position.x,
                y: 2 * state2.position.y - state1.position.y,
                z: 2 * state2.position.z - state1.position.z
            },
            rotation: this._slerpQuaternions(state1.rotation, state2.rotation, 2.0),
            scale: state2.scale ? {
                x: 2 * state2.scale.x - state1.scale.x,
                y: 2 * state2.scale.y - state1.scale.y,
                z: 2 * state2.scale.z - state1.scale.z
            } : { x: 1, y: 1, z: 1 }
        };
    }

    /**
     * Spherical linear interpolation for quaternions
     * @private
     */
    static _slerpQuaternions(q1, q2, t) {
        let dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;

        let q2x = q2.x, q2y = q2.y, q2z = q2.z, q2w = q2.w;
        if (dot < 0) {
            q2x = -q2x; q2y = -q2y; q2z = -q2z; q2w = -q2w;
            dot = -dot;
        }

        dot = Math.min(dot, 1.0);

        if (dot > 0.9995) {
            return {
                x: q1.x + (q2x - q1.x) * t,
                y: q1.y + (q2y - q1.y) * t,
                z: q1.z + (q2z - q1.z) * t,
                w: q1.w + (q2w - q1.w) * t
            };
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
     * Gets compression statistics
     * @param {Object} fullState - Full state object
     * @param {Object} delta - Delta object
     * @returns {Object} Statistics
     */
    static getCompressionStats(fullState, delta) {
        const fullSize = JSON.stringify(fullState).length;
        const deltaSize = JSON.stringify(delta).length;
        const savings = fullSize - deltaSize;
        const ratio = deltaSize / fullSize;

        return {
            fullSize,
            deltaSize,
            savings,
            savingsPercent: ((savings / fullSize) * 100).toFixed(2) + '%',
            ratio: ratio.toFixed(3),
            fieldsChanged: [
                delta.position ? 'position' : null,
                delta.rotation ? 'rotation' : null,
                delta.scale ? 'scale' : null
            ].filter(Boolean)
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DeltaCompression;
}
