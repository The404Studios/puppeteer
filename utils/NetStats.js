/**
 * NetStats.js
 * Logs and tracks network statistics (bytes sent/received, packet loss, etc.)
 */

class NetStats {
    /**
     * Creates a network statistics tracker
     * @param {Object} options - Configuration options
     * @param {number} options.historySize - Number of history samples to keep (default: 100)
     * @param {number} options.sampleInterval - Interval between samples in ms (default: 1000)
     */
    constructor(options = {}) {
        this.historySize = options.historySize || 100;
        this.sampleInterval = options.sampleInterval || 1000;

        // Raw counters
        this.totalBytesSent = 0;
        this.totalBytesReceived = 0;
        this.totalPacketsSent = 0;
        this.totalPacketsReceived = 0;
        this.totalPacketsLost = 0;

        // Message type tracking
        this.messageTypes = new Map(); // type -> { sent: count, received: count, bytes: count }

        // Historical data
        this.history = {
            bytesSent: [],
            bytesReceived: [],
            packetsSent: [],
            packetsReceived: [],
            packetsLost: [],
            timestamps: []
        };

        // Rate tracking
        this.lastSampleTime = performance.now();
        this.lastSampleCounts = {
            bytesSent: 0,
            bytesReceived: 0,
            packetsSent: 0,
            packetsReceived: 0
        };

        this.currentRates = {
            bytesSent: 0,
            bytesReceived: 0,
            packetsSent: 0,
            packetsReceived: 0
        };

        // Connection quality metrics
        this.latencySamples = [];
        this.maxLatencySamples = 50;

        // Sampling timer
        this.sampleTimer = null;
        this._startSampling();
    }

    /**
     * Records a sent packet
     * @param {number} bytes - Packet size in bytes
     * @param {string} type - Optional message type
     */
    recordSent(bytes, type = null) {
        this.totalBytesSent += bytes;
        this.totalPacketsSent++;

        if (type) {
            this._trackMessageType(type, 'sent', bytes);
        }
    }

    /**
     * Records a received packet
     * @param {number} bytes - Packet size in bytes
     * @param {string} type - Optional message type
     */
    recordReceived(bytes, type = null) {
        this.totalBytesReceived += bytes;
        this.totalPacketsReceived++;

        if (type) {
            this._trackMessageType(type, 'received', bytes);
        }
    }

    /**
     * Records a lost packet
     */
    recordLost() {
        this.totalPacketsLost++;
    }

    /**
     * Records a latency sample
     * @param {number} latency - Latency in milliseconds
     */
    recordLatency(latency) {
        this.latencySamples.push(latency);

        if (this.latencySamples.length > this.maxLatencySamples) {
            this.latencySamples.shift();
        }
    }

    /**
     * Tracks message type statistics
     * @private
     */
    _trackMessageType(type, direction, bytes) {
        if (!this.messageTypes.has(type)) {
            this.messageTypes.set(type, { sent: 0, received: 0, bytes: 0 });
        }

        const stats = this.messageTypes.get(type);

        if (direction === 'sent') {
            stats.sent++;
        } else if (direction === 'received') {
            stats.received++;
        }

        stats.bytes += bytes;
    }

    /**
     * Takes a sample of current statistics
     * @private
     */
    _takeSample() {
        const now = performance.now();
        const elapsed = (now - this.lastSampleTime) / 1000; // Convert to seconds

        if (elapsed > 0) {
            // Calculate rates
            this.currentRates.bytesSent = (this.totalBytesSent - this.lastSampleCounts.bytesSent) / elapsed;
            this.currentRates.bytesReceived = (this.totalBytesReceived - this.lastSampleCounts.bytesReceived) / elapsed;
            this.currentRates.packetsSent = (this.totalPacketsSent - this.lastSampleCounts.packetsSent) / elapsed;
            this.currentRates.packetsReceived = (this.totalPacketsReceived - this.lastSampleCounts.packetsReceived) / elapsed;

            // Add to history
            this.history.bytesSent.push(this.currentRates.bytesSent);
            this.history.bytesReceived.push(this.currentRates.bytesReceived);
            this.history.packetsSent.push(this.currentRates.packetsSent);
            this.history.packetsReceived.push(this.currentRates.packetsReceived);
            this.history.timestamps.push(now);

            // Trim history
            if (this.history.bytesSent.length > this.historySize) {
                this.history.bytesSent.shift();
                this.history.bytesReceived.shift();
                this.history.packetsSent.shift();
                this.history.packetsReceived.shift();
                this.history.timestamps.shift();
            }

            // Update last sample counts
            this.lastSampleCounts.bytesSent = this.totalBytesSent;
            this.lastSampleCounts.bytesReceived = this.totalBytesReceived;
            this.lastSampleCounts.packetsSent = this.totalPacketsSent;
            this.lastSampleCounts.packetsReceived = this.totalPacketsReceived;
            this.lastSampleTime = now;
        }
    }

    /**
     * Starts periodic sampling
     * @private
     */
    _startSampling() {
        this.sampleTimer = setInterval(() => {
            this._takeSample();
        }, this.sampleInterval);
    }

    /**
     * Stops periodic sampling
     */
    stop() {
        if (this.sampleTimer) {
            clearInterval(this.sampleTimer);
            this.sampleTimer = null;
        }
    }

    /**
     * Gets current statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            // Totals
            totalBytesSent: this.totalBytesSent,
            totalBytesReceived: this.totalBytesReceived,
            totalPacketsSent: this.totalPacketsSent,
            totalPacketsReceived: this.totalPacketsReceived,
            totalPacketsLost: this.totalPacketsLost,

            // Rates (per second)
            bytesSentPerSecond: Math.round(this.currentRates.bytesSent),
            bytesReceivedPerSecond: Math.round(this.currentRates.bytesReceived),
            packetsSentPerSecond: Math.round(this.currentRates.packetsSent),
            packetsReceivedPerSecond: Math.round(this.currentRates.packetsReceived),

            // Formatted rates
            kbSentPerSecond: (this.currentRates.bytesSent / 1024).toFixed(2),
            kbReceivedPerSecond: (this.currentRates.bytesReceived / 1024).toFixed(2),

            // Packet loss
            packetLossRate: this._calculatePacketLossRate(),

            // Latency
            averageLatency: this._calculateAverageLatency(),
            minLatency: this._getMinLatency(),
            maxLatency: this._getMaxLatency()
        };
    }

    /**
     * Gets statistics for a specific message type
     * @param {string} type - Message type
     * @returns {Object|null} Statistics or null
     */
    getMessageTypeStats(type) {
        return this.messageTypes.get(type) || null;
    }

    /**
     * Gets all message type statistics
     * @returns {Object} Map of type to statistics
     */
    getAllMessageTypeStats() {
        const result = {};
        for (const [type, stats] of this.messageTypes.entries()) {
            result[type] = { ...stats };
        }
        return result;
    }

    /**
     * Gets historical data
     * @returns {Object} Historical data
     */
    getHistory() {
        return {
            bytesSent: [...this.history.bytesSent],
            bytesReceived: [...this.history.bytesReceived],
            packetsSent: [...this.history.packetsSent],
            packetsReceived: [...this.history.packetsReceived],
            timestamps: [...this.history.timestamps]
        };
    }

    /**
     * Calculates packet loss rate
     * @private
     */
    _calculatePacketLossRate() {
        const totalPackets = this.totalPacketsSent + this.totalPacketsLost;
        if (totalPackets === 0) return 0;
        return ((this.totalPacketsLost / totalPackets) * 100).toFixed(2);
    }

    /**
     * Calculates average latency
     * @private
     */
    _calculateAverageLatency() {
        if (this.latencySamples.length === 0) return 0;
        const sum = this.latencySamples.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.latencySamples.length);
    }

    /**
     * Gets minimum latency
     * @private
     */
    _getMinLatency() {
        if (this.latencySamples.length === 0) return 0;
        return Math.round(Math.min(...this.latencySamples));
    }

    /**
     * Gets maximum latency
     * @private
     */
    _getMaxLatency() {
        if (this.latencySamples.length === 0) return 0;
        return Math.round(Math.max(...this.latencySamples));
    }

    /**
     * Gets average bandwidth usage
     * @returns {Object} Average bandwidth
     */
    getAverageBandwidth() {
        if (this.history.bytesSent.length === 0) {
            return { sent: 0, received: 0 };
        }

        const avgSent = this.history.bytesSent.reduce((a, b) => a + b, 0) / this.history.bytesSent.length;
        const avgReceived = this.history.bytesReceived.reduce((a, b) => a + b, 0) / this.history.bytesReceived.length;

        return {
            sent: Math.round(avgSent),
            received: Math.round(avgReceived),
            sentKB: (avgSent / 1024).toFixed(2),
            receivedKB: (avgReceived / 1024).toFixed(2)
        };
    }

    /**
     * Gets peak bandwidth usage
     * @returns {Object} Peak bandwidth
     */
    getPeakBandwidth() {
        if (this.history.bytesSent.length === 0) {
            return { sent: 0, received: 0 };
        }

        const peakSent = Math.max(...this.history.bytesSent);
        const peakReceived = Math.max(...this.history.bytesReceived);

        return {
            sent: Math.round(peakSent),
            received: Math.round(peakReceived),
            sentKB: (peakSent / 1024).toFixed(2),
            receivedKB: (peakReceived / 1024).toFixed(2)
        };
    }

    /**
     * Exports statistics as JSON
     * @returns {string} JSON string
     */
    exportJSON() {
        return JSON.stringify({
            stats: this.getStats(),
            messageTypes: this.getAllMessageTypeStats(),
            history: this.getHistory(),
            averageBandwidth: this.getAverageBandwidth(),
            peakBandwidth: this.getPeakBandwidth()
        }, null, 2);
    }

    /**
     * Resets all statistics
     */
    reset() {
        this.totalBytesSent = 0;
        this.totalBytesReceived = 0;
        this.totalPacketsSent = 0;
        this.totalPacketsReceived = 0;
        this.totalPacketsLost = 0;

        this.messageTypes.clear();

        this.history.bytesSent = [];
        this.history.bytesReceived = [];
        this.history.packetsSent = [];
        this.history.packetsReceived = [];
        this.history.timestamps = [];

        this.latencySamples = [];

        this.lastSampleCounts = {
            bytesSent: 0,
            bytesReceived: 0,
            packetsSent: 0,
            packetsReceived: 0
        };

        this.currentRates = {
            bytesSent: 0,
            bytesReceived: 0,
            packetsSent: 0,
            packetsReceived: 0
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetStats;
}
