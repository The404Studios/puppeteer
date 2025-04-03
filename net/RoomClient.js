// === puppeteer/net/RoomClient.js ===
import EventEmitter from '../utils/EventEmitter.js';
import { log } from '../utils/Logger.js';
import { generateUUID } from '../utils/UUID.js';
import { now } from '../utils/Clock.js';
import Snapshot from '../core/Snapshot.js';
import Transform from '../core/Transform.js';
import Vector3 from '../core/Vector3.js';
import Quaternion from '../core/Quaternion.js';

class RoomClient extends EventEmitter {
  constructor() {
    super();
    
    this.socket = null;
    this.url = null;
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectInterval = 1000; // Start with 1 second, increase exponentially
    this.lastMessageTime = 0;
    this.pingInterval = null;
    this.clientId = null;
    this.roomId = null;
    this.players = new Map();
    this.config = {
      pingInterval: 5000,         // Send ping every 5 seconds
      connectionTimeout: 10000,   // 10 seconds connection timeout
      compressionEnabled: false,  // Message compression
      autoReconnect: true,        // Automatically reconnect on disconnect
      binaryProtocol: false       // Use binary protocol for network traffic
    };
    
    // Message handlers
    this.messageHandlers = new Map();
    
    // Sequence and tracking
    this.messageSequence = 0;
    this.pendingMessages = new Map();
    
    // Auth data
    this.authToken = null;
  }
  
  connect(url, options = {}) {
    if (this.connected || this.connecting) {
      log('Already connected or connecting');
      return false;
    }
    
    this.url = url;
    this.connecting = true;
    this.config = { ...this.config, ...options };
    
    // Generate a unique client ID if not provided
    this.clientId = options.clientId || generateUUID();
    
    // Extract room ID from URL if present (e.g., ws://example.com/room/123)
    const urlParts = url.split('/');
    this.roomId = urlParts[urlParts.length - 1];
    
    log(`Connecting to ${url} as client ${this.clientId} in room ${this.roomId}`);
    
    try {
      this.socket = new WebSocket(url);
      
      // Set up socket event listeners
      this.socket.onopen = this._onOpen.bind(this);
      this.socket.onclose = this._onClose.bind(this);
      this.socket.onerror = this._onError.bind(this);
      this.socket.onmessage = this._onMessage.bind(this);
      
      // Set up connection timeout
      this.connectionTimeout = setTimeout(() => {
        if (!this.connected) {
          log('Connection timeout');
          this.socket.close();
          this.emit('timeout');
        }
      }, this.config.connectionTimeout);
      
      return true;
    } catch (error) {
      log(`Connection error: ${error.message}`);
      this.connecting = false;
      this.emit('error', error);
      return false;
    }
  }
  
  disconnect() {
    if (!this.connected && !this.connecting) {
      return false;
    }
    
    log('Disconnecting from server');
    
    // Clear ping interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    // Clear connection timeout
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    // Disable auto-reconnect
    this.config.autoReconnect = false;
    
    if (this.socket) {
      try {
        this.send('leave', { clientId: this.clientId });
        this.socket.close();
      } catch (error) {
        log(`Error during disconnect: ${error.message}`);
      }
    }
    
    this.connected = false;
    this.connecting = false;
    this.reconnecting = false;
    
    this.emit('disconnect');
    return true;
  }
  
  reconnect() {
    if (this.connected || this.connecting || this.reconnecting) {
      return false;
    }
    
    this.reconnecting = true;
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      log('Maximum reconnect attempts reached');
      this.reconnecting = false;
      this.emit('reconnectFailed');
      return false;
    }
    
    const delay = Math.min(30000, this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1));
    
    log(`Reconnecting (attempt ${this.reconnectAttempts}) in ${delay}ms`);
    this.emit('reconnecting', { attempt: this.reconnectAttempts, delay });
    
    setTimeout(() => {
      if (this.connect(this.url)) {
        this.emit('reconnect');
      } else {
        this.reconnecting = false;
      }
    }, delay);
    
    return true;
  }
  
  send(type, data, options = {}) {
    if (!this.connected) {
      log('Cannot send message: not connected');
      return false;
    }
    
    const message = {
      type,
      data,
      clientId: this.clientId,
      roomId: this.roomId,
      timestamp: now(),
      sequence: this.messageSequence++,
      reliable: options.reliable !== false
    };
    
    if (options.reliable !== false) {
      // Track reliable messages for acknowledgment
      this.pendingMessages.set(message.sequence, {
        message,
        timestamp: message.timestamp,
        attempts: 1,
        maxAttempts: options.maxAttempts || 3,
        timeout: options.timeout || 5000
      });
    }
    
    try {
      const serialized = this.config.binaryProtocol 
        ? this._serializeBinary(message) 
        : JSON.stringify(message);
      
      this.socket.send(serialized);
      return true;
    } catch (error) {
      log(`Error sending message: ${error.message}`);
      return false;
    }
  }
  
  sendTransform(entityId, transform, options = {}) {
    const snapshot = new Snapshot(
      transform,
      options.timestamp || now(),
      { entityId, ...options.metadata }
    );
    
    this.send('transform', snapshot.serialize(), options);
  }
  
  sendInput(input, options = {}) {
    this.send('input', input, options);
  }
  
  authenticate(token) {
    this.authToken = token;
    this.send('auth', { token }, { reliable: true });
  }
  
  setRoom(roomId) {
    if (this.roomId === roomId) return;
    
    const oldRoomId = this.roomId;
    this.roomId = roomId;
    
    if (this.connected) {
      this.send('roomChange', { from: oldRoomId, to: roomId }, { reliable: true });
    }
  }
  
  // Private methods
  _onOpen() {
    clearTimeout(this.connectionTimeout);
    this.connected = true;
    this.connecting = false;
    this.reconnecting = false;
    this.reconnectAttempts = 0;
    this.lastMessageTime = now();
    
    log('Connected to server');
    
    // Set up ping interval
    this.pingInterval = setInterval(() => {
      this._sendPing();
    }, this.config.pingInterval);
    
    // Send join message
    this.send('join', {
      clientId: this.clientId,
      roomId: this.roomId,
      timestamp: now()
    }, { reliable: true });
    
    // If we have auth token, authenticate
    if (this.authToken) {
      this.authenticate(this.authToken);
    }
    
    this.emit('connect');
  }
  
  _onClose(event) {
    clearTimeout(this.connectionTimeout);
    clearInterval(this.pingInterval);
    
    this.connected = false;
    this.connecting = false;
    
    log(`Connection closed. Code: ${event.code}, Reason: ${event.reason}`);
    
    // Check for abnormal closure
    const abnormalClosure = event.code !== 1000 && event.code !== 1001;
    
    if (this.config.autoReconnect && abnormalClosure && !this.reconnecting) {
      this.reconnect();
    } else {
      this.emit('disconnect', { code: event.code, reason: event.reason });
    }
  }
  
  _onError(error) {
    log(`WebSocket error: ${error.message}`);
    this.emit('error', error);
  }
  
  _onMessage(event) {
    let message;
    
    try {
      if (this.config.binaryProtocol && event.data instanceof ArrayBuffer) {
        message = this._deserializeBinary(event.data);
      } else {
        message = JSON.parse(event.data);
      }
      
      // Update last message time
      this.lastMessageTime = now();
      
      // Handle acknowledgements
      if (message.type === 'ack') {
        this._handleAck(message.data.sequence);
        return;
      }
      
      // Send acknowledgement for reliable messages
      if (message.reliable) {
        this._sendAck(message.sequence);
      }
      
      // Dispatch message to appropriate handler
      this._dispatchMessage(message);
      
    } catch (error) {
      log(`Error processing message: ${error.message}`);
    }
  }
  
  _dispatchMessage(message) {
    // Special handling for system messages
    if (message.type === 'ping') {
      this._handlePing(message);
      return;
    }
    
    if (message.type === 'pong') {
      this._handlePong(message);
      return;
    }
    
    // Handle default system message types
    if (message.type === 'playerJoined') {
      this._handlePlayerJoined(message.data);
    } else if (message.type === 'playerLeft') {
      this._handlePlayerLeft(message.data);
    } else if (message.type === 'playerList') {
      this._handlePlayerList(message.data);
    } else if (message.type === 'transform') {
      this._handleTransform(message.data);
    } else if (message.type === 'input') {
      this._handleInput(message.data);
    }
    
    // Emit event for custom handling
    this.emit(message.type, message.data);
    
    // Check for registered handler
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }
  
  _sendPing() {
    if (!this.connected) return;
    
    const pingData = {
      timestamp: now()
    };
    
    this.send('ping', pingData, { reliable: false });
  }
  
  _handlePing(message) {
    // Respond with pong
    this.send('pong', {
      clientTimestamp: message.data.timestamp,
      serverTimestamp: message.timestamp,
      timestamp: now()
    }, { reliable: false });
  }
  
  _handlePong(message) {
    const now = performance.now();
    const latency = now - message.data.clientTimestamp;
    
    this.emit('pong', {
      latency,
      serverTime: message.data.serverTimestamp
    });
  }
  
  _sendAck(sequence) {
    this.send('ack', { sequence }, { reliable: false });
  }
  
  _handleAck(sequence) {
    // Remove from pending messages
    this.pendingMessages.delete(sequence);
  }
  
  _resendPendingMessages() {
    const now = performance.now();
    
    for (const [sequence, pendingMessage] of this.pendingMessages) {
      const elapsed = now - pendingMessage.timestamp;
      
      if (elapsed > pendingMessage.timeout) {
        if (pendingMessage.attempts >= pendingMessage.maxAttempts) {
          // Max attempts reached, give up
          this.pendingMessages.delete(sequence);
          this.emit('messageFailed', pendingMessage.message);
        } else {
          // Increment attempts and resend
          pendingMessage.attempts++;
          pendingMessage.timestamp = now;
          
          try {
            const serialized = this.config.binaryProtocol 
              ? this._serializeBinary(pendingMessage.message) 
              : JSON.stringify(pendingMessage.message);
            
            this.socket.send(serialized);
          } catch (error) {
            log(`Error resending message: ${error.message}`);
          }
        }
      }
    }
  }
  
  _serializeBinary(message) {
    // Placeholder for binary serialization 
    // To be implemented with a binary protocol like MessagePack or Protocol Buffers
    return JSON.stringify(message);
  }
  
  _deserializeBinary(data) {
    // Placeholder for binary deserialization
    return JSON.parse(new TextDecoder().decode(data));
  }
  
  _handlePlayerJoined(data) {
    // Add to players map
    this.players.set(data.clientId, {
      clientId: data.clientId,
      timestamp: data.timestamp,
      ...data
    });
    
    log(`Player joined: ${data.clientId}`);
  }
  
  _handlePlayerLeft(data) {
    // Remove from players map
    if (this.players.has(data.clientId)) {
      this.players.delete(data.clientId);
      log(`Player left: ${data.clientId}`);
    }
  }
  
  _handlePlayerList(data) {
    // Update players map
    this.players.clear();
    
    for (const player of data.players) {
      this.players.set(player.clientId, player);
    }
    
    log(`Received player list: ${this.players.size} players`);
  }
  
  _handleTransform(data) {
    // Create a snapshot from transform data
    const transform = new Transform(
      new Vector3(data.transform.position.x, data.transform.position.y, data.transform.position.z),
      new Quaternion(
        data.transform.rotation.x,
        data.transform.rotation.y,
        data.transform.rotation.z,
        data.transform.rotation.w
      ),
      data.transform.scale ? new Vector3(
        data.transform.scale.x,
        data.transform.scale.y,
        data.transform.scale.z
      ) : new Vector3(1, 1, 1)
    );
    
    const snapshot = new Snapshot(transform, data.timestamp, data.metadata);
    
    // Forward as entity update
    this.emit('entityUpdate', {
      entityId: data.metadata.entityId,
      snapshot
    });
  }
  
  _handleInput(data) {
    // Forward input event
    this.emit('input', data);
  }
  
  registerHandler(messageType, handler) {
    this.messageHandlers.set(messageType, handler);
  }
  
  unregisterHandler(messageType) {
    this.messageHandlers.delete(messageType);
  }
}

// Singleton instance
const roomClient = new RoomClient();

// Export singleton and class
export default roomClient;
export { RoomClient };