/**
 * Compression.js
 * Compression and decompression utilities for network data
 * Supports multiple compression strategies for optimal bandwidth usage
 */

class Compression {
    /**
     * Compresses a string using run-length encoding (simple method)
     * @param {string} str - String to compress
     * @returns {string} Compressed string
     */
    static runLengthEncode(str) {
        if (!str || str.length === 0) return str;

        let compressed = '';
        let count = 1;

        for (let i = 1; i <= str.length; i++) {
            if (i < str.length && str[i] === str[i - 1]) {
                count++;
            } else {
                compressed += str[i - 1];
                if (count > 1) {
                    compressed += count;
                }
                count = 1;
            }
        }

        return compressed;
    }

    /**
     * Decompresses a run-length encoded string
     * @param {string} str - Compressed string
     * @returns {string} Decompressed string
     */
    static runLengthDecode(str) {
        if (!str || str.length === 0) return str;

        let decompressed = '';
        let i = 0;

        while (i < str.length) {
            const char = str[i];
            i++;

            let count = '';
            while (i < str.length && !isNaN(str[i])) {
                count += str[i];
                i++;
            }

            const repeatCount = count ? parseInt(count) : 1;
            decompressed += char.repeat(repeatCount);
        }

        return decompressed;
    }

    /**
     * Compresses JSON data by removing whitespace and shortening keys
     * @param {Object} data - Data to compress
     * @param {Object} keyMap - Optional key mapping for shortening
     * @returns {string} Compressed JSON string
     */
    static compressJSON(data, keyMap = null) {
        let processed = data;

        // Apply key mapping if provided
        if (keyMap) {
            processed = this._applyKeyMap(data, keyMap);
        }

        // Stringify without whitespace
        return JSON.stringify(processed);
    }

    /**
     * Decompresses JSON data and restores original keys
     * @param {string} compressed - Compressed JSON string
     * @param {Object} keyMap - Optional key mapping used during compression
     * @returns {Object} Decompressed data
     */
    static decompressJSON(compressed, keyMap = null) {
        let data = JSON.parse(compressed);

        // Restore original keys if mapping was used
        if (keyMap) {
            const reverseMap = this._reverseKeyMap(keyMap);
            data = this._applyKeyMap(data, reverseMap);
        }

        return data;
    }

    /**
     * Applies key mapping to an object
     * @private
     */
    static _applyKeyMap(obj, keyMap) {
        if (typeof obj !== 'object' || obj === null) {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this._applyKeyMap(item, keyMap));
        }

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            const newKey = keyMap[key] || key;
            result[newKey] = this._applyKeyMap(value, keyMap);
        }

        return result;
    }

    /**
     * Reverses a key map
     * @private
     */
    static _reverseKeyMap(keyMap) {
        const reversed = {};
        for (const [key, value] of Object.entries(keyMap)) {
            reversed[value] = key;
        }
        return reversed;
    }

    /**
     * Compresses data to ArrayBuffer using simple dictionary encoding
     * @param {Object} data - Data to compress
     * @returns {ArrayBuffer} Compressed data
     */
    static compressToBuffer(data) {
        const json = JSON.stringify(data);

        // Use TextEncoder to convert to bytes
        const encoder = new TextEncoder();
        const bytes = encoder.encode(json);

        // Simple LZ77-style compression
        return this._lz77Compress(bytes);
    }

    /**
     * Decompresses ArrayBuffer data
     * @param {ArrayBuffer} buffer - Compressed buffer
     * @returns {Object} Decompressed data
     */
    static decompressFromBuffer(buffer) {
        // Decompress using LZ77
        const decompressed = this._lz77Decompress(buffer);

        // Convert bytes back to string
        const decoder = new TextDecoder();
        const json = decoder.decode(decompressed);

        return JSON.parse(json);
    }

    /**
     * Simple LZ77 compression
     * @private
     */
    static _lz77Compress(data) {
        const maxDistance = 256;
        const maxLength = 15;
        const compressed = [];
        let i = 0;

        while (i < data.length) {
            let bestLength = 0;
            let bestDistance = 0;

            // Look for matches in the sliding window
            const searchStart = Math.max(0, i - maxDistance);
            for (let j = searchStart; j < i; j++) {
                let length = 0;
                while (
                    length < maxLength &&
                    i + length < data.length &&
                    data[j + length] === data[i + length]
                ) {
                    length++;
                }

                if (length > bestLength) {
                    bestLength = length;
                    bestDistance = i - j;
                }
            }

            if (bestLength >= 3) {
                // Encode as (distance, length) pair
                compressed.push(0); // Marker for compressed sequence
                compressed.push(bestDistance & 0xFF);
                compressed.push(bestLength & 0xFF);
                i += bestLength;
            } else {
                // Encode as literal
                compressed.push(1); // Marker for literal
                compressed.push(data[i]);
                i++;
            }
        }

        return new Uint8Array(compressed).buffer;
    }

    /**
     * Simple LZ77 decompression
     * @private
     */
    static _lz77Decompress(buffer) {
        const data = new Uint8Array(buffer);
        const decompressed = [];
        let i = 0;

        while (i < data.length) {
            const marker = data[i++];

            if (marker === 0) {
                // Compressed sequence
                const distance = data[i++];
                const length = data[i++];

                const startPos = decompressed.length - distance;
                for (let j = 0; j < length; j++) {
                    decompressed.push(decompressed[startPos + j]);
                }
            } else {
                // Literal
                decompressed.push(data[i++]);
            }
        }

        return new Uint8Array(decompressed);
    }

    /**
     * Compresses transform data efficiently
     * @param {Object} transform - Transform object {position, rotation, scale}
     * @returns {ArrayBuffer} Compressed transform
     */
    static compressTransform(transform) {
        // Use Float32 instead of Float64 to save space
        const buffer = new ArrayBuffer(10 * 4); // 10 floats
        const view = new DataView(buffer);

        let offset = 0;

        // Position (3 floats)
        view.setFloat32(offset, transform.position.x, true); offset += 4;
        view.setFloat32(offset, transform.position.y, true); offset += 4;
        view.setFloat32(offset, transform.position.z, true); offset += 4;

        // Rotation (4 floats for quaternion)
        view.setFloat32(offset, transform.rotation.x, true); offset += 4;
        view.setFloat32(offset, transform.rotation.y, true); offset += 4;
        view.setFloat32(offset, transform.rotation.z, true); offset += 4;
        view.setFloat32(offset, transform.rotation.w, true); offset += 4;

        // Scale (3 floats, optional)
        const scale = transform.scale || { x: 1, y: 1, z: 1 };
        view.setFloat32(offset, scale.x, true); offset += 4;
        view.setFloat32(offset, scale.y, true); offset += 4;
        view.setFloat32(offset, scale.z, true); offset += 4;

        return buffer;
    }

    /**
     * Decompresses transform data
     * @param {ArrayBuffer} buffer - Compressed transform
     * @returns {Object} Transform object
     */
    static decompressTransform(buffer) {
        const view = new DataView(buffer);
        let offset = 0;

        return {
            position: {
                x: view.getFloat32(offset, true),
                y: view.getFloat32(offset + 4, true),
                z: view.getFloat32(offset + 8, true)
            },
            rotation: {
                x: view.getFloat32(offset + 12, true),
                y: view.getFloat32(offset + 16, true),
                z: view.getFloat32(offset + 20, true),
                w: view.getFloat32(offset + 24, true)
            },
            scale: {
                x: view.getFloat32(offset + 28, true),
                y: view.getFloat32(offset + 32, true),
                z: view.getFloat32(offset + 36, true)
            }
        };
    }

    /**
     * Compresses an array of transforms
     * @param {Array} transforms - Array of transform objects
     * @returns {ArrayBuffer} Compressed transforms
     */
    static compressTransformArray(transforms) {
        const buffers = transforms.map(t => this.compressTransform(t));
        const totalSize = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);

        // Add header with count
        const result = new ArrayBuffer(4 + totalSize);
        const view = new DataView(result);
        view.setUint32(0, transforms.length, true);

        let offset = 4;
        for (const buffer of buffers) {
            const bytes = new Uint8Array(buffer);
            const resultBytes = new Uint8Array(result, offset);
            resultBytes.set(bytes);
            offset += buffer.byteLength;
        }

        return result;
    }

    /**
     * Decompresses an array of transforms
     * @param {ArrayBuffer} buffer - Compressed transforms
     * @returns {Array} Array of transform objects
     */
    static decompressTransformArray(buffer) {
        const view = new DataView(buffer);
        const count = view.getUint32(0, true);
        const transforms = [];

        const transformSize = 40; // 10 floats * 4 bytes
        let offset = 4;

        for (let i = 0; i < count; i++) {
            const transformBuffer = buffer.slice(offset, offset + transformSize);
            transforms.push(this.decompressTransform(transformBuffer));
            offset += transformSize;
        }

        return transforms;
    }

    /**
     * Quantizes a float to fewer bits
     * @param {number} value - Float value
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} bits - Number of bits (default: 16)
     * @returns {number} Quantized integer
     */
    static quantize(value, min, max, bits = 16) {
        const range = max - min;
        const maxInt = (1 << bits) - 1;
        const normalized = (value - min) / range;
        return Math.round(normalized * maxInt);
    }

    /**
     * Dequantizes an integer back to float
     * @param {number} quantized - Quantized integer
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @param {number} bits - Number of bits (default: 16)
     * @returns {number} Float value
     */
    static dequantize(quantized, min, max, bits = 16) {
        const range = max - min;
        const maxInt = (1 << bits) - 1;
        const normalized = quantized / maxInt;
        return min + normalized * range;
    }

    /**
     * Compresses a position using quantization
     * @param {Object} position - Position {x, y, z}
     * @param {Object} bounds - Bounds {min, max}
     * @returns {ArrayBuffer} Compressed position (6 bytes)
     */
    static compressPosition(position, bounds = { min: -1000, max: 1000 }) {
        const buffer = new ArrayBuffer(6);
        const view = new DataView(buffer);

        view.setUint16(0, this.quantize(position.x, bounds.min, bounds.max), true);
        view.setUint16(2, this.quantize(position.y, bounds.min, bounds.max), true);
        view.setUint16(4, this.quantize(position.z, bounds.min, bounds.max), true);

        return buffer;
    }

    /**
     * Decompresses a position
     * @param {ArrayBuffer} buffer - Compressed position
     * @param {Object} bounds - Bounds {min, max}
     * @returns {Object} Position {x, y, z}
     */
    static decompressPosition(buffer, bounds = { min: -1000, max: 1000 }) {
        const view = new DataView(buffer);

        return {
            x: this.dequantize(view.getUint16(0, true), bounds.min, bounds.max),
            y: this.dequantize(view.getUint16(2, true), bounds.min, bounds.max),
            z: this.dequantize(view.getUint16(4, true), bounds.min, bounds.max)
        };
    }

    /**
     * Compresses a quaternion using smallest three
     * @param {Object} quaternion - Quaternion {x, y, z, w}
     * @returns {ArrayBuffer} Compressed quaternion (7 bytes)
     */
    static compressQuaternion(quaternion) {
        // Find largest component
        const abs = [
            Math.abs(quaternion.x),
            Math.abs(quaternion.y),
            Math.abs(quaternion.z),
            Math.abs(quaternion.w)
        ];
        const maxIndex = abs.indexOf(Math.max(...abs));

        // Get the three smallest components
        const components = [quaternion.x, quaternion.y, quaternion.z, quaternion.w];
        const sign = components[maxIndex] < 0 ? -1 : 1;

        const small = [];
        for (let i = 0; i < 4; i++) {
            if (i !== maxIndex) {
                small.push(components[i] * sign);
            }
        }

        // Compress to 7 bytes: 1 byte for index, 2 bytes per component
        const buffer = new ArrayBuffer(7);
        const view = new DataView(buffer);

        view.setUint8(0, maxIndex);
        view.setInt16(1, Math.round(small[0] * 32767), true);
        view.setInt16(3, Math.round(small[1] * 32767), true);
        view.setInt16(5, Math.round(small[2] * 32767), true);

        return buffer;
    }

    /**
     * Decompresses a quaternion
     * @param {ArrayBuffer} buffer - Compressed quaternion
     * @returns {Object} Quaternion {x, y, z, w}
     */
    static decompressQuaternion(buffer) {
        const view = new DataView(buffer);
        const maxIndex = view.getUint8(0);

        const small = [
            view.getInt16(1, true) / 32767,
            view.getInt16(3, true) / 32767,
            view.getInt16(5, true) / 32767
        ];

        // Reconstruct the largest component
        const sumSquares = small.reduce((sum, val) => sum + val * val, 0);
        const largest = Math.sqrt(Math.max(0, 1 - sumSquares));

        // Insert the largest component back
        const components = [];
        let smallIndex = 0;
        for (let i = 0; i < 4; i++) {
            if (i === maxIndex) {
                components.push(largest);
            } else {
                components.push(small[smallIndex++]);
            }
        }

        return {
            x: components[0],
            y: components[1],
            z: components[2],
            w: components[3]
        };
    }

    /**
     * Gets compression statistics
     * @param {*} original - Original data
     * @param {*} compressed - Compressed data
     * @returns {Object} Statistics
     */
    static getCompressionStats(original, compressed) {
        const originalSize = typeof original === 'string' ?
            original.length :
            (original instanceof ArrayBuffer ? original.byteLength : JSON.stringify(original).length);

        const compressedSize = typeof compressed === 'string' ?
            compressed.length :
            (compressed instanceof ArrayBuffer ? compressed.byteLength : JSON.stringify(compressed).length);

        const ratio = originalSize > 0 ? compressedSize / originalSize : 0;
        const savings = originalSize - compressedSize;
        const savingsPercent = originalSize > 0 ? (savings / originalSize) * 100 : 0;

        return {
            originalSize,
            compressedSize,
            savings,
            savingsPercent: savingsPercent.toFixed(2) + '%',
            ratio: ratio.toFixed(2)
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Compression;
}
