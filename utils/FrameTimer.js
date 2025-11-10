/**
 * FrameTimer.js
 * Frame-perfect timing system with drift correction
 * Ensures consistent frame intervals and eliminates sliding/lag
 */

class FrameTimer {
    /**
     * Creates a frame timer
     * @param {Object} options - Configuration options
     * @param {number} options.targetFPS - Target frames per second (default: 60)
     * @param {number} options.maxDelta - Maximum delta time in ms (default: 100)
     * @param {boolean} options.fixedTimeStep - Use fixed time step (default: false)
     * @param {boolean} options.catchUp - Catch up on missed frames (default: true)
     */
    constructor(options = {}) {
        this.targetFPS = options.targetFPS || 60;
        this.targetFrameTime = 1000 / this.targetFPS;
        this.maxDelta = options.maxDelta || 100;
        this.fixedTimeStep = options.fixedTimeStep || false;
        this.catchUp = options.catchUp !== undefined ? options.catchUp : true;

        // Timing state
        this.lastTime = 0;
        this.currentTime = 0;
        this.deltaTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.totalTime = 0;

        // Performance tracking
        this.frameTimes = new Float32Array(120); // Last 2 seconds at 60fps
        this.frameTimeIndex = 0;
        this.averageFrameTime = this.targetFrameTime;
        this.variance = 0;

        // Drift correction
        this.driftAccumulator = 0;
        this.lastDriftCorrection = 0;
        this.correctionThreshold = 16.67; // ~1 frame at 60fps

        // High-resolution timing
        this.useHighResClock = typeof performance !== 'undefined' && performance.now;
        this.startTime = this._now();
        this.lastTime = this.startTime;

        // Frame callbacks
        this.updateCallbacks = [];
        this.fixedUpdateCallbacks = [];

        // Scheduler
        this.isRunning = false;
        this.requestId = null;
    }

    /**
     * Gets current high-resolution time
     * @private
     */
    _now() {
        if (this.useHighResClock) {
            return performance.now();
        }
        return Date.now();
    }

    /**
     * Starts the timer
     * @param {Function} callback - Optional update callback
     */
    start(callback = null) {
        if (this.isRunning) return;

        if (callback) {
            this.onUpdate(callback);
        }

        this.isRunning = true;
        this.lastTime = this._now();
        this._scheduleFrame();
    }

    /**
     * Stops the timer
     */
    stop() {
        this.isRunning = false;
        if (this.requestId !== null) {
            cancelAnimationFrame(this.requestId);
            this.requestId = null;
        }
    }

    /**
     * Schedules the next frame
     * @private
     */
    _scheduleFrame() {
        if (!this.isRunning) return;

        this.requestId = requestAnimationFrame((timestamp) => {
            this._tick(timestamp);
            this._scheduleFrame();
        });
    }

    /**
     * Frame tick
     * @private
     */
    _tick(timestamp) {
        this.currentTime = this._now();
        let rawDelta = this.currentTime - this.lastTime;

        // Clamp delta to prevent spiral of death
        rawDelta = Math.min(rawDelta, this.maxDelta);

        // Apply drift correction
        rawDelta = this._correctDrift(rawDelta);

        this.deltaTime = rawDelta;
        this.lastTime = this.currentTime;

        // Track frame times
        this._trackFrameTime(rawDelta);

        if (this.fixedTimeStep) {
            // Fixed time step with accumulator
            this._tickFixed(rawDelta);
        } else {
            // Variable time step
            this._tickVariable(rawDelta);
        }

        this.frameCount++;
        this.totalTime += rawDelta;
    }

    /**
     * Fixed time step tick
     * @private
     */
    _tickFixed(rawDelta) {
        this.accumulator += rawDelta;

        let steps = 0;
        const maxSteps = this.catchUp ? 5 : 1;

        // Process fixed updates
        while (this.accumulator >= this.targetFrameTime && steps < maxSteps) {
            for (const callback of this.fixedUpdateCallbacks) {
                callback(this.targetFrameTime / 1000, this.frameCount); // Convert to seconds
            }

            this.accumulator -= this.targetFrameTime;
            steps++;
        }

        // If we couldn't catch up, drop frames
        if (this.accumulator >= this.targetFrameTime) {
            this.accumulator = this.accumulator % this.targetFrameTime;
        }

        // Interpolation factor for rendering
        const alpha = this.accumulator / this.targetFrameTime;

        // Variable update for rendering
        for (const callback of this.updateCallbacks) {
            callback(rawDelta / 1000, this.frameCount, alpha);
        }
    }

    /**
     * Variable time step tick
     * @private
     */
    _tickVariable(rawDelta) {
        for (const callback of this.updateCallbacks) {
            callback(rawDelta / 1000, this.frameCount);
        }
    }

    /**
     * Corrects clock drift
     * @private
     */
    _correctDrift(rawDelta) {
        // Calculate drift from target
        const drift = rawDelta - this.targetFrameTime;
        this.driftAccumulator += drift;

        // Apply correction if drift exceeds threshold
        if (Math.abs(this.driftAccumulator) > this.correctionThreshold) {
            const correction = Math.sign(this.driftAccumulator) *
                              Math.min(Math.abs(this.driftAccumulator), 1.0);

            this.driftAccumulator -= correction;
            this.lastDriftCorrection = this.currentTime;

            return rawDelta - correction;
        }

        return rawDelta;
    }

    /**
     * Tracks frame time statistics
     * @private
     */
    _trackFrameTime(frameTime) {
        this.frameTimes[this.frameTimeIndex] = frameTime;
        this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimes.length;

        // Calculate average and variance every 60 frames
        if (this.frameCount % 60 === 0) {
            let sum = 0;
            let validCount = 0;

            for (let i = 0; i < this.frameTimes.length; i++) {
                if (this.frameTimes[i] > 0) {
                    sum += this.frameTimes[i];
                    validCount++;
                }
            }

            if (validCount > 0) {
                this.averageFrameTime = sum / validCount;

                // Calculate variance
                let varianceSum = 0;
                for (let i = 0; i < this.frameTimes.length; i++) {
                    if (this.frameTimes[i] > 0) {
                        const diff = this.frameTimes[i] - this.averageFrameTime;
                        varianceSum += diff * diff;
                    }
                }
                this.variance = Math.sqrt(varianceSum / validCount);
            }
        }
    }

    /**
     * Registers an update callback
     * @param {Function} callback - Callback function (deltaTime, frameCount, alpha) => void
     */
    onUpdate(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        this.updateCallbacks.push(callback);
    }

    /**
     * Registers a fixed update callback (only in fixed time step mode)
     * @param {Function} callback - Callback function (deltaTime, frameCount) => void
     */
    onFixedUpdate(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }
        this.fixedUpdateCallbacks.push(callback);
    }

    /**
     * Removes an update callback
     * @param {Function} callback - Callback to remove
     */
    removeUpdate(callback) {
        const index = this.updateCallbacks.indexOf(callback);
        if (index !== -1) {
            this.updateCallbacks.splice(index, 1);
        }
    }

    /**
     * Removes a fixed update callback
     * @param {Function} callback - Callback to remove
     */
    removeFixedUpdate(callback) {
        const index = this.fixedUpdateCallbacks.indexOf(callback);
        if (index !== -1) {
            this.fixedUpdateCallbacks.splice(index, 1);
        }
    }

    /**
     * Gets current FPS
     * @returns {number} Current FPS
     */
    getFPS() {
        if (this.averageFrameTime === 0) return 0;
        return 1000 / this.averageFrameTime;
    }

    /**
     * Gets frame time statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            fps: this.getFPS(),
            targetFPS: this.targetFPS,
            averageFrameTime: this.averageFrameTime,
            variance: this.variance,
            frameCount: this.frameCount,
            totalTime: this.totalTime,
            deltaTime: this.deltaTime,
            driftAccumulator: this.driftAccumulator,
            isStable: this.variance < 2.0 // Stable if variance < 2ms
        };
    }

    /**
     * Gets current delta time in seconds
     * @returns {number} Delta time
     */
    getDelta() {
        return this.deltaTime / 1000;
    }

    /**
     * Gets elapsed time since start in seconds
     * @returns {number} Elapsed time
     */
    getElapsedTime() {
        return this.totalTime / 1000;
    }

    /**
     * Gets current frame count
     * @returns {number} Frame count
     */
    getFrameCount() {
        return this.frameCount;
    }

    /**
     * Resets the timer
     */
    reset() {
        this.lastTime = this._now();
        this.currentTime = this.lastTime;
        this.deltaTime = 0;
        this.accumulator = 0;
        this.frameCount = 0;
        this.totalTime = 0;
        this.driftAccumulator = 0;
        this.frameTimes.fill(0);
        this.frameTimeIndex = 0;
    }

    /**
     * Sets target FPS
     * @param {number} fps - Target FPS
     */
    setTargetFPS(fps) {
        this.targetFPS = fps;
        this.targetFrameTime = 1000 / fps;
    }

    /**
     * Enables/disables fixed time step
     * @param {boolean} enabled - Enable fixed time step
     */
    setFixedTimeStep(enabled) {
        this.fixedTimeStep = enabled;
        if (!enabled) {
            this.accumulator = 0;
        }
    }

    /**
     * Creates a time point marker
     * @param {string} label - Marker label
     * @returns {Object} Time marker
     */
    mark(label) {
        return {
            label,
            time: this.currentTime,
            frame: this.frameCount
        };
    }

    /**
     * Measures time between two markers
     * @param {Object} start - Start marker
     * @param {Object} end - End marker
     * @returns {Object} Measurement
     */
    measure(start, end) {
        return {
            label: `${start.label} → ${end.label}`,
            duration: end.time - start.time,
            frames: end.frame - start.frame,
            averageFrameTime: (end.time - start.time) / (end.frame - start.frame)
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrameTimer;
}
