/**
 * NetworkManager.js
 * High-level integration of all networking modules
 * Provides a complete networking solution with prediction, reconciliation, and compression
 */

// Import dependencies
let ConnectionManager, MessageRouter, TimeSync, ReliableChannel;
let LagCompensator, AuthManager, Packet, PacketType;
let InputBuffer, Predictor, Reconciler;
let PerfMeter, NetStats, Logger, Compression;

if (typeof require !== 'undefined') {
    try {
        const connModule = require('./ConnectionManager.js');
        ConnectionManager = connModule.ConnectionManager;

        MessageRouter = require('./MessageRouter.js');
        TimeSync = require('./TimeSync.js');
        ReliableChannel = require('./ReliableChannel.js');
        LagCompensator = require('./LagCompensator.js');
        AuthManager = require('./AuthManager.js');

        const packetModule = require('./Packet.js');
        Packet = packetModule.Packet;
        PacketType = packetModule.PacketType;

        InputBuffer = require('../movement/InputBuffer.js');
        Predictor = require('../movement/Predictor.js');
        Reconciler = require('../movement/Reconciler.js');

        PerfMeter = require('../utils/PerfMeter.js');
        NetStats = require('../utils/NetStats.js');
        const loggerModule = require('../utils/Logger.js');
        Logger = loggerModule.Logger;
        Compression = require('../utils/Compression.js');
    } catch (e) {
        console.warn('Some modules not available:', e.message);
    }
}

class NetworkManager {
    /**
     * Creates a network manager
     * @param {Object} options - Configuration options
     * @param {string} options.url - WebSocket server URL
     * @param {boolean} options.isHost - Whether this is the host (default: false)
     * @param {boolean} options.enablePrediction - Enable client-side prediction (default: true)
     * @param {boolean} options.enableCompression - Enable packet compression (default: true)
     * @param {boolean} options.enableReliability - Use reliable channel (default: false)
     * @param {boolean} options.enableAuth - Enable authentication (default: false)
     * @param {boolean} options.enableDebug - Enable debug logging (default: false)
     */
    constructor(options = {}) {
        this.url = options.url || null;
        this.isHost = options.isHost || false;
        this.enablePrediction = options.enablePrediction !== undefined ? options.enablePrediction : true;
        this.enableCompression = options.enableCompression !== undefined ? options.enableCompression : true;
        this.enableReliability = options.enableReliability !== undefined ? options.enableReliability : false;
        this.enableAuth = options.enableAuth !== undefined ? options.enableAuth : false;
        this.enableDebug = options.enableDebug || false;

        // Initialize logger
        this.logger = Logger ? new Logger({
            name: 'NetworkManager',
            level: this.enableDebug ? 0 : 2 // TRACE if debug, INFO otherwise
        }) : console;

        // Initialize modules
        this.connectionManager = null;
        this.messageRouter = MessageRouter ? new MessageRouter() : null;
        this.timeSync = TimeSync ? new TimeSync() : null;
        this.reliableChannel = null;
        this.lagCompensator = LagCompensator ? new LagCompensator() : null;
        this.authManager = AuthManager ? new AuthManager() : null;

        // Prediction modules
        this.inputBuffer = InputBuffer ? new InputBuffer() : null;
        this.predictor = Predictor ? new Predictor() : null;
        this.reconciler = Reconciler ? new Reconciler({
            predictor: this.predictor,
            inputBuffer: this.inputBuffer
        }) : null;

        // Statistics
        this.perfMeter = PerfMeter ? new PerfMeter() : null;
        this.netStats = NetStats ? new NetStats() : null;

        // State
        this.connected = false;
        this.clientId = this._generateClientId();
        this.entities = new Map(); // entityId -> entity state
        this.localEntityId = null; // The entity controlled by this client

        // Callbacks
        this.onConnectedCallback = null;
        this.onDisconnectedCallback = null;
        this.onEntityUpdateCallback = null;
        this.onMessageCallback = null;

        this.logger.info('NetworkManager initialized', { clientId: this.clientId });
    }

    /**
     * Connects to the server
     * @param {string} url - Optional URL (uses constructor URL if not provided)
     * @returns {Promise} Resolves when connected
     */
    async connect(url = null) {
        if (url) {
            this.url = url;
        }

        if (!this.url) {
            throw new Error('No URL provided');
        }

        this.logger.info('Connecting to', this.url);

        // Attach auth token if enabled
        let finalUrl = this.url;
        if (this.enableAuth && this.authManager) {
            finalUrl = this.authManager.attachToWebSocketURL(this.url);
        }

        // Create connection manager
        if (ConnectionManager) {
            this.connectionManager = new ConnectionManager({
                url: finalUrl,
                autoReconnect: true
            });

            // Set up connection callbacks
            this.connectionManager.onOpen(() => this._handleConnected());
            this.connectionManager.onClose(() => this._handleDisconnected());
            this.connectionManager.onMessage((data) => this._handleMessage(data));

            await this.connectionManager.connect();
        } else {
            throw new Error('ConnectionManager not available');
        }

        // Start time sync
        if (this.timeSync) {
            this.timeSync.start((sequence, time) => {
                const ping = Packet.createPing(time);
                this.send(ping);
            });
        }

        return this;
    }

    /**
     * Disconnects from the server
     */
    disconnect() {
        this.logger.info('Disconnecting');

        if (this.timeSync) {
            this.timeSync.stop();
        }

        if (this.connectionManager) {
            this.connectionManager.disconnect();
        }

        if (this.perfMeter) {
            this.perfMeter.stop();
        }

        if (this.netStats) {
            this.netStats.stop();
        }

        this.connected = false;
    }

    /**
     * Sends a packet to the server
     * @param {Packet} packet - Packet to send
     * @param {boolean} reliable - Use reliable channel (default: false)
     */
    send(packet, reliable = false) {
        if (!this.connected) {
            this.logger.warn('Cannot send: not connected');
            return false;
        }

        let data;

        if (this.enableCompression && Compression) {
            // Send as compressed binary
            data = packet.toBinary(true);

            if (this.netStats) {
                this.netStats.recordSent(data.byteLength, PacketType[packet.type] || packet.type);
            }
        } else {
            // Send as JSON
            data = packet.toJSON();

            if (this.netStats) {
                this.netStats.recordSent(data.length, PacketType[packet.type] || packet.type);
            }
        }

        if (this.enableReliability && reliable && this.reliableChannel) {
            this.reliableChannel.send(data);
        } else {
            this.connectionManager.send(data);
        }

        this.logger.debug('Sent packet', { type: packet.type, size: data.length || data.byteLength });
        return true;
    }

    /**
     * Sends a compressed entity update
     * @param {string} entityId - Entity ID
     * @param {Object} transform - Transform data
     */
    sendEntityUpdate(entityId, transform) {
        if (this.enableCompression && Compression && Packet.createCompressedEntityUpdate) {
            // Use super-compressed format (15 bytes + entityId length)
            const compressed = Packet.createCompressedEntityUpdate(entityId, transform);

            if (this.netStats) {
                this.netStats.recordSent(compressed.byteLength, 'ENTITY_UPDATE');
            }

            this.connectionManager.send(compressed);
            this.logger.debug('Sent compressed entity update', { entityId, size: compressed.byteLength });
        } else {
            // Use standard packet
            const packet = Packet.createEntityUpdate(entityId, transform);
            this.send(packet);
        }
    }

    /**
     * Sends player input
     * @param {Object} input - Input data
     * @returns {number} Input sequence number
     */
    sendInput(input) {
        if (!this.inputBuffer) {
            this.logger.warn('Input buffer not available');
            return -1;
        }

        // Record input
        const record = this.inputBuffer.record(input);

        // Send to server
        const packet = Packet.createInput(record.sequence, input);
        this.send(packet, true); // Use reliable channel for inputs

        // Predict locally if enabled
        if (this.enablePrediction && this.predictor && this.localEntityId) {
            const localEntity = this.entities.get(this.localEntityId);
            if (localEntity) {
                const deltaTime = 0.016; // Assume 60fps
                const predicted = this.predictor.predict(input, deltaTime, localEntity.transform);

                if (predicted) {
                    localEntity.transform = predicted;

                    if (this.onEntityUpdateCallback) {
                        this.onEntityUpdateCallback(this.localEntityId, localEntity);
                    }
                }
            }
        }

        return record.sequence;
    }

    /**
     * Handles connection established
     * @private
     */
    _handleConnected() {
        this.logger.info('Connected');
        this.connected = true;

        // Set up reliable channel if enabled
        if (this.enableReliability && ReliableChannel) {
            this.reliableChannel = new ReliableChannel({
                sendFunction: (data) => this.connectionManager.send(data)
            });

            this.reliableChannel.onMessage((data) => {
                this._processMessage(data);
            });
        }

        if (this.onConnectedCallback) {
            this.onConnectedCallback();
        }
    }

    /**
     * Handles disconnection
     * @private
     */
    _handleDisconnected() {
        this.logger.info('Disconnected');
        this.connected = false;

        if (this.onDisconnectedCallback) {
            this.onDisconnectedCallback();
        }
    }

    /**
     * Handles incoming message
     * @private
     */
    _handleMessage(data) {
        if (this.netStats) {
            const size = typeof data === 'string' ? data.length : data.byteLength;
            this.netStats.recordReceived(size);
        }

        // If using reliable channel, route through it
        if (this.enableReliability && this.reliableChannel) {
            this.reliableChannel.handleMessage(data);
        } else {
            this._processMessage(data);
        }
    }

    /**
     * Processes a message
     * @private
     */
    _processMessage(data) {
        let packet;

        // Try to parse as binary first, then JSON
        if (data instanceof ArrayBuffer) {
            packet = Packet.fromBinary(data);
        } else if (typeof data === 'string') {
            packet = Packet.fromJSON(data);
        }

        if (!packet) {
            this.logger.error('Failed to parse packet');
            return;
        }

        this.logger.debug('Received packet', { type: packet.type });

        // Handle system packets
        switch (packet.type) {
            case PacketType.PONG:
                if (this.timeSync) {
                    this.timeSync.handlePong(
                        packet.data.sequence || 0,
                        packet.data.serverTime,
                        packet.timestamp
                    );

                    if (this.perfMeter) {
                        this.perfMeter.recordPing(this.timeSync.getLatency());
                    }
                }
                break;

            case PacketType.ENTITY_UPDATE:
                this._handleEntityUpdate(packet.data);
                break;

            case PacketType.STATE_UPDATE:
                this._handleStateUpdate(packet.data);
                break;

            default:
                // Route to message router
                if (this.messageRouter) {
                    this.messageRouter.route(packet.type, packet.data, {
                        timestamp: packet.timestamp
                    });
                }

                // Callback
                if (this.onMessageCallback) {
                    this.onMessageCallback(packet);
                }
                break;
        }
    }

    /**
     * Handles entity update
     * @private
     */
    _handleEntityUpdate(data) {
        const { entityId, position, rotation, scale, metadata } = data;

        const transform = { position, rotation, scale: scale || { x: 1, y: 1, z: 1 } };

        // Store entity
        if (!this.entities.has(entityId)) {
            this.entities.set(entityId, { transform, metadata: metadata || {} });
        } else {
            const entity = this.entities.get(entityId);
            entity.transform = transform;
            if (metadata) {
                entity.metadata = { ...entity.metadata, ...metadata };
            }
        }

        // If this is the local entity, reconcile with prediction
        if (this.enablePrediction && entityId === this.localEntityId && this.reconciler) {
            const localEntity = this.entities.get(entityId);
            const reconciled = this.reconciler.reconcile(
                localEntity.transform,
                transform,
                data.lastProcessedInput || 0
            );

            localEntity.transform = reconciled;
        }

        // Apply lag compensation if needed
        if (this.lagCompensator && entityId !== this.localEntityId) {
            const entity = this.entities.get(entityId);
            const corrected = this.lagCompensator.getCorrectedTransform(
                entityId,
                entity.transform,
                performance.now()
            );
            entity.transform = corrected;
        }

        if (this.onEntityUpdateCallback) {
            this.onEntityUpdateCallback(entityId, this.entities.get(entityId));
        }
    }

    /**
     * Handles state update from server
     * @private
     */
    _handleStateUpdate(data) {
        const { entityId, transform, sequence, timestamp } = data;

        if (this.enablePrediction && entityId === this.localEntityId && this.reconciler) {
            const localEntity = this.entities.get(entityId);
            const reconciled = this.reconciler.fullReconciliation(
                transform,
                sequence,
                timestamp
            );

            if (localEntity) {
                localEntity.transform = reconciled;
            }
        }
    }

    /**
     * Registers an entity
     * @param {string} entityId - Entity ID
     * @param {Object} initialTransform - Initial transform
     * @param {boolean} isLocal - Whether this is the local entity
     */
    registerEntity(entityId, initialTransform, isLocal = false) {
        this.entities.set(entityId, {
            transform: initialTransform,
            metadata: {}
        });

        if (isLocal) {
            this.localEntityId = entityId;
            this.logger.info('Registered local entity', { entityId });
        }

        this.logger.debug('Registered entity', { entityId, isLocal });
    }

    /**
     * Gets an entity
     * @param {string} entityId - Entity ID
     * @returns {Object|null} Entity or null
     */
    getEntity(entityId) {
        return this.entities.get(entityId) || null;
    }

    /**
     * Registers a message handler
     * @param {number} type - Message type
     * @param {Function} handler - Handler function
     * @returns {Function} Unsubscribe function
     */
    on(type, handler) {
        if (this.messageRouter) {
            return this.messageRouter.on(type, handler);
        }
        return () => {};
    }

    /**
     * Records a frame (for FPS tracking)
     */
    recordFrame() {
        if (this.perfMeter) {
            this.perfMeter.recordFrame();
        }
    }

    /**
     * Gets statistics
     * @returns {Object} Statistics
     */
    getStats() {
        return {
            connected: this.connected,
            clientId: this.clientId,
            entities: this.entities.size,
            performance: this.perfMeter ? this.perfMeter.getStats() : null,
            network: this.netStats ? this.netStats.getStats() : null,
            timeSync: this.timeSync ? this.timeSync.getStats() : null,
            prediction: this.reconciler ? this.reconciler.getStats() : null,
            lagCompensation: this.lagCompensator ? this.lagCompensator.getStats() : null
        };
    }

    /**
     * Generates a client ID
     * @private
     */
    _generateClientId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback
        return 'client_' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Sets callbacks
     */
    onConnected(callback) { this.onConnectedCallback = callback; }
    onDisconnected(callback) { this.onDisconnectedCallback = callback; }
    onEntityUpdate(callback) { this.onEntityUpdateCallback = callback; }
    onMessage(callback) { this.onMessageCallback = callback; }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkManager;
}
