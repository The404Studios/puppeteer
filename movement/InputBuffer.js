/**
 * InputBuffer.js
 * Records client inputs with timestamps for client-side prediction
 * Maintains a history of inputs for replaying after server corrections
 */

class InputBuffer {
    /**
     * Creates an input buffer
     * @param {Object} options - Configuration options
     * @param {number} options.maxSize - Maximum number of inputs to store (default: 100)
     * @param {number} options.expirationTime - Time in ms to keep old inputs (default: 5000)
     */
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.expirationTime = options.expirationTime || 5000;

        this.inputs = [];
        this.sequence = 0;
        this.lastProcessedSequence = -1;
    }

    /**
     * Records a new input
     * @param {Object} input - Input data (keys, mouse, etc.)
     * @param {number} timestamp - Input timestamp (default: performance.now())
     * @returns {Object} Input record with sequence number
     */
    record(input, timestamp = performance.now()) {
        const record = {
            sequence: this.sequence++,
            input: this._cloneInput(input),
            timestamp,
            processed: false
        };

        this.inputs.push(record);

        // Trim if exceeded max size
        if (this.inputs.length > this.maxSize) {
            this.inputs.shift();
        }

        // Remove expired inputs
        this._removeExpired(timestamp);

        return record;
    }

    /**
     * Gets an input by sequence number
     * @param {number} sequence - Sequence number
     * @returns {Object|null} Input record or null
     */
    getInput(sequence) {
        return this.inputs.find(record => record.sequence === sequence) || null;
    }

    /**
     * Gets all inputs after a given sequence number
     * @param {number} sequence - Sequence number
     * @returns {Array} Array of input records
     */
    getInputsAfter(sequence) {
        return this.inputs.filter(record => record.sequence > sequence);
    }

    /**
     * Gets all unprocessed inputs
     * @returns {Array} Array of unprocessed input records
     */
    getUnprocessedInputs() {
        return this.inputs.filter(record => !record.processed);
    }

    /**
     * Marks inputs up to a sequence as processed
     * @param {number} sequence - Last processed sequence number
     */
    markProcessed(sequence) {
        this.lastProcessedSequence = Math.max(this.lastProcessedSequence, sequence);

        for (const record of this.inputs) {
            if (record.sequence <= sequence) {
                record.processed = true;
            }
        }

        // Clean up old processed inputs
        this._cleanupProcessed();
    }

    /**
     * Gets the last processed sequence number
     * @returns {number} Last processed sequence
     */
    getLastProcessedSequence() {
        return this.lastProcessedSequence;
    }

    /**
     * Gets the current sequence number
     * @returns {number} Current sequence
     */
    getCurrentSequence() {
        return this.sequence;
    }

    /**
     * Gets all inputs in a time range
     * @param {number} startTime - Start timestamp
     * @param {number} endTime - End timestamp
     * @returns {Array} Array of input records
     */
    getInputsInRange(startTime, endTime) {
        return this.inputs.filter(
            record => record.timestamp >= startTime && record.timestamp <= endTime
        );
    }

    /**
     * Gets the most recent input
     * @returns {Object|null} Most recent input record or null
     */
    getLatest() {
        if (this.inputs.length === 0) {
            return null;
        }
        return this.inputs[this.inputs.length - 1];
    }

    /**
     * Gets the oldest input
     * @returns {Object|null} Oldest input record or null
     */
    getOldest() {
        if (this.inputs.length === 0) {
            return null;
        }
        return this.inputs[0];
    }

    /**
     * Gets the number of inputs in the buffer
     * @returns {number} Number of inputs
     */
    getCount() {
        return this.inputs.length;
    }

    /**
     * Clears all inputs
     */
    clear() {
        this.inputs = [];
        this.lastProcessedSequence = -1;
    }

    /**
     * Removes expired inputs based on timestamp
     * @private
     */
    _removeExpired(currentTime) {
        const cutoffTime = currentTime - this.expirationTime;

        while (this.inputs.length > 0 && this.inputs[0].timestamp < cutoffTime) {
            this.inputs.shift();
        }
    }

    /**
     * Cleans up old processed inputs
     * @private
     */
    _cleanupProcessed() {
        // Keep some processed inputs for safety (at least 10 or half the buffer)
        const minKeep = Math.min(10, Math.floor(this.maxSize / 2));

        let processedCount = 0;
        for (const record of this.inputs) {
            if (record.processed) {
                processedCount++;
            }
        }

        if (processedCount > minKeep) {
            // Remove old processed inputs
            const toRemove = processedCount - minKeep;
            let removed = 0;

            this.inputs = this.inputs.filter(record => {
                if (removed < toRemove && record.processed) {
                    removed++;
                    return false;
                }
                return true;
            });
        }
    }

    /**
     * Clones input data to prevent external modifications
     * @private
     */
    _cloneInput(input) {
        if (typeof input !== 'object' || input === null) {
            return input;
        }

        if (Array.isArray(input)) {
            return input.map(item => this._cloneInput(item));
        }

        const cloned = {};
        for (const key in input) {
            if (input.hasOwnProperty(key)) {
                cloned[key] = this._cloneInput(input[key]);
            }
        }
        return cloned;
    }

    /**
     * Gets statistics about the buffer
     * @returns {Object} Statistics object
     */
    getStats() {
        const processedCount = this.inputs.filter(r => r.processed).length;
        const unprocessedCount = this.inputs.length - processedCount;

        let timeSpan = 0;
        if (this.inputs.length >= 2) {
            timeSpan = this.inputs[this.inputs.length - 1].timestamp - this.inputs[0].timestamp;
        }

        return {
            totalInputs: this.inputs.length,
            processedInputs: processedCount,
            unprocessedInputs: unprocessedCount,
            currentSequence: this.sequence,
            lastProcessedSequence: this.lastProcessedSequence,
            timeSpan,
            oldestTimestamp: this.inputs[0]?.timestamp || 0,
            latestTimestamp: this.inputs[this.inputs.length - 1]?.timestamp || 0
        };
    }

    /**
     * Creates a snapshot of the buffer state
     * @returns {Object} Snapshot object
     */
    createSnapshot() {
        return {
            inputs: this.inputs.map(record => ({ ...record, input: this._cloneInput(record.input) })),
            sequence: this.sequence,
            lastProcessedSequence: this.lastProcessedSequence
        };
    }

    /**
     * Restores buffer from a snapshot
     * @param {Object} snapshot - Snapshot object
     */
    restoreSnapshot(snapshot) {
        this.inputs = snapshot.inputs.map(record => ({
            ...record,
            input: this._cloneInput(record.input)
        }));
        this.sequence = snapshot.sequence;
        this.lastProcessedSequence = snapshot.lastProcessedSequence;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = InputBuffer;
}
