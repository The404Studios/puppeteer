/**
 * MessageRouter.js
 * Routes incoming packets to listeners or entities
 * Provides a pub/sub system for network messages
 */

class MessageRouter {
    /**
     * Creates a message router
     * @param {Object} options - Configuration options
     * @param {boolean} options.logUnhandled - Log unhandled messages (default: true)
     */
    constructor(options = {}) {
        this.handlers = new Map(); // type -> array of handlers
        this.entityHandlers = new Map(); // entityId -> Map(type -> array of handlers)
        this.wildcardHandlers = []; // Handlers that receive all messages
        this.logUnhandled = options.logUnhandled !== undefined ? options.logUnhandled : true;
        this.messageQueue = [];
        this.processing = false;
    }

    /**
     * Registers a handler for a specific message type
     * @param {string|number} type - Message type
     * @param {Function} handler - Handler function (message, metadata) => void
     * @returns {Function} Unsubscribe function
     */
    on(type, handler) {
        if (typeof handler !== 'function') {
            console.error('Handler must be a function');
            return () => {};
        }

        if (!this.handlers.has(type)) {
            this.handlers.set(type, []);
        }

        this.handlers.get(type).push(handler);

        // Return unsubscribe function
        return () => this.off(type, handler);
    }

    /**
     * Registers a one-time handler for a message type
     * @param {string|number} type - Message type
     * @param {Function} handler - Handler function
     * @returns {Function} Unsubscribe function
     */
    once(type, handler) {
        const wrappedHandler = (...args) => {
            handler(...args);
            this.off(type, wrappedHandler);
        };
        return this.on(type, wrappedHandler);
    }

    /**
     * Removes a handler for a message type
     * @param {string|number} type - Message type
     * @param {Function} handler - Handler to remove
     */
    off(type, handler) {
        if (!this.handlers.has(type)) return;

        const handlers = this.handlers.get(type);
        const index = handlers.indexOf(handler);

        if (index !== -1) {
            handlers.splice(index, 1);
        }

        // Clean up empty handler arrays
        if (handlers.length === 0) {
            this.handlers.delete(type);
        }
    }

    /**
     * Registers a handler for a specific entity and message type
     * @param {string} entityId - Entity ID
     * @param {string|number} type - Message type
     * @param {Function} handler - Handler function
     * @returns {Function} Unsubscribe function
     */
    onEntity(entityId, type, handler) {
        if (typeof handler !== 'function') {
            console.error('Handler must be a function');
            return () => {};
        }

        if (!this.entityHandlers.has(entityId)) {
            this.entityHandlers.set(entityId, new Map());
        }

        const entityMap = this.entityHandlers.get(entityId);

        if (!entityMap.has(type)) {
            entityMap.set(type, []);
        }

        entityMap.get(type).push(handler);

        // Return unsubscribe function
        return () => this.offEntity(entityId, type, handler);
    }

    /**
     * Removes an entity-specific handler
     * @param {string} entityId - Entity ID
     * @param {string|number} type - Message type
     * @param {Function} handler - Handler to remove
     */
    offEntity(entityId, type, handler) {
        if (!this.entityHandlers.has(entityId)) return;

        const entityMap = this.entityHandlers.get(entityId);
        if (!entityMap.has(type)) return;

        const handlers = entityMap.get(type);
        const index = handlers.indexOf(handler);

        if (index !== -1) {
            handlers.splice(index, 1);
        }

        // Clean up empty structures
        if (handlers.length === 0) {
            entityMap.delete(type);
        }

        if (entityMap.size === 0) {
            this.entityHandlers.delete(entityId);
        }
    }

    /**
     * Registers a wildcard handler that receives all messages
     * @param {Function} handler - Handler function
     * @returns {Function} Unsubscribe function
     */
    onAll(handler) {
        if (typeof handler !== 'function') {
            console.error('Handler must be a function');
            return () => {};
        }

        this.wildcardHandlers.push(handler);

        return () => this.offAll(handler);
    }

    /**
     * Removes a wildcard handler
     * @param {Function} handler - Handler to remove
     */
    offAll(handler) {
        const index = this.wildcardHandlers.indexOf(handler);
        if (index !== -1) {
            this.wildcardHandlers.splice(index, 1);
        }
    }

    /**
     * Routes a message to appropriate handlers
     * @param {string|number} type - Message type
     * @param {*} data - Message data
     * @param {Object} metadata - Additional metadata (entityId, timestamp, etc.)
     */
    route(type, data, metadata = {}) {
        const message = { type, data, metadata };
        let handled = false;

        // Route to wildcard handlers
        for (const handler of this.wildcardHandlers) {
            try {
                handler(message);
                handled = true;
            } catch (error) {
                console.error('Error in wildcard message handler:', error);
            }
        }

        // Route to type-specific handlers
        if (this.handlers.has(type)) {
            const handlers = this.handlers.get(type);
            for (const handler of handlers) {
                try {
                    handler(data, metadata);
                    handled = true;
                } catch (error) {
                    console.error(`Error in message handler for type ${type}:`, error);
                }
            }
        }

        // Route to entity-specific handlers
        if (metadata.entityId && this.entityHandlers.has(metadata.entityId)) {
            const entityMap = this.entityHandlers.get(metadata.entityId);
            if (entityMap.has(type)) {
                const handlers = entityMap.get(type);
                for (const handler of handlers) {
                    try {
                        handler(data, metadata);
                        handled = true;
                    } catch (error) {
                        console.error(`Error in entity handler for ${metadata.entityId}, type ${type}:`, error);
                    }
                }
            }
        }

        // Log unhandled messages if enabled
        if (!handled && this.logUnhandled) {
            console.warn(`Unhandled message type: ${type}`, data, metadata);
        }
    }

    /**
     * Queues a message for deferred processing
     * @param {string|number} type - Message type
     * @param {*} data - Message data
     * @param {Object} metadata - Additional metadata
     */
    queue(type, data, metadata = {}) {
        this.messageQueue.push({ type, data, metadata });
    }

    /**
     * Processes all queued messages
     */
    processQueue() {
        if (this.processing) {
            console.warn('Already processing message queue');
            return;
        }

        this.processing = true;

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.route(message.type, message.data, message.metadata);
        }

        this.processing = false;
    }

    /**
     * Clears all handlers
     */
    clear() {
        this.handlers.clear();
        this.entityHandlers.clear();
        this.wildcardHandlers = [];
    }

    /**
     * Clears all handlers for a specific entity
     * @param {string} entityId - Entity ID
     */
    clearEntity(entityId) {
        this.entityHandlers.delete(entityId);
    }

    /**
     * Gets the number of handlers registered for a type
     * @param {string|number} type - Message type
     * @returns {number} Number of handlers
     */
    getHandlerCount(type) {
        return this.handlers.has(type) ? this.handlers.get(type).length : 0;
    }

    /**
     * Checks if a message type has any handlers
     * @param {string|number} type - Message type
     * @returns {boolean} True if handlers exist
     */
    hasHandlers(type) {
        return this.handlers.has(type) && this.handlers.get(type).length > 0;
    }

    /**
     * Gets all registered message types
     * @returns {Array} Array of message types
     */
    getMessageTypes() {
        return Array.from(this.handlers.keys());
    }

    /**
     * Gets statistics about the router
     * @returns {Object} Router statistics
     */
    getStats() {
        let totalHandlers = this.wildcardHandlers.length;
        let entityCount = 0;

        for (const handlers of this.handlers.values()) {
            totalHandlers += handlers.length;
        }

        for (const entityMap of this.entityHandlers.values()) {
            for (const handlers of entityMap.values()) {
                totalHandlers += handlers.length;
            }
            entityCount++;
        }

        return {
            totalHandlers,
            messageTypes: this.handlers.size,
            trackedEntities: entityCount,
            wildcardHandlers: this.wildcardHandlers.length,
            queuedMessages: this.messageQueue.length
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MessageRouter;
}
