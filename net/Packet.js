/**
 * Packet.js
 * Packet encode/decode helpers for network transmission
 * Supports both JSON and binary (ArrayBuffer) formats with compression
 */

// Try to import Compression if available
let Compression = null;
if (typeof require !== 'undefined') {
    try {
        Compression = require('../utils/Compression.js');
    } catch (e) {
        // Compression not available in this environment
    }
}

const PacketType = {
    // Connection
    CONNECT: 0,
    DISCONNECT: 1,
    PING: 2,
    PONG: 3,

    // Entity sync
    ENTITY_UPDATE: 10,
    ENTITY_CREATE: 11,
    ENTITY_DESTROY: 12,

    // Player actions
    INPUT: 20,
    STATE_UPDATE: 21,

    // Room management
    JOIN_ROOM: 30,
    LEAVE_ROOM: 31,
    ROOM_STATE: 32,

    // Custom messages
    CUSTOM: 100
};

class Packet {
    /**
     * Creates a packet
     * @param {number} type - Packet type (from PacketType)
     * @param {*} data - Packet payload
     * @param {number} timestamp - Timestamp (default: performance.now())
     */
    constructor(type, data, timestamp = performance.now()) {
        this.type = type;
        this.data = data;
        this.timestamp = timestamp;
    }

    /**
     * Encodes the packet as JSON string
     * @returns {string} JSON encoded packet
     */
    toJSON() {
        return JSON.stringify({
            type: this.type,
            data: this.data,
            timestamp: this.timestamp
        });
    }

    /**
     * Encodes the packet as binary ArrayBuffer
     * @param {boolean} compress - Whether to compress the data (default: false)
     * @returns {ArrayBuffer} Binary encoded packet
     */
    toBinary(compress = false) {
        // Binary format:
        // [type: 1 byte][flags: 1 byte][timestamp: 8 bytes (double)][data length: 4 bytes][data: variable]
        // flags bit 0: compression enabled

        let dataBytes;
        let compressionFlag = 0;

        if (compress && Compression) {
            // Try to compress the data
            const compressedBuffer = Compression.compressToBuffer(this.data);
            dataBytes = new Uint8Array(compressedBuffer);
            compressionFlag = 1;
        } else {
            // No compression, use JSON
            const jsonData = JSON.stringify(this.data);
            dataBytes = new TextEncoder().encode(jsonData);
        }

        const buffer = new ArrayBuffer(1 + 1 + 8 + 4 + dataBytes.length);
        const view = new DataView(buffer);

        let offset = 0;

        // Type
        view.setUint8(offset, this.type);
        offset += 1;

        // Flags
        view.setUint8(offset, compressionFlag);
        offset += 1;

        // Timestamp
        view.setFloat64(offset, this.timestamp);
        offset += 8;

        // Data length
        view.setUint32(offset, dataBytes.length);
        offset += 4;

        // Data
        const dataView = new Uint8Array(buffer, offset);
        dataView.set(dataBytes);

        return buffer;
    }

    /**
     * Creates a packet from JSON string
     * @param {string} json - JSON string
     * @returns {Packet} Decoded packet
     */
    static fromJSON(json) {
        try {
            const obj = JSON.parse(json);
            return new Packet(obj.type, obj.data, obj.timestamp);
        } catch (error) {
            console.error('Failed to parse packet JSON:', error);
            return null;
        }
    }

    /**
     * Creates a packet from binary ArrayBuffer
     * @param {ArrayBuffer} buffer - Binary buffer
     * @returns {Packet} Decoded packet
     */
    static fromBinary(buffer) {
        try {
            const view = new DataView(buffer);
            let offset = 0;

            // Type
            const type = view.getUint8(offset);
            offset += 1;

            // Flags
            const flags = view.getUint8(offset);
            offset += 1;
            const isCompressed = (flags & 1) === 1;

            // Timestamp
            const timestamp = view.getFloat64(offset);
            offset += 8;

            // Data length
            const dataLength = view.getUint32(offset);
            offset += 4;

            // Data
            const dataBytes = new Uint8Array(buffer, offset, dataLength);
            let data;

            if (isCompressed && Compression) {
                // Decompress the data
                data = Compression.decompressFromBuffer(dataBytes.buffer.slice(offset));
            } else {
                // Parse as JSON
                const jsonData = new TextDecoder().decode(dataBytes);
                data = JSON.parse(jsonData);
            }

            return new Packet(type, data, timestamp);
        } catch (error) {
            console.error('Failed to parse packet binary:', error);
            return null;
        }
    }

    /**
     * Creates a connection packet
     * @param {Object} clientInfo - Client information
     * @returns {Packet} Connection packet
     */
    static createConnect(clientInfo) {
        return new Packet(PacketType.CONNECT, clientInfo);
    }

    /**
     * Creates a disconnect packet
     * @param {string} reason - Disconnect reason
     * @returns {Packet} Disconnect packet
     */
    static createDisconnect(reason = 'Client disconnected') {
        return new Packet(PacketType.DISCONNECT, { reason });
    }

    /**
     * Creates a ping packet
     * @param {number} clientTime - Client timestamp
     * @returns {Packet} Ping packet
     */
    static createPing(clientTime = performance.now()) {
        return new Packet(PacketType.PING, { clientTime });
    }

    /**
     * Creates a pong packet
     * @param {number} clientTime - Original client timestamp from ping
     * @param {number} serverTime - Server timestamp
     * @returns {Packet} Pong packet
     */
    static createPong(clientTime, serverTime = performance.now()) {
        return new Packet(PacketType.PONG, { clientTime, serverTime });
    }

    /**
     * Creates an entity update packet
     * @param {string} entityId - Entity ID
     * @param {Object} transform - Transform data
     * @param {Object} metadata - Optional metadata
     * @returns {Packet} Entity update packet
     */
    static createEntityUpdate(entityId, transform, metadata = {}) {
        return new Packet(PacketType.ENTITY_UPDATE, {
            entityId,
            position: transform.position,
            rotation: transform.rotation,
            scale: transform.scale,
            metadata
        });
    }

    /**
     * Creates a compressed entity update packet using quantization
     * @param {string} entityId - Entity ID
     * @param {Object} transform - Transform data
     * @param {Object} options - Compression options
     * @returns {ArrayBuffer} Compressed packet
     */
    static createCompressedEntityUpdate(entityId, transform, options = {}) {
        if (!Compression) {
            console.warn('Compression not available, using standard packet');
            return this.createEntityUpdate(entityId, transform).toBinary();
        }

        const bounds = options.bounds || { min: -1000, max: 1000 };

        // Create a compact binary format
        const idBytes = new TextEncoder().encode(entityId);
        const posBuffer = Compression.compressPosition(transform.position, bounds);
        const rotBuffer = Compression.compressQuaternion(transform.rotation);

        // Total: 1 + 1 + idBytes.length + 6 + 7 = 15 + idBytes.length
        const buffer = new ArrayBuffer(2 + idBytes.length + posBuffer.byteLength + rotBuffer.byteLength);
        const view = new DataView(buffer);

        let offset = 0;

        // Packet type
        view.setUint8(offset, PacketType.ENTITY_UPDATE);
        offset += 1;

        // Entity ID length
        view.setUint8(offset, idBytes.length);
        offset += 1;

        // Entity ID
        const idView = new Uint8Array(buffer, offset, idBytes.length);
        idView.set(idBytes);
        offset += idBytes.length;

        // Position (6 bytes)
        const posView = new Uint8Array(buffer, offset, posBuffer.byteLength);
        posView.set(new Uint8Array(posBuffer));
        offset += posBuffer.byteLength;

        // Rotation (7 bytes)
        const rotView = new Uint8Array(buffer, offset, rotBuffer.byteLength);
        rotView.set(new Uint8Array(rotBuffer));

        return buffer;
    }

    /**
     * Decodes a compressed entity update packet
     * @param {ArrayBuffer} buffer - Compressed packet
     * @param {Object} options - Decompression options
     * @returns {Object} Decoded entity update
     */
    static decodeCompressedEntityUpdate(buffer, options = {}) {
        if (!Compression) {
            throw new Error('Compression not available');
        }

        const bounds = options.bounds || { min: -1000, max: 1000 };
        const view = new DataView(buffer);

        let offset = 0;

        // Packet type
        const type = view.getUint8(offset);
        offset += 1;

        // Entity ID length
        const idLength = view.getUint8(offset);
        offset += 1;

        // Entity ID
        const idBytes = new Uint8Array(buffer, offset, idLength);
        const entityId = new TextDecoder().decode(idBytes);
        offset += idLength;

        // Position (6 bytes)
        const posBuffer = buffer.slice(offset, offset + 6);
        const position = Compression.decompressPosition(posBuffer, bounds);
        offset += 6;

        // Rotation (7 bytes)
        const rotBuffer = buffer.slice(offset, offset + 7);
        const rotation = Compression.decompressQuaternion(rotBuffer);

        return {
            type,
            entityId,
            position,
            rotation
        };
    }

    /**
     * Creates an input packet
     * @param {number} sequence - Input sequence number
     * @param {Object} input - Input data
     * @returns {Packet} Input packet
     */
    static createInput(sequence, input) {
        return new Packet(PacketType.INPUT, { sequence, input });
    }

    /**
     * Creates a custom packet
     * @param {string} eventName - Event name
     * @param {*} data - Event data
     * @returns {Packet} Custom packet
     */
    static createCustom(eventName, data) {
        return new Packet(PacketType.CUSTOM, { eventName, data });
    }

    /**
     * Gets the packet size in bytes
     * @returns {number} Size in bytes
     */
    getSize() {
        return this.toJSON().length;
    }

    /**
     * Checks if the packet is valid
     * @returns {boolean} True if valid
     */
    isValid() {
        return (
            typeof this.type === 'number' &&
            this.data !== undefined &&
            typeof this.timestamp === 'number'
        );
    }

    /**
     * Clones the packet
     * @returns {Packet} Cloned packet
     */
    clone() {
        return new Packet(
            this.type,
            JSON.parse(JSON.stringify(this.data)),
            this.timestamp
        );
    }
}

// Helper functions for batch operations
const PacketUtils = {
    /**
     * Encodes multiple packets into a single payload
     * @param {Array<Packet>} packets - Array of packets
     * @param {boolean} useBinary - Use binary encoding (default: false)
     * @returns {string|ArrayBuffer} Encoded batch
     */
    encodeBatch(packets, useBinary = false) {
        if (useBinary) {
            // Binary batch format: [count: 4 bytes][packet1][packet2]...
            const packetBuffers = packets.map(p => p.toBinary());
            const totalSize = 4 + packetBuffers.reduce((sum, buf) => sum + buf.byteLength, 0);

            const buffer = new ArrayBuffer(totalSize);
            const view = new DataView(buffer);
            view.setUint32(0, packets.length);

            let offset = 4;
            for (const packetBuffer of packetBuffers) {
                const packetView = new Uint8Array(buffer, offset);
                packetView.set(new Uint8Array(packetBuffer));
                offset += packetBuffer.byteLength;
            }

            return buffer;
        } else {
            return JSON.stringify(packets.map(p => ({
                type: p.type,
                data: p.data,
                timestamp: p.timestamp
            })));
        }
    },

    /**
     * Decodes multiple packets from a batch payload
     * @param {string|ArrayBuffer} payload - Encoded batch
     * @returns {Array<Packet>} Array of packets
     */
    decodeBatch(payload) {
        if (payload instanceof ArrayBuffer) {
            const packets = [];
            const view = new DataView(payload);
            const count = view.getUint32(0);

            let offset = 4;
            for (let i = 0; i < count; i++) {
                // Read packet from buffer
                // This is simplified - in practice you'd need to know packet sizes
                // For now, we'll use a different approach
                console.warn('Binary batch decoding not fully implemented');
            }

            return packets;
        } else {
            try {
                const array = JSON.parse(payload);
                return array.map(obj => new Packet(obj.type, obj.data, obj.timestamp));
            } catch (error) {
                console.error('Failed to decode packet batch:', error);
                return [];
            }
        }
    },

    /**
     * Compresses packet data
     * @param {Packet} packet - Packet to compress
     * @returns {ArrayBuffer} Compressed packet
     */
    compress(packet) {
        if (!Compression) {
            console.warn('Compression not available');
            return packet.toBinary();
        }
        return packet.toBinary(true);
    },

    /**
     * Decompresses packet data
     * @param {ArrayBuffer} buffer - Compressed packet
     * @returns {Packet} Decompressed packet
     */
    decompress(buffer) {
        return Packet.fromBinary(buffer);
    },

    /**
     * Calculates average packet size from an array
     * @param {Array<Packet>} packets - Array of packets
     * @returns {number} Average size in bytes
     */
    averageSize(packets) {
        if (packets.length === 0) return 0;
        const totalSize = packets.reduce((sum, p) => sum + p.getSize(), 0);
        return totalSize / packets.length;
    }
};

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Packet, PacketType, PacketUtils };
}
