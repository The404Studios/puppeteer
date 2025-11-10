/**
 * ReliableChannel.js
 * Ensures ordered and reliable delivery on top of WebSocket
 * Implements acknowledgments and retransmission for critical messages
 */

class ReliableChannel {
    /**
     * Creates a reliable channel
     * @param {Object} options - Configuration options
     * @param {Function} options.sendFunction - Function to send messages
     * @param {number} options.ackTimeout - Time before retransmission in ms (default: 500)
     * @param {number} options.maxRetries - Maximum retransmission attempts (default: 5)
     * @param {number} options.cleanupInterval - Interval for cleanup in ms (default: 1000)
     */
    constructor(options = {}) {
        this.sendFunction = options.sendFunction || null;
        this.ackTimeout = options.ackTimeout || 500;
        this.maxRetries = options.maxRetries || 5;
        this.cleanupInterval = options.cleanupInterval || 1000;

        this.sequence = 0;
        this.receivedSequence = 0;
        this.pendingMessages = new Map(); // sequence -> {message, sentTime, retries}
        this.receivedMessages = new Set(); // Set of received sequence numbers
        this.orderedBuffer = new Map(); // Out-of-order messages waiting for earlier sequences

        this.onMessageCallback = null;
        this.cleanupTimer = null;

        this._startCleanup();
    }

    /**
     * Sends a reliable message
     * @param {*} data - Message data
     * @returns {number} Message sequence number
     */
    send(data) {
        const sequence = this.sequence++;

        const message = {
            type: 'reliable',
            sequence,
            data,
            timestamp: performance.now()
        };

        this._sendMessage(message);
        this._trackPending(sequence, message);

        return sequence;
    }

    /**
     * Sends a message without reliability guarantees (fire-and-forget)
     * @param {*} data - Message data
     */
    sendUnreliable(data) {
        const message = {
            type: 'unreliable',
            data,
            timestamp: performance.now()
        };

        this._sendMessage(message);
    }

    /**
     * Actually sends a message using the provided send function
     * @private
     */
    _sendMessage(message) {
        if (!this.sendFunction) {
            console.error('No send function provided to ReliableChannel');
            return;
        }

        try {
            this.sendFunction(JSON.stringify(message));
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    }

    /**
     * Tracks a pending message for potential retransmission
     * @private
     */
    _trackPending(sequence, message) {
        this.pendingMessages.set(sequence, {
            message,
            sentTime: performance.now(),
            retries: 0
        });

        // Schedule retransmission check
        setTimeout(() => this._checkRetransmission(sequence), this.ackTimeout);
    }

    /**
     * Checks if a message needs retransmission
     * @private
     */
    _checkRetransmission(sequence) {
        const pending = this.pendingMessages.get(sequence);
        if (!pending) {
            // Message was acknowledged
            return;
        }

        const elapsed = performance.now() - pending.sentTime;

        if (elapsed >= this.ackTimeout) {
            if (pending.retries >= this.maxRetries) {
                console.error(`Message ${sequence} failed after ${this.maxRetries} retries`);
                this.pendingMessages.delete(sequence);
                return;
            }

            // Retransmit
            console.warn(`Retransmitting message ${sequence} (attempt ${pending.retries + 1})`);
            this._sendMessage(pending.message);
            pending.sentTime = performance.now();
            pending.retries++;

            // Schedule next check
            setTimeout(() => this._checkRetransmission(sequence), this.ackTimeout);
        }
    }

    /**
     * Handles an incoming message
     * @param {string|Object} messageData - Incoming message
     */
    handleMessage(messageData) {
        let message;

        try {
            if (typeof messageData === 'string') {
                message = JSON.parse(messageData);
            } else {
                message = messageData;
            }
        } catch (error) {
            console.error('Failed to parse message:', error);
            return;
        }

        if (message.type === 'ack') {
            this._handleAck(message);
        } else if (message.type === 'reliable') {
            this._handleReliable(message);
        } else if (message.type === 'unreliable') {
            this._handleUnreliable(message);
        }
    }

    /**
     * Handles an acknowledgment
     * @private
     */
    _handleAck(message) {
        const { sequence } = message;

        if (this.pendingMessages.has(sequence)) {
            this.pendingMessages.delete(sequence);
        }
    }

    /**
     * Handles a reliable message
     * @private
     */
    _handleReliable(message) {
        const { sequence, data } = message;

        // Send acknowledgment
        this._sendAck(sequence);

        // Check if we've already received this message
        if (this.receivedMessages.has(sequence)) {
            return; // Duplicate, ignore
        }

        this.receivedMessages.add(sequence);

        // Check if this is the next expected message
        if (sequence === this.receivedSequence) {
            // Deliver immediately
            this._deliverMessage(data);
            this.receivedSequence++;

            // Check if we can deliver buffered messages
            this._deliverBufferedMessages();
        } else if (sequence > this.receivedSequence) {
            // Out of order, buffer it
            this.orderedBuffer.set(sequence, data);
        }
        // If sequence < receivedSequence, it's an old duplicate, already handled
    }

    /**
     * Handles an unreliable message
     * @private
     */
    _handleUnreliable(message) {
        const { data } = message;
        this._deliverMessage(data);
    }

    /**
     * Sends an acknowledgment
     * @private
     */
    _sendAck(sequence) {
        this._sendMessage({
            type: 'ack',
            sequence,
            timestamp: performance.now()
        });
    }

    /**
     * Delivers buffered messages in order
     * @private
     */
    _deliverBufferedMessages() {
        while (this.orderedBuffer.has(this.receivedSequence)) {
            const data = this.orderedBuffer.get(this.receivedSequence);
            this.orderedBuffer.delete(this.receivedSequence);
            this._deliverMessage(data);
            this.receivedSequence++;
        }
    }

    /**
     * Delivers a message to the application
     * @private
     */
    _deliverMessage(data) {
        if (this.onMessageCallback) {
            this.onMessageCallback(data);
        }
    }

    /**
     * Starts periodic cleanup of old data
     * @private
     */
    _startCleanup() {
        this.cleanupTimer = setInterval(() => {
            this._cleanup();
        }, this.cleanupInterval);
    }

    /**
     * Cleans up old received message records
     * @private
     */
    _cleanup() {
        // Keep only recent sequence numbers (last 1000)
        if (this.receivedMessages.size > 1000) {
            const sorted = Array.from(this.receivedMessages).sort((a, b) => a - b);
            const toRemove = sorted.slice(0, sorted.length - 1000);
            toRemove.forEach(seq => this.receivedMessages.delete(seq));
        }

        // Clean up very old pending messages (shouldn't happen normally)
        const now = performance.now();
        for (const [seq, pending] of this.pendingMessages.entries()) {
            if (now - pending.sentTime > 30000) {
                console.warn(`Removing stale pending message ${seq}`);
                this.pendingMessages.delete(seq);
            }
        }
    }

    /**
     * Sets the message callback
     * @param {Function} callback - Callback function (data) => void
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }

    /**
     * Gets channel statistics
     * @returns {Object} Statistics object
     */
    getStats() {
        return {
            pendingMessages: this.pendingMessages.size,
            bufferedMessages: this.orderedBuffer.size,
            receivedCount: this.receivedMessages.size,
            nextSequence: this.sequence,
            nextExpectedSequence: this.receivedSequence
        };
    }

    /**
     * Resets the channel state
     */
    reset() {
        this.sequence = 0;
        this.receivedSequence = 0;
        this.pendingMessages.clear();
        this.receivedMessages.clear();
        this.orderedBuffer.clear();
    }

    /**
     * Cleans up and stops the channel
     */
    destroy() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        this.reset();
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReliableChannel;
}
