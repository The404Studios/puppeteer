/**
 * PerfMeter.js
 * Tracks FPS, ping, and packet rate for performance monitoring
 */

class PerfMeter {
    /**
     * Creates a performance meter
     * @param {Object} options - Configuration options
     * @param {number} options.sampleSize - Number of samples for averaging (default: 60)
     * @param {number} options.updateInterval - Update interval in ms (default: 500)
     */
    constructor(options = {}) {
        this.sampleSize = options.sampleSize || 60;
        this.updateInterval = options.updateInterval || 500;

        // FPS tracking
        this.frameTimes = [];
        this.lastFrameTime = performance.now();
        this.fps = 0;
        this.minFPS = Infinity;
        this.maxFPS = 0;
        this.frameCount = 0;

        // Ping tracking
        this.pingSamples = [];
        this.ping = 0;
        this.minPing = Infinity;
        this.maxPing = 0;
        this.jitter = 0;

        // Packet tracking
        this.packetsSent = 0;
        this.packetsReceived = 0;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.packetsPerSecond = { sent: 0, received: 0 };
        this.bytesPerSecond = { sent: 0, received: 0 };

        this.lastPacketCountTime = performance.now();
        this.lastPacketCounts = { sent: 0, received: 0 };
        this.lastByteCounts = { sent: 0, received: 0 };

        // Update timer
        this.updateTimer = null;
        this.onUpdateCallback = null;

        // Start automatic updates
        this._startUpdates();
    }

    /**
     * Records a frame for FPS calculation
     * Call this in your render loop
     */
    recordFrame() {
        const now = performance.now();
        const deltaTime = now - this.lastFrameTime;

        this.frameTimes.push(deltaTime);

        if (this.frameTimes.length > this.sampleSize) {
            this.frameTimes.shift();
        }

        this.lastFrameTime = now;
        this.frameCount++;

        // Calculate FPS from average frame time
        if (this.frameTimes.length > 0) {
            const avgFrameTime = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
            this.fps = 1000 / avgFrameTime;

            this.minFPS = Math.min(this.minFPS, this.fps);
            this.maxFPS = Math.max(this.maxFPS, this.fps);
        }
    }

    /**
     * Records a ping sample
     * @param {number} ping - Ping in milliseconds
     */
    recordPing(ping) {
        this.pingSamples.push(ping);

        if (this.pingSamples.length > this.sampleSize) {
            this.pingSamples.shift();
        }

        // Calculate average ping
        if (this.pingSamples.length > 0) {
            this.ping = this.pingSamples.reduce((a, b) => a + b, 0) / this.pingSamples.length;

            this.minPing = Math.min(this.minPing, ping);
            this.maxPing = Math.max(this.maxPing, ping);

            // Calculate jitter (variance in ping)
            const variance = this.pingSamples.reduce((sum, val) => {
                return sum + Math.pow(val - this.ping, 2);
            }, 0) / this.pingSamples.length;

            this.jitter = Math.sqrt(variance);
        }
    }

    /**
     * Records a sent packet
     * @param {number} bytes - Size of the packet in bytes (default: 0)
     */
    recordPacketSent(bytes = 0) {
        this.packetsSent++;
        this.bytesSent += bytes;
    }

    /**
     * Records a received packet
     * @param {number} bytes - Size of the packet in bytes (default: 0)
     */
    recordPacketReceived(bytes = 0) {
        this.packetsReceived++;
        this.bytesReceived += bytes;
    }

    /**
     * Updates packet rate statistics
     * @private
     */
    _updatePacketRates() {
        const now = performance.now();
        const elapsed = (now - this.lastPacketCountTime) / 1000; // Convert to seconds

        if (elapsed > 0) {
            // Calculate packets per second
            this.packetsPerSecond.sent = (this.packetsSent - this.lastPacketCounts.sent) / elapsed;
            this.packetsPerSecond.received = (this.packetsReceived - this.lastPacketCounts.received) / elapsed;

            // Calculate bytes per second
            this.bytesPerSecond.sent = (this.bytesSent - this.lastByteCounts.sent) / elapsed;
            this.bytesPerSecond.received = (this.bytesReceived - this.lastByteCounts.received) / elapsed;

            // Update last counts
            this.lastPacketCounts.sent = this.packetsSent;
            this.lastPacketCounts.received = this.packetsReceived;
            this.lastByteCounts.sent = this.bytesSent;
            this.lastByteCounts.received = this.bytesReceived;
            this.lastPacketCountTime = now;
        }
    }

    /**
     * Starts automatic updates
     * @private
     */
    _startUpdates() {
        this.updateTimer = setInterval(() => {
            this._updatePacketRates();

            if (this.onUpdateCallback) {
                this.onUpdateCallback(this.getStats());
            }
        }, this.updateInterval);
    }

    /**
     * Stops automatic updates
     */
    stop() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }

    /**
     * Gets current statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            fps: Math.round(this.fps),
            minFPS: Math.round(this.minFPS === Infinity ? 0 : this.minFPS),
            maxFPS: Math.round(this.maxFPS),
            frameCount: this.frameCount,

            ping: Math.round(this.ping),
            minPing: Math.round(this.minPing === Infinity ? 0 : this.minPing),
            maxPing: Math.round(this.maxPing),
            jitter: Math.round(this.jitter),

            packetsSent: this.packetsSent,
            packetsReceived: this.packetsReceived,
            packetsPerSecondSent: Math.round(this.packetsPerSecond.sent),
            packetsPerSecondReceived: Math.round(this.packetsPerSecond.received),

            bytesSent: this.bytesSent,
            bytesReceived: this.bytesReceived,
            bytesPerSecondSent: Math.round(this.bytesPerSecond.sent),
            bytesPerSecondReceived: Math.round(this.bytesPerSecond.received),

            kbPerSecondSent: (this.bytesPerSecond.sent / 1024).toFixed(2),
            kbPerSecondReceived: (this.bytesPerSecond.received / 1024).toFixed(2)
        };
    }

    /**
     * Gets a formatted statistics string
     * @returns {string} Formatted stats
     */
    getStatsString() {
        const stats = this.getStats();

        return `FPS: ${stats.fps} (${stats.minFPS}-${stats.maxFPS}) | ` +
               `Ping: ${stats.ping}ms ±${stats.jitter}ms | ` +
               `Packets: ${stats.packetsPerSecondSent}↑ ${stats.packetsPerSecondReceived}↓ | ` +
               `Data: ${stats.kbPerSecondSent}KB/s↑ ${stats.kbPerSecondReceived}KB/s↓`;
    }

    /**
     * Resets all statistics
     */
    reset() {
        this.frameTimes = [];
        this.fps = 0;
        this.minFPS = Infinity;
        this.maxFPS = 0;
        this.frameCount = 0;

        this.pingSamples = [];
        this.ping = 0;
        this.minPing = Infinity;
        this.maxPing = 0;
        this.jitter = 0;

        this.packetsSent = 0;
        this.packetsReceived = 0;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.packetsPerSecond = { sent: 0, received: 0 };
        this.bytesPerSecond = { sent: 0, received: 0 };

        this.lastPacketCounts = { sent: 0, received: 0 };
        this.lastByteCounts = { sent: 0, received: 0 };
        this.lastPacketCountTime = performance.now();
    }

    /**
     * Sets a callback for statistics updates
     * @param {Function} callback - Callback function (stats) => void
     */
    onUpdate(callback) {
        this.onUpdateCallback = callback;
    }

    /**
     * Gets average frame time in milliseconds
     * @returns {number} Average frame time
     */
    getAverageFrameTime() {
        if (this.frameTimes.length === 0) return 0;
        return this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    }

    /**
     * Gets frame time percentiles
     * @returns {Object} Percentile data
     */
    getFrameTimePercentiles() {
        if (this.frameTimes.length === 0) {
            return { p50: 0, p95: 0, p99: 0 };
        }

        const sorted = [...this.frameTimes].sort((a, b) => a - b);
        const p50Index = Math.floor(sorted.length * 0.50);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p99Index = Math.floor(sorted.length * 0.99);

        return {
            p50: sorted[p50Index],
            p95: sorted[p95Index],
            p99: sorted[p99Index]
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerfMeter;
}
