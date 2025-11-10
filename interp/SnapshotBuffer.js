/**
 * SnapshotBuffer.js
 * Keeps the last N snapshots for smoothing and interpolation
 */

class SnapshotBuffer {
    /**
     * Creates a snapshot buffer
     * @param {Object} options - Configuration options
     * @param {number} options.maxSnapshots - Maximum number of snapshots to store (default: 30)
     * @param {number} options.expirationTime - Time in ms after which snapshots expire (default: 5000)
     */
    constructor(options = {}) {
        this.maxSnapshots = options.maxSnapshots || 30;
        this.expirationTime = options.expirationTime || 5000;
        this.snapshots = [];
    }

    /**
     * Adds a snapshot to the buffer
     * @param {Object} snapshot - Snapshot object with time property
     */
    add(snapshot) {
        if (!snapshot || typeof snapshot.time !== 'number') {
            console.warn('Invalid snapshot: must have a time property');
            return;
        }

        // Insert snapshot in chronological order
        let insertIndex = this.snapshots.length;
        for (let i = this.snapshots.length - 1; i >= 0; i--) {
            if (snapshot.time >= this.snapshots[i].time) {
                insertIndex = i + 1;
                break;
            }
            if (i === 0) {
                insertIndex = 0;
            }
        }

        this.snapshots.splice(insertIndex, 0, snapshot);

        // Trim to max size
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        // Remove expired snapshots
        this.removeExpired();
    }

    /**
     * Gets the two snapshots that bracket a given time
     * @param {number} time - Time to query
     * @returns {Object|null} Object with {before, after} snapshots or null
     */
    getBracketingSnapshots(time) {
        if (this.snapshots.length === 0) {
            return null;
        }

        if (this.snapshots.length === 1) {
            return { before: this.snapshots[0], after: this.snapshots[0] };
        }

        // Find the two snapshots that bracket the time
        let before = null;
        let after = null;

        for (let i = 0; i < this.snapshots.length; i++) {
            if (this.snapshots[i].time <= time) {
                before = this.snapshots[i];
            }
            if (this.snapshots[i].time >= time && !after) {
                after = this.snapshots[i];
                break;
            }
        }

        // If we don't have both, use the closest available
        if (!before) before = this.snapshots[0];
        if (!after) after = this.snapshots[this.snapshots.length - 1];

        return { before, after };
    }

    /**
     * Gets the most recent snapshot
     * @returns {Object|null} Most recent snapshot or null
     */
    getLatest() {
        if (this.snapshots.length === 0) {
            return null;
        }
        return this.snapshots[this.snapshots.length - 1];
    }

    /**
     * Gets the oldest snapshot
     * @returns {Object|null} Oldest snapshot or null
     */
    getOldest() {
        if (this.snapshots.length === 0) {
            return null;
        }
        return this.snapshots[0];
    }

    /**
     * Gets a snapshot at a specific index
     * @param {number} index - Index to retrieve
     * @returns {Object|null} Snapshot at index or null
     */
    getAt(index) {
        if (index < 0 || index >= this.snapshots.length) {
            return null;
        }
        return this.snapshots[index];
    }

    /**
     * Gets the number of snapshots in the buffer
     * @returns {number} Number of snapshots
     */
    getCount() {
        return this.snapshots.length;
    }

    /**
     * Clears all snapshots
     */
    clear() {
        this.snapshots = [];
    }

    /**
     * Removes expired snapshots based on current time
     * @param {number} currentTime - Current time in ms (default: performance.now())
     */
    removeExpired(currentTime = performance.now()) {
        const cutoffTime = currentTime - this.expirationTime;

        // Remove snapshots older than cutoff time, but keep at least 2 for interpolation
        while (this.snapshots.length > 2 && this.snapshots[0].time < cutoffTime) {
            this.snapshots.shift();
        }
    }

    /**
     * Gets all snapshots within a time range
     * @param {number} startTime - Start time
     * @param {number} endTime - End time
     * @returns {Array} Array of snapshots within the range
     */
    getRange(startTime, endTime) {
        return this.snapshots.filter(s => s.time >= startTime && s.time <= endTime);
    }

    /**
     * Estimates the average time delta between snapshots
     * @returns {number} Average delta in ms, or 0 if not enough data
     */
    getAverageDelta() {
        if (this.snapshots.length < 2) {
            return 0;
        }

        let totalDelta = 0;
        for (let i = 1; i < this.snapshots.length; i++) {
            totalDelta += this.snapshots[i].time - this.snapshots[i - 1].time;
        }

        return totalDelta / (this.snapshots.length - 1);
    }

    /**
     * Gets the time span covered by the buffer
     * @returns {number} Time span in ms, or 0 if empty
     */
    getTimeSpan() {
        if (this.snapshots.length < 2) {
            return 0;
        }
        return this.snapshots[this.snapshots.length - 1].time - this.snapshots[0].time;
    }

    /**
     * Checks if the buffer has enough data for interpolation
     * @param {number} minSnapshots - Minimum number of snapshots required (default: 2)
     * @returns {boolean} True if buffer has enough data
     */
    hasEnoughData(minSnapshots = 2) {
        return this.snapshots.length >= minSnapshots;
    }

    /**
     * Gets all snapshots (for debugging)
     * @returns {Array} Array of all snapshots
     */
    getAll() {
        return [...this.snapshots];
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnapshotBuffer;
}
