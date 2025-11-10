/**
 * ConnectionManager.js
 * Handles WebSocket reconnects, heartbeats, and connection state management
 */

const ConnectionState = {
    DISCONNECTED: 'disconnected',
    CONNECTING: 'connecting',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    FAILED: 'failed'
};

class ConnectionManager {
    /**
     * Creates a connection manager
     * @param {Object} options - Configuration options
     * @param {string} options.url - WebSocket URL
     * @param {number} options.heartbeatInterval - Interval between heartbeats in ms (default: 5000)
     * @param {number} options.connectionTimeout - Connection timeout in ms (default: 10000)
     * @param {number} options.reconnectDelay - Initial reconnect delay in ms (default: 1000)
     * @param {number} options.maxReconnectDelay - Max reconnect delay in ms (default: 30000)
     * @param {number} options.maxReconnectAttempts - Max reconnect attempts (default: Infinity)
     * @param {boolean} options.autoReconnect - Enable automatic reconnection (default: true)
     */
    constructor(options = {}) {
        this.url = options.url || null;
        this.heartbeatInterval = options.heartbeatInterval || 5000;
        this.connectionTimeout = options.connectionTimeout || 10000;
        this.reconnectDelay = options.reconnectDelay || 1000;
        this.maxReconnectDelay = options.maxReconnectDelay || 30000;
        this.maxReconnectAttempts = options.maxReconnectAttempts || Infinity;
        this.autoReconnect = options.autoReconnect !== undefined ? options.autoReconnect : true;

        this.ws = null;
        this.state = ConnectionState.DISCONNECTED;
        this.reconnectAttempts = 0;
        this.currentReconnectDelay = this.reconnectDelay;

        this.heartbeatTimer = null;
        this.connectionTimer = null;
        this.reconnectTimer = null;
        this.lastHeartbeatTime = 0;
        this.lastMessageTime = 0;

        // Callbacks
        this.onOpenCallback = null;
        this.onCloseCallback = null;
        this.onErrorCallback = null;
        this.onMessageCallback = null;
        this.onStateChangeCallback = null;

        // Statistics
        this.stats = {
            connectTime: 0,
            totalConnections: 0,
            totalReconnects: 0,
            totalMessagesSent: 0,
            totalMessagesReceived: 0,
            totalBytesSent: 0,
            totalBytesReceived: 0
        };
    }

    /**
     * Connects to the WebSocket server
     * @param {string} url - Optional URL (uses constructor URL if not provided)
     * @returns {Promise} Resolves when connected
     */
    connect(url = null) {
        return new Promise((resolve, reject) => {
            if (url) {
                this.url = url;
            }

            if (!this.url) {
                reject(new Error('No URL provided'));
                return;
            }

            if (this.state === ConnectionState.CONNECTED) {
                resolve();
                return;
            }

            this._setState(ConnectionState.CONNECTING);

            try {
                this.ws = new WebSocket(this.url);
                this._setupWebSocketHandlers(resolve, reject);
                this._startConnectionTimeout(reject);
            } catch (error) {
                this._setState(ConnectionState.FAILED);
                reject(error);
            }
        });
    }

    /**
     * Sets up WebSocket event handlers
     * @private
     */
    _setupWebSocketHandlers(resolve, reject) {
        this.ws.onopen = () => {
            this._clearConnectionTimeout();
            this._setState(ConnectionState.CONNECTED);
            this.stats.connectTime = Date.now();
            this.stats.totalConnections++;
            this.reconnectAttempts = 0;
            this.currentReconnectDelay = this.reconnectDelay;

            this._startHeartbeat();

            if (this.onOpenCallback) {
                this.onOpenCallback();
            }

            resolve();
        };

        this.ws.onclose = (event) => {
            this._stopHeartbeat();
            const wasConnected = this.state === ConnectionState.CONNECTED;

            if (this.state === ConnectionState.CONNECTING) {
                // Connection failed
                this._setState(ConnectionState.FAILED);
                reject(new Error('Connection failed'));
            } else {
                this._setState(ConnectionState.DISCONNECTED);
            }

            if (this.onCloseCallback) {
                this.onCloseCallback(event);
            }

            // Attempt reconnect if enabled and was connected
            if (this.autoReconnect && wasConnected) {
                this._scheduleReconnect();
            }
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);

            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
        };

        this.ws.onmessage = (event) => {
            this.lastMessageTime = Date.now();
            this.stats.totalMessagesReceived++;

            if (typeof event.data === 'string') {
                this.stats.totalBytesReceived += event.data.length;
            } else if (event.data instanceof ArrayBuffer) {
                this.stats.totalBytesReceived += event.data.byteLength;
            }

            if (this.onMessageCallback) {
                this.onMessageCallback(event.data);
            }
        };
    }

    /**
     * Starts connection timeout
     * @private
     */
    _startConnectionTimeout(reject) {
        this._clearConnectionTimeout();

        this.connectionTimer = setTimeout(() => {
            if (this.state === ConnectionState.CONNECTING) {
                this.ws.close();
                this._setState(ConnectionState.FAILED);
                reject(new Error('Connection timeout'));
            }
        }, this.connectionTimeout);
    }

    /**
     * Clears connection timeout
     * @private
     */
    _clearConnectionTimeout() {
        if (this.connectionTimer) {
            clearTimeout(this.connectionTimer);
            this.connectionTimer = null;
        }
    }

    /**
     * Starts heartbeat mechanism
     * @private
     */
    _startHeartbeat() {
        this._stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.state === ConnectionState.CONNECTED) {
                this.sendHeartbeat();

                // Check if we've received any messages recently
                const timeSinceLastMessage = Date.now() - this.lastMessageTime;
                if (timeSinceLastMessage > this.heartbeatInterval * 3) {
                    console.warn('No messages received recently, connection may be dead');
                    this.disconnect();
                }
            }
        }, this.heartbeatInterval);

        this.lastHeartbeatTime = Date.now();
        this.lastMessageTime = Date.now();
    }

    /**
     * Stops heartbeat mechanism
     * @private
     */
    _stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Sends a heartbeat/ping message
     */
    sendHeartbeat() {
        if (this.state === ConnectionState.CONNECTED) {
            this.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            this.lastHeartbeatTime = Date.now();
        }
    }

    /**
     * Schedules a reconnection attempt
     * @private
     */
    _scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('Max reconnect attempts reached');
            this._setState(ConnectionState.FAILED);
            return;
        }

        this._setState(ConnectionState.RECONNECTING);
        this.reconnectAttempts++;
        this.stats.totalReconnects++;

        console.log(`Reconnecting in ${this.currentReconnectDelay}ms (attempt ${this.reconnectAttempts})`);

        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((error) => {
                console.error('Reconnect failed:', error);
                // Exponential backoff
                this.currentReconnectDelay = Math.min(
                    this.currentReconnectDelay * 2,
                    this.maxReconnectDelay
                );
            });
        }, this.currentReconnectDelay);
    }

    /**
     * Disconnects from the server
     * @param {number} code - WebSocket close code (default: 1000)
     * @param {string} reason - Close reason
     */
    disconnect(code = 1000, reason = 'Client disconnected') {
        this.autoReconnect = false; // Disable auto-reconnect for manual disconnect

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this._stopHeartbeat();
        this._clearConnectionTimeout();

        if (this.ws && this.state !== ConnectionState.DISCONNECTED) {
            this.ws.close(code, reason);
        }

        this._setState(ConnectionState.DISCONNECTED);
    }

    /**
     * Sends data through the WebSocket
     * @param {string|ArrayBuffer} data - Data to send
     * @returns {boolean} True if sent successfully
     */
    send(data) {
        if (this.state !== ConnectionState.CONNECTED || !this.ws) {
            console.warn('Cannot send: not connected');
            return false;
        }

        try {
            this.ws.send(data);
            this.stats.totalMessagesSent++;

            if (typeof data === 'string') {
                this.stats.totalBytesSent += data.length;
            } else if (data instanceof ArrayBuffer) {
                this.stats.totalBytesSent += data.byteLength;
            }

            return true;
        } catch (error) {
            console.error('Failed to send message:', error);
            return false;
        }
    }

    /**
     * Changes the connection state
     * @private
     */
    _setState(newState) {
        if (this.state !== newState) {
            const oldState = this.state;
            this.state = newState;

            if (this.onStateChangeCallback) {
                this.onStateChangeCallback(newState, oldState);
            }
        }
    }

    /**
     * Gets the current connection state
     * @returns {string} Current state
     */
    getState() {
        return this.state;
    }

    /**
     * Checks if connected
     * @returns {boolean} True if connected
     */
    isConnected() {
        return this.state === ConnectionState.CONNECTED;
    }

    /**
     * Gets connection statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Sets callback handlers
     */
    onOpen(callback) { this.onOpenCallback = callback; }
    onClose(callback) { this.onCloseCallback = callback; }
    onError(callback) { this.onErrorCallback = callback; }
    onMessage(callback) { this.onMessageCallback = callback; }
    onStateChange(callback) { this.onStateChangeCallback = callback; }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ConnectionManager, ConnectionState };
}
