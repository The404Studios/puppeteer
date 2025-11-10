/**
 * Compression Test Example
 * Demonstrates the compression capabilities of Puppeteer
 */

// In Node.js or with a bundler
const Compression = require('../utils/Compression.js');
const { Packet, PacketType } = require('../net/Packet.js');

console.log('🎭 Puppeteer Compression Test\n');

// Test 1: Transform Compression
console.log('=== Transform Compression ===');
const transform = {
    position: { x: 123.456, y: 78.901, z: -45.678 },
    rotation: { x: 0.1, y: 0.2, z: 0.3, w: 0.9 },
    scale: { x: 1, y: 1, z: 1 }
};

console.log('Original transform:', transform);
console.log('Original size (JSON):', JSON.stringify(transform).length, 'bytes');

const compressedTransform = Compression.compressTransform(transform);
console.log('Compressed size:', compressedTransform.byteLength, 'bytes');

const decompressed = Compression.decompressTransform(compressedTransform);
console.log('Decompressed:', decompressed);
console.log('Compression ratio:', ((compressedTransform.byteLength / JSON.stringify(transform).length) * 100).toFixed(2) + '%');
console.log();

// Test 2: Position Quantization
console.log('=== Position Quantization ===');
const position = { x: 123.456789, y: -456.123456, z: 789.987654 };

console.log('Original position:', position);
console.log('Original size (JSON):', JSON.stringify(position).length, 'bytes');

const compressedPos = Compression.compressPosition(position);
console.log('Compressed size:', compressedPos.byteLength, 'bytes (16-bit quantization)');

const decompressedPos = Compression.decompressPosition(compressedPos);
console.log('Decompressed:', decompressedPos);
console.log('Error:', {
    x: Math.abs(position.x - decompressedPos.x).toFixed(3),
    y: Math.abs(position.y - decompressedPos.y).toFixed(3),
    z: Math.abs(position.z - decompressedPos.z).toFixed(3)
});
console.log();

// Test 3: Quaternion Compression (Smallest Three)
console.log('=== Quaternion Compression ===');
const quaternion = { x: 0.1, y: 0.2, z: 0.3, w: 0.9272952180016122 }; // Normalized

console.log('Original quaternion:', quaternion);
console.log('Original size (JSON):', JSON.stringify(quaternion).length, 'bytes');

const compressedQuat = Compression.compressQuaternion(quaternion);
console.log('Compressed size:', compressedQuat.byteLength, 'bytes (smallest three method)');

const decompressedQuat = Compression.decompressQuaternion(compressedQuat);
console.log('Decompressed:', decompressedQuat);
console.log('Error:', {
    x: Math.abs(quaternion.x - decompressedQuat.x).toFixed(6),
    y: Math.abs(quaternion.y - decompressedQuat.y).toFixed(6),
    z: Math.abs(quaternion.z - decompressedQuat.z).toFixed(6),
    w: Math.abs(quaternion.w - decompressedQuat.w).toFixed(6)
});
console.log();

// Test 4: Packet Compression
console.log('=== Packet Compression ===');
const packet = Packet.createEntityUpdate('player_123', {
    position: { x: 100, y: 200, z: 300 },
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    scale: { x: 1, y: 1, z: 1 }
}, { health: 100, armor: 50 });

const jsonPacket = packet.toJSON();
console.log('JSON packet size:', jsonPacket.length, 'bytes');

const binaryPacket = packet.toBinary(false);
console.log('Binary packet size (uncompressed):', binaryPacket.byteLength, 'bytes');

const compressedPacket = packet.toBinary(true);
console.log('Binary packet size (compressed):', compressedPacket.byteLength, 'bytes');

console.log('Savings:', ((jsonPacket.length - compressedPacket.byteLength) / jsonPacket.length * 100).toFixed(2) + '%');
console.log();

// Test 5: Super-Compressed Entity Update
console.log('=== Super-Compressed Entity Update ===');
const superCompressed = Packet.createCompressedEntityUpdate('player_123', {
    position: { x: 100, y: 200, z: 300 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }
});

console.log('Super-compressed size:', superCompressed.byteLength, 'bytes');
console.log('vs JSON:', jsonPacket.length, 'bytes');
console.log('Compression ratio:', ((superCompressed.byteLength / jsonPacket.length) * 100).toFixed(2) + '%');
console.log('Savings:', ((jsonPacket.length - superCompressed.byteLength) / jsonPacket.length * 100).toFixed(2) + '%');

const decoded = Packet.decodeCompressedEntityUpdate(superCompressed);
console.log('Decoded:', decoded);
console.log();

// Test 6: LZ77 Compression
console.log('=== LZ77 Compression (Buffer) ===');
const data = {
    type: 'gameState',
    entities: [
        { id: 'player1', pos: [100, 200, 300], rot: [0, 0, 0, 1] },
        { id: 'player2', pos: [150, 250, 350], rot: [0, 0, 0, 1] },
        { id: 'player3', pos: [200, 300, 400], rot: [0, 0, 0, 1] }
    ],
    timestamp: Date.now()
};

const originalSize = JSON.stringify(data).length;
console.log('Original data size:', originalSize, 'bytes');

const compressed = Compression.compressToBuffer(data);
console.log('LZ77 compressed:', compressed.byteLength, 'bytes');

const decompressedData = Compression.decompressFromBuffer(compressed);
console.log('Decompressed matches original:', JSON.stringify(data) === JSON.stringify(decompressedData));

const stats = Compression.getCompressionStats(data, compressed);
console.log('Compression stats:', stats);
console.log();

// Summary
console.log('=== Summary ===');
console.log('Compression techniques available:');
console.log('  1. Transform compression (40 bytes fixed)');
console.log('  2. Position quantization (6 bytes, 16-bit)');
console.log('  3. Quaternion smallest-three (7 bytes)');
console.log('  4. LZ77 dictionary compression (variable)');
console.log('  5. Super-compressed entity updates (15 + ID length bytes)');
console.log();
console.log('Typical savings for entity updates: 60-80%');
console.log('Best for: Real-time multiplayer with frequent updates');
console.log();
console.log('💡 Tip: Use super-compressed format for entity updates,');
console.log('   and LZ77 for larger state snapshots and initial sync.');
