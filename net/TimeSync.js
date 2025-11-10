/**
 * TimeSync.js
 * Ping/pong latency estimation & clock offset synchronization
 * Implements a simple NTP-like protocol for client-server time sync
 */

class TimeSync {
    /**
     * Creates a time synchronization manager
     * @param {Object} options - Configuration options
     * @param {number} options.pingInterval - Interval between pings in ms (default: 1000)
     * @param {number} options.maxSamples - Maximum samples to keep (default: 20)
     * @param {number} options.smoothingFactor - Smoothing factor for offset (default: 0.8)
     */
    constructor(options = {}) {
        this.pingInterval = options.pingInterval || 1000;
        this.maxSamples = options.maxSamples || 20;
        this.smoothingFactor = options.smoothingFactor || 0.8;

        this.latencySamples = [];
        this.offsetSamples = [];
        this.currentLatency = 0;
        this.currentOffset = 0;
        this.minLatency = Infinity;
        this.maxLatency = 0;
        this.jitter = 0;

        this.pingSequence = 0;
        this.pendingPings = new Map(); // sequence -> sentTime
        this.lastPingTime = 0;
        this.pingTimer = null;
        this.running = false;

        this.onPingCallback = null;
        this.onSyncCallback = null;
    }

    /**
     * Starts the time synchronization
     * @param {Function} onPing - Callback to send ping (sequence) => void
     */
    start(onPing) {
        if (this.running) {
            console.warn('TimeSync already running');
            return;
        }

        this.onPingCallback = onPing;
        this.running = true;
        this._schedulePing();
    }

    /**
     * Stops the time synchronization
     */
    stop() {
        this.running = false;
        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
            this.pingTimer = null;
        }
        this.pendingPings.clear();
    }

    /**
     * Schedules the next ping
     * @private
     */
    _schedulePing() {
        if (!this.running) return;

        this.pingTimer = setTimeout(() => {
            this.sendPing();
            this._schedulePing();
        }, this.pingInterval);
    }

    /**
     * Sends a ping request
     */
    sendPing() {
        const sequence = this.pingSequence++;
        const sentTime = performance.now();

        this.pendingPings.set(sequence, sentTime);
        this.lastPingTime = sentTime;

        // Clean up old pending pings (older than 10 seconds)
        const cutoff = sentTime - 10000;
        for (const [seq, time] of this.pendingPings.entries()) {
            if (time < cutoff) {
                this.pendingPings.delete(seq);
            }
        }

        if (this.onPingCallback) {
            this.onPingCallback(sequence, sentTime);
        }
    }

    /**
     * Handles a pong response from the server
     * @param {number} sequence - Ping sequence number
     * @param {number} serverTime - Server timestamp
     * @param {number} receivedTime - Time pong was received (default: now)
     */
    handlePong(sequence, serverTime, receivedTime = performance.now()) {
        if (!this.pendingPings.has(sequence)) {
            console.warn('Received pong for unknown sequence:', sequence);
            return;
        }

        const sentTime = this.pendingPings.get(sequence);
        this.pendingPings.delete(sequence);

        // Calculate round-trip time (latency)
        const rtt = receivedTime - sentTime;

        // Estimate one-way latency (half of RTT)
        const latency = rtt / 2;

        // Calculate clock offset
        // offset = serverTime - clientTime (at the midpoint)
        const clientMidpoint = sentTime + latency;
        const offset = serverTime - clientMidpoint;

        // Add samples
        this._addLatencySample(latency);
        this._addOffsetSample(offset);

        // Update statistics
        this._updateStats();

        // Trigger sync callback
        if (this.onSyncCallback) {
            this.onSyncCallback({
                latency: this.currentLatency,
                offset: this.currentOffset,
                jitter: this.jitter
            });
        }
    }

    /**
     * Adds a latency sample
     * @private
     */
    _addLatencySample(latency) {
        this.latencySamples.push(latency);

        if (this.latencySamples.length > this.maxSamples) {
            this.latencySamples.shift();
        }

        // Update min/max
        this.minLatency = Math.min(this.minLatency, latency);
        this.maxLatency = Math.max(this.maxLatency, latency);
    }

    /**
     * Adds an offset sample
     * @private
     */
    _addOffsetSample(offset) {
        this.offsetSamples.push(offset);

        if (this.offsetSamples.length > this.maxSamples) {
            this.offsetSamples.shift();
        }
    }

    /**
     * Updates current statistics
     * @private
     */
    _updateStats() {
        if (this.latencySamples.length === 0) return;

        // Use median for latency (more robust than mean)
        const sortedLatencies = [...this.latencySamples].sort((a, b) => a - b);
        const medianIndex = Math.floor(sortedLatencies.length / 2);
        const newLatency = sortedLatencies[medianIndex];

        // Smooth the latency
        this.currentLatency = this.smoothingFactor * this.currentLatency +
                              (1 - this.smoothingFactor) * newLatency;

        // Calculate jitter (variance in latency)
        const mean = this.latencySamples.reduce((a, b) => a + b, 0) / this.latencySamples.length;
        const variance = this.latencySamples.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / this.latencySamples.length;
        this.jitter = Math.sqrt(variance);

        // Use median for offset
        const sortedOffsets = [...this.offsetSamples].sort((a, b) => a - b);
        const offsetMedianIndex = Math.floor(sortedOffsets.length / 2);
        const newOffset = sortedOffsets[offsetMedianIndex];

        // Smooth the offset
        this.currentOffset = this.smoothingFactor * this.currentOffset +
                             (1 - this.smoothingFactor) * newOffset;
    }

    /**
     * Gets the current latency estimate
     * @returns {number} Latency in ms
     */
    getLatency() {
        return this.currentLatency;
    }

    /**
     * Gets the current clock offset
     * @returns {number} Offset in ms
     */
    getOffset() {
        return this.currentOffset;
    }

    /**
     * Gets the current network jitter
     * @returns {number} Jitter in ms
     */
    getJitter() {
        return this.jitter;
    }

    /**
     * Converts local time to server time
     * @param {number} localTime - Local timestamp
     * @returns {number} Estimated server timestamp
     */
    localToServerTime(localTime) {
        return localTime + this.currentOffset;
    }

    /**
     * Converts server time to local time
     * @param {number} serverTime - Server timestamp
     * @returns {number} Estimated local timestamp
     */
    serverToLocalTime(serverTime) {
        return serverTime - this.currentOffset;
    }

    /**
     * Gets current server time estimate
     * @returns {number} Estimated server timestamp
     */
    getServerTime() {
        return this.localToServerTime(performance.now());
    }

    /**
     * Gets time sync statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            latency: this.currentLatency,
            minLatency: this.minLatency,
            maxLatency: this.maxLatency,
            jitter: this.jitter,
            offset: this.currentOffset,
            samples: this.latencySamples.length,
            pendingPings: this.pendingPings.size
        };
    }

    /**
     * Resets all statistics
     */
    reset() {
        this.latencySamples = [];
        this.offsetSamples = [];
        this.currentLatency = 0;
        this.currentOffset = 0;
        this.minLatency = Infinity;
        this.maxLatency = 0;
        this.jitter = 0;
        this.pendingPings.clear();
    }

    /**
     * Sets a callback for sync updates
     * @param {Function} callback - Callback function (stats) => void
     */
    onSync(callback) {
        this.onSyncCallback = callback;
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimeSync;
}
