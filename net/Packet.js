/**
 * Packet.js
 * Packet encode/decode helpers for network transmission
 * Supports both JSON and binary (ArrayBuffer) formats
 */

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
     * @returns {ArrayBuffer} Binary encoded packet
     */
    toBinary() {
        // Simple binary format:
        // [type: 1 byte][timestamp: 8 bytes (double)][data length: 4 bytes][data: variable]

        const jsonData = JSON.stringify(this.data);
        const dataBytes = new TextEncoder().encode(jsonData);

        const buffer = new ArrayBuffer(1 + 8 + 4 + dataBytes.length);
        const view = new DataView(buffer);

        let offset = 0;

        // Type
        view.setUint8(offset, this.type);
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

            // Timestamp
            const timestamp = view.getFloat64(offset);
            offset += 8;

            // Data length
            const dataLength = view.getUint32(offset);
            offset += 4;

            // Data
            const dataBytes = new Uint8Array(buffer, offset, dataLength);
            const jsonData = new TextDecoder().decode(dataBytes);
            const data = JSON.parse(jsonData);

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
            metadata
        });
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
     * Compresses packet data (simple implementation)
     * @param {Packet} packet - Packet to compress
     * @returns {Packet} Packet with compressed data
     */
    compress(packet) {
        // In a real implementation, you might use a compression library
        // For now, just return the packet as-is
        return packet;
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
