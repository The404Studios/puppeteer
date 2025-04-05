// === puppeteer/net/RealTimeSync.js ===
import { now } from '../utils/Clock.js';
import { generateUUID } from '../utils/UUID.js';
import Vector3 from '../core/Vector3.js';
import Quaternion from '../core/Quaternion.js';
import Transform from '../core/Transform.js';
import Snapshot from '../core/Snapshot.js';
import { Interpolator } from '../interp/Interpolator.js';
import EventEmitter from '../utils/EventEmitter.js';
import { log } from '../utils/Logger.js';

/**
 * EntityState represents a networked entity's state at a point in time
 */
export class EntityState {
  constructor(entityId, transform, timestamp = now(), metadata = {}) {
    this.entityId = entityId;
    this.transform = transform;
    this.timestamp = timestamp;
    this.metadata = metadata;
    this.authoritative = metadata.authoritative || false;
  }
  
  serialize() {
    return {
      entityId: this.entityId,
      transform: this.transform.serialize(),
      timestamp: this.timestamp,
      metadata: this.metadata,
      authoritative: this.authoritative
    };
  }
  
  static deserialize(data) {
    return new EntityState(
      data.entityId,
      Transform.deserialize(data.transform),
      data.timestamp,
      data.metadata
    );
  }
}

/**
 * RoomSyncManager handles state synchronization between clients
 */
export class RoomSyncManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      storageKey: 'puppeteer_room_state',
      updateRate: 20, // ms between updates
      cleanupInterval: 10000, // ms between cleanup operations
      entityTTL: 60000, // ms until entity is considered stale and removed
      ...options
    };
    
    this.roomId = options.roomId || null;
    this.clientId = options.clientId || generateUUID();
    this.isHost = options.isHost || false;
    
    this.entities = new Map(); // Map of entity ID to entity state
    this.interpolators = new Map(); // Map of entity ID to interpolator
    this.ownedEntities = new Set(); // Set of entity IDs owned by this client
    
    this.storage = options.useLocalStorage ? window.localStorage : null;
    this.lastUpdateTime = 0;
    this.lastCleanupTime = 0;
    
    // Start update loop
    this._updateIntervalId = setInterval(() => this._update(), this.options.updateRate);
  }
  
  /**
   * Setup a room connection
   * @param {string} roomId - Room identifier
   * @param {boolean} asHost - Whether this client is the host
   */
  setupRoom(roomId, asHost = false) {
    this.roomId = roomId;
    this.isHost = asHost;
    
    // Clear existing state
    this.entities.clear();
    this.interpolators.clear();
    
    // Load existing state from storage if available
    this._loadStateFromStorage();
    
    // Notify about room setup
    this.emit('roomSetup', { roomId, isHost: this.isHost });
    
    return this;
  }
  
  /**
   * Register an entity to be synchronized
   * @param {string} entityId - Entity identifier
   * @param {Transform} transform - Initial entity transform
   * @param {Object} metadata - Additional entity metadata
   * @param {boolean} owned - Whether this entity is owned/controlled by this client
   */
  registerEntity(entityId, transform, metadata = {}, owned = true) {
    const entity = new EntityState(
      entityId,
      transform,
      now(),
      { ...metadata, ownerId: owned ? this.clientId : null }
    );
    
    this.entities.set(entityId, entity);
    
    // Setup interpolator for this entity
    if (!this.interpolators.has(entityId)) {
      this.interpolators.set(entityId, new Interpolator());
    }
    
    // Add initial snapshot
    const interpolator = this.interpolators.get(entityId);
    interpolator.addSnapshot(entityId, new Snapshot(transform, entity.timestamp, { entityId, ...metadata }));
    
    // Mark as owned if specified
    if (owned) {
      this.ownedEntities.add(entityId);
    }
    
    // Notify about entity registration
    this.emit('entityRegistered', { entityId, owned, entity });
    
    return this;
  }
  
  /**
   * Update an entity's transform
   * @param {string} entityId - Entity identifier
   * @param {Transform} transform - New entity transform
   * @param {Object} metadata - Additional update metadata
   */
  updateEntity(entityId, transform, metadata = {}) {
    if (!this.entities.has(entityId)) {
      return false;
    }
    
    const timestamp = now();
    const entity = this.entities.get(entityId);
    
    // Update entity
    entity.transform = transform;
    entity.timestamp = timestamp;
    entity.metadata = { ...entity.metadata, ...metadata };
    
    // Add snapshot for interpolation
    if (this.interpolators.has(entityId)) {
      const interpolator = this.interpolators.get(entityId);
      interpolator.addSnapshot(entityId, new Snapshot(transform, timestamp, { entityId, ...metadata }));
    }
    
    // Serialize and store if this is a locally owned entity
    if (this.ownedEntities.has(entityId)) {
      this._saveEntityToStorage(entity);
      
      // Notify about entity update
      this.emit('entityUpdated', { entityId, entity, owned: true });
    }
    
    return true;
  }
  
  /**
   * Apply network update from another client
   * @param {Object} data - Serialized entity state
   */
  applyNetworkUpdate(data) {
    const entityState = EntityState.deserialize(data);
    const entityId = entityState.entityId;
    
    // Skip if we own this entity
    if (this.ownedEntities.has(entityId)) {
      return false;
    }
    
    // Update or create entity
    if (this.entities.has(entityId)) {
      const existing = this.entities.get(entityId);
      
      // Check if update is newer
      if (entityState.timestamp > existing.timestamp) {
        this.entities.set(entityId, entityState);
      } else {
        return false; // Skip outdated update
      }
    } else {
      this.entities.set(entityId, entityState);
      
      // Setup interpolator for new entity
      if (!this.interpolators.has(entityId)) {
        this.interpolators.set(entityId, new Interpolator());
      }
    }
    
    // Add snapshot for interpolation
    if (this.interpolators.has(entityId)) {
      const interpolator = this.interpolators.get(entityId);
      interpolator.addSnapshot(
        entityId,
        new Snapshot(entityState.transform, entityState.timestamp, { entityId, ...entityState.metadata })
      );
    }
    
    // Save to storage
    this._saveEntityToStorage(entityState);
    
    // Notify about network update
    this.emit('networkUpdate', { entityId, entity: entityState });
    
    return true;
  }
  
  /**
   * Get the latest state of an entity
   * @param {string} entityId - Entity identifier
   * @returns {EntityState|null} - Latest entity state or null if not found
   */
  getEntityState(entityId) {
    return this.entities.get(entityId) || null;
  }
  
  /**
   * Get interpolated transform for an entity at a specific time
   * @param {string} entityId - Entity identifier
   * @param {number} time - Timestamp to get transform at (default: current time - delay)
   * @returns {Transform|null} - Interpolated transform or null if not available
   */
  getInterpolatedTransform(entityId, time = null) {
    if (!this.interpolators.has(entityId)) {
      return null;
    }
    
    const interpolator = this.interpolators.get(entityId);
    return interpolator.getInterpolatedTransform(entityId, time);
  }
  
  /**
   * Take ownership of an entity
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether ownership was successfully taken
   */
  takeOwnership(entityId) {
    if (!this.entities.has(entityId)) {
      return false;
    }
    
    const entity = this.entities.get(entityId);
    entity.metadata.ownerId = this.clientId;
    entity.timestamp = now();
    
    this.ownedEntities.add(entityId);
    
    // Notify about ownership change
    this.emit('ownershipChanged', { entityId, ownerId: this.clientId });
    
    return true;
  }
  
  /**
   * Release ownership of an entity
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether ownership was successfully released
   */
  releaseOwnership(entityId) {
    if (!this.ownedEntities.has(entityId)) {
      return false;
    }
    
    this.ownedEntities.delete(entityId);
    
    if (this.entities.has(entityId)) {
      const entity = this.entities.get(entityId);
      entity.metadata.ownerId = null;
      entity.timestamp = now();
      
      // Notify about ownership change
      this.emit('ownershipChanged', { entityId, ownerId: null });
    }
    
    return true;
  }
  
  /**
   * Check if an entity is owned by this client
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether this client owns the entity
   */
  isOwnedByMe(entityId) {
    return this.ownedEntities.has(entityId);
  }
  
  /**
   * Get all entities in the room
   * @returns {Array<EntityState>} - Array of entity states
   */
  getAllEntities() {
    return Array.from(this.entities.values());
  }
  
  /**
   * Get all entity IDs
   * @returns {Array<string>} - Array of entity IDs
   */
  getAllEntityIds() {
    return Array.from(this.entities.keys());
  }
  
  /**
   * Get entities owned by this client
   * @returns {Array<EntityState>} - Array of owned entity states
   */
  getOwnedEntities() {
    return Array.from(this.ownedEntities)
      .map(id => this.entities.get(id))
      .filter(Boolean);
  }
  
  /**
   * Remove an entity from synchronization
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether the entity was successfully removed
   */
  removeEntity(entityId) {
    if (!this.entities.has(entityId)) {
      return false;
    }
    
    this.entities.delete(entityId);
    this.ownedEntities.delete(entityId);
    
    if (this.interpolators.has(entityId)) {
      this.interpolators.delete(entityId);
    }
    
    // Remove from storage
    this._removeEntityFromStorage(entityId);
    
    // Notify about entity removal
    this.emit('entityRemoved', { entityId });
    
    return true;
  }
  
  /**
   * Clear all entities
   */
  clear() {
    this.entities.clear();
    this.interpolators.clear();
    this.ownedEntities.clear();
    
    // Clear storage
    if (this.storage) {
      this.storage.removeItem(`${this.options.storageKey}_${this.roomId}`);
    }
    
    // Notify about clear
    this.emit('cleared');
  }
  
  /**
   * Dispose resources
   */
  dispose() {
    clearInterval(this._updateIntervalId);
    this.clear();
    this.removeAllListeners();
  }
  
  /**
   * Update method called on interval
   * @private
   */
  _update() {
    const currentTime = now();
    
    // Save all owned entities to storage and emit updates
    for (const entityId of this.ownedEntities) {
      if (this.entities.has(entityId)) {
        const entity = this.entities.get(entityId);
        this._saveEntityToStorage(entity);
        
        // Emit update for owned entities
        this.emit('entityUpdated', { entityId, entity, owned: true });
      }
    }
    
    // Clean up stale entities periodically
    if (currentTime - this.lastCleanupTime > this.options.cleanupInterval) {
      this._cleanupStaleEntities();
      this.lastCleanupTime = currentTime;
    }
    
    this.lastUpdateTime = currentTime;
  }
  
  /**
   * Clean up stale entities that haven't been updated recently
   * @private
   */
  _cleanupStaleEntities() {
    const currentTime = now();
    const staleTime = currentTime - this.options.entityTTL;
    
    for (const [entityId, entity] of this.entities.entries()) {
      // Skip entities owned by this client
      if (this.ownedEntities.has(entityId)) {
        continue;
      }
      
      // Remove entities that haven't been updated for too long
      if (entity.timestamp < staleTime) {
        this.removeEntity(entityId);
        log(`Removed stale entity: ${entityId}`);
      }
    }
  }
  
  /**
   * Save entity to local storage
   * @param {EntityState} entity - Entity to save
   * @private
   */
  _saveEntityToStorage(entity) {
    if (!this.storage || !this.roomId) {
      return;
    }
    
    try {
      const key = `${this.options.storageKey}_${this.roomId}`;
      const storageData = JSON.parse(this.storage.getItem(key) || '{"entities":{}}');
      
      storageData.entities[entity.entityId] = entity.serialize();
      storageData.lastUpdate = now();
      
      this.storage.setItem(key, JSON.stringify(storageData));
    } catch (error) {
      log(`Error saving entity to storage: ${error.message}`);
    }
  }
  
  /**
   * Remove entity from local storage
   * @param {string} entityId - Entity ID to remove
   * @private
   */
  _removeEntityFromStorage(entityId) {
    if (!this.storage || !this.roomId) {
      return;
    }
    
    try {
      const key = `${this.options.storageKey}_${this.roomId}`;
      const storageData = JSON.parse(this.storage.getItem(key) || '{"entities":{}}');
      
      if (storageData.entities[entityId]) {
        delete storageData.entities[entityId];
        storageData.lastUpdate = now();
        
        this.storage.setItem(key, JSON.stringify(storageData));
      }
    } catch (error) {
      log(`Error removing entity from storage: ${error.message}`);
    }
  }
  
  /**
   * Load state from local storage
   * @private
   */
  _loadStateFromStorage() {
    if (!this.storage || !this.roomId) {
      return;
    }
    
    try {
      const key = `${this.options.storageKey}_${this.roomId}`;
      const storageData = JSON.parse(this.storage.getItem(key) || '{"entities":{}}');
      
      for (const entityData of Object.values(storageData.entities || {})) {
        const entity = EntityState.deserialize(entityData);
        
        // Only load if we don't already have a newer version
        const existing = this.entities.get(entity.entityId);
        if (!existing || existing.timestamp < entity.timestamp) {
          this.entities.set(entity.entityId, entity);
          
          // Setup interpolator
          if (!this.interpolators.has(entity.entityId)) {
            this.interpolators.set(entity.entityId, new Interpolator());
          }
          
          // Add snapshot
          const interpolator = this.interpolators.get(entity.entityId);
          interpolator.addSnapshot(
            entity.entityId,
            new Snapshot(entity.transform, entity.timestamp, { entityId: entity.entityId, ...entity.metadata })
          );
          
          // Check ownership
          if (entity.metadata.ownerId === this.clientId) {
            this.ownedEntities.add(entity.entityId);
          }
        }
      }
    } catch (error) {
      log(`Error loading state from storage: ${error.message}`);
    }
  }
}

/**
 * WebRTC P2P Connection Manager for direct peer-to-peer communication
 */
export class WebRTCManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      connectionTimeout: 30000, // 30s connection timeout
      ...options
    };
    
    this.clientId = options.clientId || generateUUID();
    this.roomId = null;
    
    this.peerConnections = new Map(); // Map of peer ID to RTCPeerConnection
    this.dataChannels = new Map(); // Map of peer ID to RTCDataChannel
    
    this.pendingCandidates = new Map(); // Store ICE candidates before connection is ready
    this.connectionTimers = new Map(); // Connection timeout timers
  }
  
  /**
   * Initialize WebRTC for a specific room
   * @param {string} roomId - Room identifier
   * @returns {WebRTCManager} - This instance for chaining
   */
  initialize(roomId) {
    this.roomId = roomId;
    return this;
  }
  
  /**
   * Create an offer to connect to a peer
   * @param {string} peerId - Peer identifier
   * @returns {Promise<Object>} - SDP offer
   */
  async createOffer(peerId) {
    // Create peer connection if it doesn't exist
    if (!this.peerConnections.has(peerId)) {
      this._createPeerConnection(peerId);
    }
    
    const peerConnection = this.peerConnections.get(peerId);
    
    try {
      // Create data channel
      const dataChannel = peerConnection.createDataChannel('data', {
        ordered: true
      });
      
      this._setupDataChannel(peerId, dataChannel);
      
      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      // Set connection timeout
      this._setConnectionTimeout(peerId);
      
      return {
        type: 'offer',
        sdp: peerConnection.localDescription,
        peerId: this.clientId
      };
    } catch (error) {
      this._closePeerConnection(peerId);
      log(`Error creating offer: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Handle an incoming offer from a peer
   * @param {Object} offerData - Offer data received from signaling server
   * @returns {Promise<Object>} - SDP answer
   */
  async handleOffer(offerData) {
    const peerId = offerData.peerId;
    
    // Create peer connection if it doesn't exist
    if (!this.peerConnections.has(peerId)) {
      this._createPeerConnection(peerId);
    }
    
    const peerConnection = this.peerConnections.get(peerId);
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offerData.sdp));
      
      // Apply any pending ICE candidates
      if (this.pendingCandidates.has(peerId)) {
        const candidates = this.pendingCandidates.get(peerId);
        for (const candidate of candidates) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(peerId);
      }
      
      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Set connection timeout
      this._setConnectionTimeout(peerId);
      
      return {
        type: 'answer',
        sdp: peerConnection.localDescription,
        peerId: this.clientId
      };
    } catch (error) {
      this._closePeerConnection(peerId);
      log(`Error handling offer: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Handle an answer from a peer
   * @param {Object} answerData - Answer data received from signaling server
   * @returns {Promise<void>}
   */
  async handleAnswer(answerData) {
    const peerId = answerData.peerId;
    
    if (!this.peerConnections.has(peerId)) {
      log(`Received answer from unknown peer: ${peerId}`);
      return;
    }
    
    const peerConnection = this.peerConnections.get(peerId);
    
    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answerData.sdp));
      
      // Apply any pending ICE candidates
      if (this.pendingCandidates.has(peerId)) {
        const candidates = this.pendingCandidates.get(peerId);
        for (const candidate of candidates) {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        }
        this.pendingCandidates.delete(peerId);
      }
    } catch (error) {
      this._closePeerConnection(peerId);
      log(`Error handling answer: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Handle an ICE candidate from a peer
   * @param {Object} candidateData - ICE candidate data
   * @returns {Promise<void>}
   */
  async handleIceCandidate(candidateData) {
    const peerId = candidateData.peerId;
    const candidate = candidateData.candidate;
    
    if (!this.peerConnections.has(peerId)) {
      // Store candidate for later use
      if (!this.pendingCandidates.has(peerId)) {
        this.pendingCandidates.set(peerId, []);
      }
      this.pendingCandidates.get(peerId).push(candidate);
      return;
    }
    
    const peerConnection = this.peerConnections.get(peerId);
    
    try {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      log(`Error handling ICE candidate: ${error.message}`);
    }
  }
  
  /**
   * Send data to a specific peer
   * @param {string} peerId - Peer identifier
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {boolean} - Whether the message was successfully sent
   */
  sendToPeer(peerId, type, data) {
    if (!this.dataChannels.has(peerId)) {
      log(`Cannot send to peer ${peerId}: data channel not established`);
      return false;
    }
    
    const dataChannel = this.dataChannels.get(peerId);
    
    if (dataChannel.readyState !== 'open') {
      log(`Cannot send to peer ${peerId}: data channel not open`);
      return false;
    }
    
    try {
      const message = JSON.stringify({ type, data, from: this.clientId, timestamp: now() });
      dataChannel.send(message);
      return true;
    } catch (error) {
      log(`Error sending to peer ${peerId}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Broadcast data to all connected peers
   * @param {string} type - Message type
   * @param {Object} data - Message data
   * @returns {number} - Number of peers the message was sent to
   */
  broadcast(type, data) {
    let sentCount = 0;
    
    for (const peerId of this.dataChannels.keys()) {
      if (this.sendToPeer(peerId, type, data)) {
        sentCount++;
      }
    }
    
    return sentCount;
  }
  
  /**
   * Close connection to a specific peer
   * @param {string} peerId - Peer identifier
   */
  disconnectFromPeer(peerId) {
    this._closePeerConnection(peerId);
    this.emit('peerDisconnected', { peerId });
  }
  
  /**
   * Close all connections
   */
  disconnectAll() {
    for (const peerId of this.peerConnections.keys()) {
      this._closePeerConnection(peerId);
    }
    
    this.emit('disconnectedFromAll');
  }
  
  /**
   * Get connected peer IDs
   * @returns {Array<string>} - Array of connected peer IDs
   */
  getConnectedPeers() {
    return Array.from(this.dataChannels.keys()).filter(peerId => {
      const dataChannel = this.dataChannels.get(peerId);
      return dataChannel.readyState === 'open';
    });
  }
  
  /**
   * Check if connected to a specific peer
   * @param {string} peerId - Peer identifier
   * @returns {boolean} - Whether connected to the peer
   */
  isConnectedToPeer(peerId) {
    return this.dataChannels.has(peerId) && 
           this.dataChannels.get(peerId).readyState === 'open';
  }
  
  /**
   * Dispose resources
   */
  dispose() {
    this.disconnectAll();
    
    // Clear any pending timeouts
    for (const timerId of this.connectionTimers.values()) {
      clearTimeout(timerId);
    }
    
    this.connectionTimers.clear();
    this.pendingCandidates.clear();
    this.removeAllListeners();
  }
  
  /**
   * Create a new peer connection
   * @param {string} peerId - Peer identifier
   * @private
   */
  _createPeerConnection(peerId) {
    // Close existing connection if any
    if (this.peerConnections.has(peerId)) {
      this._closePeerConnection(peerId);
    }
    
    // Create new connection
    const peerConnection = new RTCPeerConnection({
      iceServers: this.options.iceServers
    });
    
    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.emit('iceCandidate', {
          peerId: this.clientId,
          candidate: event.candidate
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      
      if (state === 'connected') {
        // Clear connection timeout
        if (this.connectionTimers.has(peerId)) {
          clearTimeout(this.connectionTimers.get(peerId));
          this.connectionTimers.delete(peerId);
        }
        
        this.emit('peerConnected', { peerId });
      } else if (state === 'failed' || state === 'closed' || state === 'disconnected') {
        this._closePeerConnection(peerId);
        this.emit('peerDisconnected', { peerId });
      }
    };
    
    // Handle data channel events
    peerConnection.ondatachannel = (event) => {
      this._setupDataChannel(peerId, event.channel);
    };
    
    this.peerConnections.set(peerId, peerConnection);
    return peerConnection;
  }
  
  /**
   * Set up a data channel
   * @param {string} peerId - Peer identifier
   * @param {RTCDataChannel} dataChannel - Data channel
   * @private
   */
  _setupDataChannel(peerId, dataChannel) {
    // Store data channel
    this.dataChannels.set(peerId, dataChannel);
    
    // Handle data channel events
    dataChannel.onopen = () => {
      log(`Data channel to peer ${peerId} open`);
      this.emit('dataChannelOpen', { peerId });
    };
    
    dataChannel.onclose = () => {
      log(`Data channel to peer ${peerId} closed`);
      this.dataChannels.delete(peerId);
      this.emit('dataChannelClose', { peerId });
    };
    
    dataChannel.onerror = (error) => {
      log(`Data channel error with peer ${peerId}: ${error.message}`);
      this.emit('dataChannelError', { peerId, error });
    };
    
    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.emit('message', { ...message, peerId });
      } catch (error) {
        log(`Error parsing message from peer ${peerId}: ${error.message}`);
      }
    };
  }
  
  /**
   * Set connection timeout
   * @param {string} peerId - Peer identifier
   * @private
   */
  _setConnectionTimeout(peerId) {
    // Clear existing timeout if any
    if (this.connectionTimers.has(peerId)) {
      clearTimeout(this.connectionTimers.get(peerId));
    }
    
    // Set new timeout
    const timerId = setTimeout(() => {
      log(`Connection to peer ${peerId} timed out`);
      this._closePeerConnection(peerId);
      this.emit('connectionTimeout', { peerId });
    }, this.options.connectionTimeout);
    
    this.connectionTimers.set(peerId, timerId);
  }
  
  /**
   * Close peer connection and clean up resources
   * @param {string} peerId - Peer identifier
   * @private
   */
  _closePeerConnection(peerId) {
    // Close data channel if any
    if (this.dataChannels.has(peerId)) {
      try {
        this.dataChannels.get(peerId).close();
      } catch (error) {
        // Ignore errors when closing data channel
      }
      this.dataChannels.delete(peerId);
    }
    
    // Close peer connection if any
    if (this.peerConnections.has(peerId)) {
      try {
        this.peerConnections.get(peerId).close();
      } catch (error) {
        // Ignore errors when closing peer connection
      }
      this.peerConnections.delete(peerId);
    }
    
    // Clear connection timeout
    if (this.connectionTimers.has(peerId)) {
      clearTimeout(this.connectionTimers.get(peerId));
      this.connectionTimers.delete(peerId);
    }
    
    // Clear pending candidates
    if (this.pendingCandidates.has(peerId)) {
      this.pendingCandidates.delete(peerId);
    }
  }
}

/**
 * RealtimeClient combines RoomSyncManager and RoomClient for easy integration
 */
export class RealtimeClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      autoReconnect: true,
      reconnectInterval: 2000,
      maxReconnectAttempts: 5,
      updateRate: 50, // ms between updates
      interpolationDelay: 100, // ms of interpolation delay
      useP2P: false, // Whether to use P2P connections when possible
      useLocalStorage: true, // Store state in localStorage when available
      ...options
    };
    
    this.clientId = options.clientId || generateUUID();
    this.roomId = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.isHost = false;
    
    // Create sync manager
    this.syncManager = new RoomSyncManager({
      clientId: this.clientId,
      updateRate: this.options.updateRate,
      useLocalStorage: this.options.useLocalStorage
    });
    
    // Setup P2P if needed
    if (this.options.useP2P) {
      this.webrtc = new WebRTCManager({
        clientId: this.clientId
      });
      
      // Forward P2P messages to sync manager
      this.webrtc.on('message', (message) => {
        if (message.type === 'entityUpdate') {
          this.syncManager.applyNetworkUpdate(message.data);
        }
      });
    } else {
      this.webrtc = null;
    }
    
    // Bind events from sync manager
    this.syncManager.on('entityUpdated', (data) => {
      // If entity is owned by us, send update to server/peers
      if (data.owned) {
        this._sendEntityUpdate(data.entityId);
      }
      
      // Forward event
      this.emit('entityUpdated', data);
    });
    
    this.syncManager.on('networkUpdate', (data) => {
      this.emit('networkUpdate', data);
    });
  }
  
  /**
   * Connect to a room
   * @param {string} url - Server URL or room code
   * @param {boolean} asHost - Whether to join as host
   * @returns {Promise<boolean>} - Whether connection was successful
   */
  async connect(url, asHost = false) {
    if (this.isConnected || this.isConnecting) {
      return false;
    }
    
    this.isConnecting = true;
    
    try {
      // Extract room ID from URL if applicable
      let roomId = url;
      if (url.includes('/')) {
        const urlParts = url.split('/');
        roomId = urlParts[urlParts.length - 1];
      }
      
      this.roomId = roomId;
      this.isHost = asHost;
      
      // Setup sync manager
      this.syncManager.setupRoom(roomId, asHost);
      
      // Setup P2P if needed
      if (this.webrtc) {
        this.webrtc.initialize(roomId);
      }
      
      // Simulate connection success
      // In a real implementation, this would connect to a WebSocket server
      setTimeout(() => {
        this.isConnected = true;
        this.isConnecting = false;
        this.emit('connected', { roomId, isHost: this.isHost });
      }, 100);
      
      return true;
    } catch (error) {
      this.isConnecting = false;
      this.emit('error', { error });
      return false;
    }
  }
  
  /**
   * Disconnect from room
   */
  disconnect() {
    if (!this.isConnected) {
      return;
    }
    
    // Disconnect P2P if needed
    if (this.webrtc) {
      this.webrtc.disconnectAll();
    }
    
    // Reset state
    this.isConnected = false;
    this.isConnecting = false;
    
    // Notify about disconnection
    this.emit('disconnected');
  }
  
  /**
   * Register an entity for synchronization
   * @param {string} entityId - Entity identifier
   * @param {Transform} transform - Initial transform
   * @param {Object} metadata - Additional metadata
   * @returns {RealtimeClient} - This instance for chaining
   */
  registerEntity(entityId, transform, metadata = {}) {
    this.syncManager.registerEntity(entityId, transform, metadata);
    return this;
  }
  
  /**
   * Update an entity's transform
   * @param {string} entityId - Entity identifier
   * @param {Transform} transform - New transform
   * @param {Object} metadata - Additional metadata
   * @returns {boolean} - Whether update was successful
   */
  updateEntity(entityId, transform, metadata = {}) {
    return this.syncManager.updateEntity(entityId, transform, metadata);
  }
  
  /**
   * Get the latest state of an entity
   * @param {string} entityId - Entity identifier
   * @returns {EntityState|null} - Entity state or null
   */
  getEntityState(entityId) {
    return this.syncManager.getEntityState(entityId);
  }
  
  /**
   * Get interpolated transform for rendering
   * @param {string} entityId - Entity identifier
   * @returns {Transform|null} - Interpolated transform or null
   */
  getInterpolatedTransform(entityId) {
    return this.syncManager.getInterpolatedTransform(
      entityId, 
      now() - this.options.interpolationDelay
    );
  }
  
  /**
   * Check if entity is owned by this client
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether entity is owned by this client
   */
  isOwnedByMe(entityId) {
    return this.syncManager.isOwnedByMe(entityId);
  }
  
  /**
   * Get all entities
   * @returns {Array<EntityState>} - All entity states
   */
  getAllEntities() {
    return this.syncManager.getAllEntities();
  }
  
  /**
   * Get entities owned by this client
   * @returns {Array<EntityState>} - Owned entity states
   */
  getOwnedEntities() {
    return this.syncManager.getOwnedEntities();
  }
  
  /**
   * Take ownership of an entity
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether ownership was successfully taken
   */
  takeOwnership(entityId) {
    return this.syncManager.takeOwnership(entityId);
  }
  
  /**
   * Release ownership of an entity
   * @param {string} entityId - Entity identifier
   * @returns {boolean} - Whether ownership was successfully released
   */
  releaseOwnership(entityId) {
    return this.syncManager.releaseOwnership(entityId);
  }
  
  /**
   * Send entity update to server/peers
   * @param {string} entityId - Entity identifier
   * @private
   */
  _sendEntityUpdate(entityId) {
    const entity = this.syncManager.getEntityState(entityId);
    if (!entity) return;
    
    // In a real implementation, this would send to server
    // For demo purposes, we'll just use P2P if available
    if (this.webrtc) {
      this.webrtc.broadcast('entityUpdate', entity.serialize());
    }
  }
  
  /**
   * Dispose all resources
   */
  dispose() {
    this.disconnect();
    this.syncManager.dispose();
    
    if (this.webrtc) {
      this.webrtc.dispose();
    }
    
    this.removeAllListeners();
  }
}

// Collection of utilities for network interpolation and prediction
export const NetworkUtils = {
  /**
   * Calculate an optimal buffer delay based on recent network conditions
   * @param {Array<number>} latencies - Recent latency measurements (ms)
   * @param {number} minDelay - Minimum delay to use (ms)
   * @param {number} maxDelay - Maximum delay to use (ms)
   * @returns {number} - Optimal delay (ms)
   */
  calculateOptimalDelay(latencies, minDelay = 50, maxDelay = 300) {
    if (!latencies || latencies.length === 0) {
      return minDelay;
    }
    
    // Sort latencies to find percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    
    // Use 90th percentile plus standard deviation
    const index90 = Math.floor(sortedLatencies.length * 0.9);
    const percentile90 = sortedLatencies[index90] || sortedLatencies[sortedLatencies.length - 1];
    
    // Calculate standard deviation
    const avg = sortedLatencies.reduce((sum, val) => sum + val, 0) / sortedLatencies.length;
    const variance = sortedLatencies.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / sortedLatencies.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate delay: 90th percentile + 1 standard deviation, clamped between min and max
    return Math.min(maxDelay, Math.max(minDelay, percentile90 + stdDev));
  },
  
  /**
   * Estimate network jitter from recent latency measurements
   * @param {Array<number>} latencies - Recent latency measurements (ms)
   * @returns {number} - Estimated jitter (ms)
   */
  estimateJitter(latencies) {
    if (!latencies || latencies.length < 2) {
      return 0;
    }
    
    // Calculate jitter as the average of absolute differences between consecutive latencies
    let jitterSum = 0;
    for (let i = 1; i < latencies.length; i++) {
      jitterSum += Math.abs(latencies[i] - latencies[i - 1]);
    }
    
    return jitterSum / (latencies.length - 1);
  },
  
  /**
   * Detect and adjust for clock drift between clients
   * @param {number} localTime - Local timestamp (ms)
   * @param {number} remoteTime - Remote timestamp (ms)
   * @param {number} oneWayLatency - Estimated one-way latency (ms)
   * @returns {number} - Estimated clock difference (ms)
   */
  estimateClockDrift(localTime, remoteTime, oneWayLatency) {
    // Clock difference = remote time + one-way latency - local time
    return remoteTime + oneWayLatency - localTime;
  }
};

// Collection of utilities for collision detection between moving entities
export const CollisionUtils = {
  /**
   * Detect collision between moving spheres
   * @param {Vector3} posA - Position of first sphere
   * @param {Vector3} posB - Position of second sphere
   * @param {Vector3} velA - Velocity of first sphere
   * @param {Vector3} velB - Velocity of second sphere
   * @param {number} radiusA - Radius of first sphere
   * @param {number} radiusB - Radius of second sphere
   * @param {number} deltaTime - Time step (seconds)
   * @returns {Object|null} - Collision data or null if no collision
   */
  detectMovingSpheresCollision(posA, posB, velA, velB, radiusA, radiusB, deltaTime) {
    // Calculate relative position and velocity
    const relPos = posB.sub(posA);
    const relVel = velB.sub(velA);
    const totalRadius = radiusA + radiusB;
    
    // Check if spheres are already overlapping
    const distanceSquared = relPos.lengthSquared();
    if (distanceSquared <= totalRadius * totalRadius) {
      // Already overlapping
      const distance = Math.sqrt(distanceSquared);
      const penetration = totalRadius - distance;
      const normal = relPos.divideScalar(distance);
      
      return {
        collided: true,
        time: 0,
        normal,
        penetration,
        pointA: posA.add(normal.multiplyScalar(radiusA)),
        pointB: posB.sub(normal.multiplyScalar(radiusB))
      };
    }
    
    // Check if spheres are moving toward each other
    const a = relVel.lengthSquared();
    const b = 2 * relPos.dot(relVel);
    const c = distanceSquared - totalRadius * totalRadius;
    
    // Check if there's a solution to the quadratic equation
    const discriminant = b * b - 4 * a * c;
    
    if (discriminant < 0 || a === 0) {
      // No collision or not moving relative to each other
      return null;
    }
    
    // Calculate time of collision
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    
    if (t < 0 || t > deltaTime) {
      // Collision in the past or too far in the future
      return null;
    }
    
    // Calculate collision position
    const collisionPosA = posA.add(velA.multiplyScalar(t));
    const collisionPosB = posB.add(velB.multiplyScalar(t));
    
    // Calculate collision normal
    const collisionRelPos = collisionPosB.sub(collisionPosA);
    const distance = collisionRelPos.length();
    const normal = collisionRelPos.divideScalar(distance);
    
    return {
      collided: true,
      time: t,
      normal,
      penetration: 0, // No penetration at exact collision time
      pointA: collisionPosA.add(normal.multiplyScalar(radiusA)),
      pointB: collisionPosB.sub(normal.multiplyScalar(radiusB))
    };
  },
  
  /**
   * Apply an impulse to resolve a collision
   * @param {Vector3} velA - Velocity of first object
   * @param {Vector3} velB - Velocity of second object
   * @param {Vector3} normal - Collision normal
   * @param {number} massA - Mass of first object
   * @param {number} massB - Mass of second object
   * @param {number} restitution - Coefficient of restitution (0-1)
   * @returns {Object} - Updated velocities
   */
  applyCollisionImpulse(velA, velB, normal, massA, massB, restitution = 0.5) {
    // Calculate relative velocity
    const relVel = velB.sub(velA);
    
    // Calculate relative velocity along normal
    const velAlongNormal = relVel.dot(normal);
    
    // If objects are moving away from each other, skip impulse
    if (velAlongNormal > 0) {
      return { velA, velB };
    }
    
    // Calculate impulse scalar
    const j = -(1 + restitution) * velAlongNormal;
    const totalMass = massA + massB;
    
    // Calculate impulse vector
    const impulse = normal.multiplyScalar(j);
    
    // Calculate new velocities
    const newVelA = velA.sub(impulse.multiplyScalar(1 / massA));
    const newVelB = velB.add(impulse.multiplyScalar(1 / massB));
    
    return { velA: newVelA, velB: newVelB };
  }
};

// Integration with Puppeteer core modules
export default {
  EntityState,
  RoomSyncManager,
  WebRTCManager,
  RealtimeClient,
  NetworkUtils,
  CollisionUtils
};