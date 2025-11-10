/**
 * RingBuffer.js
 * High-performance circular buffer for register-based caching
 * Maintains fixed-size cache with O(1) operations and interval tracking
 * Prevents sliding and ensures frame-perfect playback
 */

class RingBuffer {
    /**
     * Creates a ring buffer
     * @param {number} capacity - Buffer capacity (power of 2 for optimal performance)
     * @param {Object} options - Configuration options
     * @param {boolean} options.trackIntervals - Track time intervals (default: true)
     * @param {boolean} options.interpolate - Enable interpolation between entries (default: true)
     */
    constructor(capacity, options = {}) {
        // Round up to nearest power of 2 for optimal masking
        this.capacity = this._nextPowerOf2(capacity);
        this.mask = this.capacity - 1; // Bitmask for fast modulo

        this.buffer = new Array(this.capacity);
        this.timestamps = new Float64Array(this.capacity);
        this.intervals = new Float32Array(this.capacity); // Delta times

        this.writeIndex = 0;
        this.readIndex = 0;
        this.count = 0;

        this.trackIntervals = options.trackIntervals !== undefined ? options.trackIntervals : true;
        this.interpolate = options.interpolate !== undefined ? options.interpolate : true;

        // Statistics
        this.stats = {
            writes: 0,
            reads: 0,
            overwrites: 0,
            averageInterval: 0,
            minInterval: Infinity,
            maxInterval: 0
        };
    }

    /**
     * Writes data to the buffer
     * @param {*} data - Data to write
     * @param {number} timestamp - Timestamp in milliseconds (default: performance.now())
     * @returns {number} Write index
     */
    write(data, timestamp = performance.now()) {
        const index = this.writeIndex & this.mask;

        // Calculate interval from previous write
        if (this.trackIntervals && this.count > 0) {
            const prevIndex = (this.writeIndex - 1) & this.mask;
            const interval = timestamp - this.timestamps[prevIndex];
            this.intervals[index] = interval;

            // Update statistics
            this.stats.minInterval = Math.min(this.stats.minInterval, interval);
            this.stats.maxInterval = Math.max(this.stats.maxInterval, interval);
            this.stats.averageInterval =
                (this.stats.averageInterval * this.stats.writes + interval) / (this.stats.writes + 1);
        }

        // Write data
        this.buffer[index] = data;
        this.timestamps[index] = timestamp;

        // Track overwrites (when buffer is full)
        if (this.count >= this.capacity) {
            this.stats.overwrites++;
            // Move read index if we're overwriting unread data
            if (this.readIndex === this.writeIndex) {
                this.readIndex = (this.readIndex + 1) & this.mask;
            }
        } else {
            this.count++;
        }

        this.writeIndex = (this.writeIndex + 1) & this.mask;
        this.stats.writes++;

        return index;
    }

    /**
     * Reads data from the buffer at a specific time
     * @param {number} timestamp - Timestamp to read at
     * @param {boolean} consume - Whether to consume (advance read pointer)
     * @returns {*} Data at timestamp, or null if not found
     */
    readAt(timestamp, consume = false) {
        if (this.count === 0) return null;

        // Binary search for bracketing timestamps
        const bracket = this._findBracketingIndices(timestamp);

        if (!bracket) return null;

        const { before, after, exact } = bracket;

        // If exact match, return that entry
        if (exact !== null) {
            if (consume) {
                this.readIndex = (exact + 1) & this.mask;
                this.count--;
            }
            this.stats.reads++;
            return this.buffer[exact];
        }

        // Interpolate between before and after
        if (this.interpolate && before !== null && after !== null) {
            const t = (timestamp - this.timestamps[before]) /
                     (this.timestamps[after] - this.timestamps[before]);

            const interpolated = this._interpolateData(
                this.buffer[before],
                this.buffer[after],
                t
            );

            if (consume) {
                this.readIndex = (after + 1) & this.mask;
                this.count = Math.max(0, this.count - (after - before + 1));
            }

            this.stats.reads++;
            return interpolated;
        }

        // Return closest entry
        const closestIndex = before !== null ? before : after;
        if (consume && closestIndex !== null) {
            this.readIndex = (closestIndex + 1) & this.mask;
            this.count--;
        }

        this.stats.reads++;
        return closestIndex !== null ? this.buffer[closestIndex] : null;
    }

    /**
     * Reads the next entry in sequence
     * @returns {Object|null} Entry with {data, timestamp, interval} or null
     */
    readNext() {
        if (this.count === 0) return null;

        const index = this.readIndex & this.mask;
        const data = this.buffer[index];
        const timestamp = this.timestamps[index];
        const interval = this.intervals[index] || 0;

        this.readIndex = (this.readIndex + 1) & this.mask;
        this.count--;
        this.stats.reads++;

        return { data, timestamp, interval };
    }

    /**
     * Peeks at data without consuming
     * @param {number} offset - Offset from read index (default: 0)
     * @returns {Object|null} Entry or null
     */
    peek(offset = 0) {
        if (offset >= this.count) return null;

        const index = (this.readIndex + offset) & this.mask;
        return {
            data: this.buffer[index],
            timestamp: this.timestamps[index],
            interval: this.intervals[index] || 0
        };
    }

    /**
     * Gets entries within a time range
     * @param {number} startTime - Start timestamp
     * @param {number} endTime - End timestamp
     * @returns {Array} Array of entries
     */
    getRange(startTime, endTime) {
        const results = [];

        for (let i = 0; i < this.count; i++) {
            const index = (this.readIndex + i) & this.mask;
            const timestamp = this.timestamps[index];

            if (timestamp >= startTime && timestamp <= endTime) {
                results.push({
                    data: this.buffer[index],
                    timestamp,
                    interval: this.intervals[index] || 0,
                    index
                });
            }
        }

        return results;
    }

    /**
     * Finds indices that bracket a timestamp
     * @private
     */
    _findBracketingIndices(timestamp) {
        if (this.count === 0) return null;

        let before = null;
        let after = null;
        let exact = null;

        // Linear search through valid entries
        for (let i = 0; i < this.count; i++) {
            const index = (this.readIndex + i) & this.mask;
            const ts = this.timestamps[index];

            if (Math.abs(ts - timestamp) < 0.001) {
                exact = index;
                break;
            }

            if (ts <= timestamp) {
                before = index;
            } else if (after === null) {
                after = index;
                break;
            }
        }

        return { before, after, exact };
    }

    /**
     * Interpolates between two data entries
     * @private
     */
    _interpolateData(data1, data2, t) {
        // If data is a transform object, interpolate it
        if (data1 && typeof data1 === 'object' && data1.position && data1.rotation) {
            return {
                position: {
                    x: data1.position.x + (data2.position.x - data1.position.x) * t,
                    y: data1.position.y + (data2.position.y - data1.position.y) * t,
                    z: data1.position.z + (data2.position.z - data1.position.z) * t
                },
                rotation: this._slerpQuaternion(data1.rotation, data2.rotation, t),
                scale: data1.scale ? {
                    x: data1.scale.x + (data2.scale.x - data1.scale.x) * t,
                    y: data1.scale.y + (data2.scale.y - data1.scale.y) * t,
                    z: data1.scale.z + (data2.scale.z - data1.scale.z) * t
                } : { x: 1, y: 1, z: 1 }
            };
        }

        // If data is a number, lerp it
        if (typeof data1 === 'number' && typeof data2 === 'number') {
            return data1 + (data2 - data1) * t;
        }

        // Otherwise, return closest
        return t < 0.5 ? data1 : data2;
    }

    /**
     * SLERP for quaternions
     * @private
     */
    _slerpQuaternion(q1, q2, t) {
        let dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;

        let q2x = q2.x, q2y = q2.y, q2z = q2.z, q2w = q2.w;
        if (dot < 0) {
            q2x = -q2x; q2y = -q2y; q2z = -q2z; q2w = -q2w;
            dot = -dot;
        }

        dot = Math.min(dot, 1.0);

        if (dot > 0.9995) {
            // Linear interpolation for very close quaternions
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
     * Clears the buffer
     */
    clear() {
        this.buffer.fill(null);
        this.timestamps.fill(0);
        this.intervals.fill(0);
        this.writeIndex = 0;
        this.readIndex = 0;
        this.count = 0;
    }

    /**
     * Gets the number of entries in the buffer
     * @returns {number} Entry count
     */
    size() {
        return this.count;
    }

    /**
     * Checks if buffer is empty
     * @returns {boolean} True if empty
     */
    isEmpty() {
        return this.count === 0;
    }

    /**
     * Checks if buffer is full
     * @returns {boolean} True if full
     */
    isFull() {
        return this.count >= this.capacity;
    }

    /**
     * Gets the time span covered by the buffer
     * @returns {number} Time span in ms
     */
    getTimeSpan() {
        if (this.count < 2) return 0;

        const oldestIndex = this.readIndex & this.mask;
        const newestIndex = (this.writeIndex - 1) & this.mask;

        return this.timestamps[newestIndex] - this.timestamps[oldestIndex];
    }

    /**
     * Gets buffer statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            ...this.stats,
            capacity: this.capacity,
            count: this.count,
            utilization: ((this.count / this.capacity) * 100).toFixed(2) + '%',
            timeSpan: this.getTimeSpan(),
            interpolationEnabled: this.interpolate
        };
    }

    /**
     * Rounds up to next power of 2
     * @private
     */
    _nextPowerOf2(n) {
        if (n <= 1) return 2;
        n--;
        n |= n >> 1;
        n |= n >> 2;
        n |= n >> 4;
        n |= n >> 8;
        n |= n >> 16;
        return n + 1;
    }

    /**
     * Resets statistics
     */
    resetStats() {
        this.stats = {
            writes: 0,
            reads: 0,
            overwrites: 0,
            averageInterval: 0,
            minInterval: Infinity,
            maxInterval: 0
        };
    }

    /**
     * Exports buffer contents
     * @returns {Array} Array of entries
     */
    export() {
        const entries = [];
        for (let i = 0; i < this.count; i++) {
            const index = (this.readIndex + i) & this.mask;
            entries.push({
                data: this.buffer[index],
                timestamp: this.timestamps[index],
                interval: this.intervals[index] || 0
            });
        }
        return entries;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RingBuffer;
}
