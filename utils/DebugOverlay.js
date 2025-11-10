/**
 * DebugOverlay.js
 * Optional DOM HUD with real-time metrics for debugging
 */

class DebugOverlay {
    /**
     * Creates a debug overlay
     * @param {Object} options - Configuration options
     * @param {string} options.position - Position on screen: 'top-left', 'top-right', 'bottom-left', 'bottom-right' (default: 'top-right')
     * @param {boolean} options.startVisible - Start visible (default: true)
     * @param {number} options.updateInterval - Update interval in ms (default: 250)
     * @param {string} options.theme - Theme: 'dark' or 'light' (default: 'dark')
     * @param {number} options.maxLogEntries - Max log entries to show (default: 10)
     */
    constructor(options = {}) {
        this.position = options.position || 'top-right';
        this.startVisible = options.startVisible !== undefined ? options.startVisible : true;
        this.updateInterval = options.updateInterval || 250;
        this.theme = options.theme || 'dark';
        this.maxLogEntries = options.maxLogEntries || 10;

        this.container = null;
        this.sections = {};
        this.logEntries = [];
        this.updateTimer = null;
        this.visible = this.startVisible;

        this._createOverlay();
        this._startUpdates();
    }

    /**
     * Creates the overlay DOM elements
     * @private
     */
    _createOverlay() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'puppeteer-debug-overlay';
        this.container.style.cssText = this._getContainerStyles();

        // Apply theme
        if (this.theme === 'dark') {
            this.container.style.background = 'rgba(0, 0, 0, 0.85)';
            this.container.style.color = '#ffffff';
        } else {
            this.container.style.background = 'rgba(255, 255, 255, 0.85)';
            this.container.style.color = '#000000';
        }

        // Create title
        const title = document.createElement('div');
        title.innerHTML = '<strong>🎭 Puppeteer Debug</strong>';
        title.style.cssText = 'margin-bottom: 10px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px;';
        this.container.appendChild(title);

        // Add to document
        document.body.appendChild(this.container);

        // Set initial visibility
        if (!this.visible) {
            this.hide();
        }

        // Add keyboard shortcut (Ctrl+Shift+D to toggle)
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                this.toggle();
            }
        });
    }

    /**
     * Gets container CSS styles based on position
     * @private
     */
    _getContainerStyles() {
        const baseStyles = `
            position: fixed;
            z-index: 99999;
            padding: 15px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            min-width: 300px;
            max-width: 400px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            pointer-events: auto;
        `;

        const positionStyles = {
            'top-left': 'top: 10px; left: 10px;',
            'top-right': 'top: 10px; right: 10px;',
            'bottom-left': 'bottom: 10px; left: 10px;',
            'bottom-right': 'bottom: 10px; right: 10px;'
        };

        return baseStyles + (positionStyles[this.position] || positionStyles['top-right']);
    }

    /**
     * Adds or updates a section in the overlay
     * @param {string} name - Section name
     * @param {Object|string} data - Data to display (object will be formatted)
     */
    setSection(name, data) {
        if (!this.sections[name]) {
            const section = document.createElement('div');
            section.id = `debug-section-${name}`;
            section.style.cssText = 'margin-bottom: 8px; font-size: 11px;';
            this.container.appendChild(section);
            this.sections[name] = section;
        }

        const formatted = this._formatData(name, data);
        this.sections[name].innerHTML = formatted;
    }

    /**
     * Removes a section from the overlay
     * @param {string} name - Section name
     */
    removeSection(name) {
        if (this.sections[name]) {
            this.container.removeChild(this.sections[name]);
            delete this.sections[name];
        }
    }

    /**
     * Formats data for display
     * @private
     */
    _formatData(name, data) {
        let html = `<strong>${name}:</strong><br/>`;

        if (typeof data === 'object' && data !== null) {
            for (const [key, value] of Object.entries(data)) {
                const formattedValue = typeof value === 'number' ?
                    (Number.isInteger(value) ? value : value.toFixed(2)) : value;
                html += `&nbsp;&nbsp;${key}: ${formattedValue}<br/>`;
            }
        } else {
            html += `&nbsp;&nbsp;${data}`;
        }

        return html;
    }

    /**
     * Adds a log entry
     * @param {string} message - Log message
     * @param {string} level - Log level: 'info', 'warn', 'error' (default: 'info')
     */
    log(message, level = 'info') {
        const colors = {
            info: '#4CAF50',
            warn: '#FF9800',
            error: '#F44336'
        };

        const entry = {
            message,
            level,
            timestamp: new Date().toLocaleTimeString(),
            color: colors[level] || colors.info
        };

        this.logEntries.unshift(entry);

        if (this.logEntries.length > this.maxLogEntries) {
            this.logEntries.pop();
        }

        this._updateLogSection();
    }

    /**
     * Updates the log section
     * @private
     */
    _updateLogSection() {
        if (this.logEntries.length === 0) return;

        let html = '<strong>Log:</strong><br/>';
        for (const entry of this.logEntries) {
            html += `<span style="color: ${entry.color}">[${entry.timestamp}] ${entry.message}</span><br/>`;
        }

        this.setSection('_log', html);
    }

    /**
     * Clears all log entries
     */
    clearLog() {
        this.logEntries = [];
        this.removeSection('_log');
    }

    /**
     * Updates the overlay with performance meter data
     * @param {Object} perfMeter - PerfMeter instance
     */
    updateFromPerfMeter(perfMeter) {
        if (!perfMeter) return;

        const stats = perfMeter.getStats();

        this.setSection('Performance', {
            'FPS': stats.fps,
            'Min/Max': `${stats.minFPS}/${stats.maxFPS}`,
            'Ping': `${stats.ping}ms`,
            'Jitter': `${stats.jitter}ms`
        });

        this.setSection('Network', {
            'Packets/s': `${stats.packetsPerSecondSent}↑ ${stats.packetsPerSecondReceived}↓`,
            'KB/s': `${stats.kbPerSecondSent}↑ ${stats.kbPerSecondReceived}↓`,
            'Total Packets': `${stats.packetsSent}↑ ${stats.packetsReceived}↓`
        });
    }

    /**
     * Updates the overlay with custom data
     * @param {Object} data - Object with section names as keys and data as values
     */
    update(data) {
        for (const [name, value] of Object.entries(data)) {
            this.setSection(name, value);
        }
    }

    /**
     * Starts automatic updates
     * @private
     */
    _startUpdates() {
        this.updateTimer = setInterval(() => {
            // Update timestamp
            this.setSection('Time', new Date().toLocaleTimeString());
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
     * Shows the overlay
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.visible = true;
        }
    }

    /**
     * Hides the overlay
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.visible = false;
        }
    }

    /**
     * Toggles overlay visibility
     */
    toggle() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Checks if overlay is visible
     * @returns {boolean} True if visible
     */
    isVisible() {
        return this.visible;
    }

    /**
     * Changes the overlay position
     * @param {string} position - New position
     */
    setPosition(position) {
        this.position = position;
        if (this.container) {
            const styles = this._getContainerStyles();
            this.container.style.cssText = styles;
        }
    }

    /**
     * Changes the theme
     * @param {string} theme - 'dark' or 'light'
     */
    setTheme(theme) {
        this.theme = theme;
        if (this.container) {
            if (theme === 'dark') {
                this.container.style.background = 'rgba(0, 0, 0, 0.85)';
                this.container.style.color = '#ffffff';
            } else {
                this.container.style.background = 'rgba(255, 255, 255, 0.85)';
                this.container.style.color = '#000000';
            }
        }
    }

    /**
     * Removes the overlay from the DOM
     */
    destroy() {
        this.stop();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.container = null;
        this.sections = {};
        this.logEntries = [];
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugOverlay;
}
