/**
 * AdvancedInterpolation.js
 * Advanced interpolation methods for silky-smooth motion
 * Includes Hermite, Catmull-Rom, and cubic Bezier splines
 * Prevents sliding and maintains C1 continuity
 */

class AdvancedInterpolation {
    /**
     * Cubic Hermite interpolation for positions
     * Maintains velocity continuity (C1 continuous)
     * @param {Object} p0 - Point before start
     * @param {Object} p1 - Start point
     * @param {Object} p2 - End point
     * @param {Object} p3 - Point after end
     * @param {number} t - Interpolation parameter [0, 1]
     * @param {number} tension - Tension parameter (default: 0, range: -1 to 1)
     * @returns {Object} Interpolated position
     */
    static hermite(p0, p1, p2, p3, t, tension = 0) {
        const t2 = t * t;
        const t3 = t2 * t;

        // Hermite basis functions
        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        // Calculate tangents with tension
        const m1 = this._calculateTangent(p0, p1, p2, tension);
        const m2 = this._calculateTangent(p1, p2, p3, tension);

        return {
            x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x,
            y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y,
            z: h00 * p1.z + h10 * m1.z + h01 * p2.z + h11 * m2.z
        };
    }

    /**
     * Catmull-Rom spline interpolation
     * Special case of Hermite with tension = 0
     * @param {Object} p0 - Point before start
     * @param {Object} p1 - Start point
     * @param {Object} p2 - End point
     * @param {Object} p3 - Point after end
     * @param {number} t - Interpolation parameter [0, 1]
     * @param {number} alpha - Parameterization (0=uniform, 0.5=centripetal, 1=chordal)
     * @returns {Object} Interpolated position
     */
    static catmullRom(p0, p1, p2, p3, t, alpha = 0.5) {
        // Calculate segment lengths for parameterization
        const dt0 = Math.pow(this._distance(p0, p1), alpha);
        const dt1 = Math.pow(this._distance(p1, p2), alpha);
        const dt2 = Math.pow(this._distance(p2, p3), alpha);

        // Handle degenerate cases
        if (dt1 < 1e-4) return p1;
        if (dt0 < 1e-4) dt0 = 1.0;
        if (dt2 < 1e-4) dt2 = 1.0;

        // Calculate tangents
        const m1 = {
            x: (p2.x - p1.x) / dt1 - (p1.x - p0.x) / dt0 + (p1.x - p0.x) / (dt0 + dt1),
            y: (p2.y - p1.y) / dt1 - (p1.y - p0.y) / dt0 + (p1.y - p0.y) / (dt0 + dt1),
            z: (p2.z - p1.z) / dt1 - (p1.z - p0.z) / dt0 + (p1.z - p0.z) / (dt0 + dt1)
        };

        const m2 = {
            x: (p3.x - p2.x) / dt2 - (p2.x - p1.x) / dt1 + (p2.x - p1.x) / (dt1 + dt2),
            y: (p3.y - p2.y) / dt2 - (p2.y - p1.y) / dt1 + (p2.y - p1.y) / (dt1 + dt2),
            z: (p3.z - p2.z) / dt2 - (p2.z - p1.z) / dt1 + (p2.z - p1.z) / (dt1 + dt2)
        };

        // Scale tangents
        const scale1 = dt1;
        const scale2 = dt1;

        m1.x *= scale1; m1.y *= scale1; m1.z *= scale1;
        m2.x *= scale2; m2.y *= scale2; m2.z *= scale2;

        // Hermite interpolation
        const t2 = t * t;
        const t3 = t2 * t;

        const h00 = 2 * t3 - 3 * t2 + 1;
        const h10 = t3 - 2 * t2 + t;
        const h01 = -2 * t3 + 3 * t2;
        const h11 = t3 - t2;

        return {
            x: h00 * p1.x + h10 * m1.x + h01 * p2.x + h11 * m2.x,
            y: h00 * p1.y + h10 * m1.y + h01 * p2.y + h11 * m2.y,
            z: h00 * p1.z + h10 * m1.z + h01 * p2.z + h11 * m2.z
        };
    }

    /**
     * Cubic Bezier interpolation
     * @param {Object} p0 - Start point
     * @param {Object} p1 - First control point
     * @param {Object} p2 - Second control point
     * @param {Object} p3 - End point
     * @param {number} t - Interpolation parameter [0, 1]
     * @returns {Object} Interpolated position
     */
    static cubicBezier(p0, p1, p2, p3, t) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        return {
            x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
            y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
            z: uuu * p0.z + 3 * uu * t * p1.z + 3 * u * tt * p2.z + ttt * p3.z
        };
    }

    /**
     * Squad (Spherical Cubic) interpolation for quaternions
     * Smooth C1 continuous rotation interpolation
     * @param {Object} q0 - Quaternion before start
     * @param {Object} q1 - Start quaternion
     * @param {Object} q2 - End quaternion
     * @param {Object} q3 - Quaternion after end
     * @param {number} t - Interpolation parameter [0, 1]
     * @returns {Object} Interpolated quaternion
     */
    static squad(q0, q1, q2, q3, t) {
        // Calculate intermediate control points
        const s1 = this._squadControlPoint(q0, q1, q2);
        const s2 = this._squadControlPoint(q1, q2, q3);

        // Double slerp
        const slerpA = this.slerp(q1, q2, t);
        const slerpB = this.slerp(s1, s2, t);

        return this.slerp(slerpA, slerpB, 2 * t * (1 - t));
    }

    /**
     * Calculate Squad control point
     * @private
     */
    static _squadControlPoint(q0, q1, q2) {
        const invQ1 = this._inverseQuaternion(q1);
        const logQ0Q1 = this._quaternionLog(this._multiplyQuaternions(invQ1, q0));
        const logQ2Q1 = this._quaternionLog(this._multiplyQuaternions(invQ1, q2));

        const sum = {
            x: logQ0Q1.x + logQ2Q1.x,
            y: logQ0Q1.y + logQ2Q1.y,
            z: logQ0Q1.z + logQ2Q1.z,
            w: logQ0Q1.w + logQ2Q1.w
        };

        const scaled = {
            x: -sum.x / 4,
            y: -sum.y / 4,
            z: -sum.z / 4,
            w: -sum.w / 4
        };

        const expScaled = this._quaternionExp(scaled);
        return this._multiplyQuaternions(q1, expScaled);
    }

    /**
     * Spherical linear interpolation for quaternions
     * @param {Object} q1 - Start quaternion
     * @param {Object} q2 - End quaternion
     * @param {number} t - Interpolation parameter [0, 1]
     * @returns {Object} Interpolated quaternion
     */
    static slerp(q1, q2, t) {
        let dot = q1.x * q2.x + q1.y * q2.y + q1.z * q2.z + q1.w * q2.w;

        // Ensure shortest path
        let q2x = q2.x, q2y = q2.y, q2z = q2.z, q2w = q2.w;
        if (dot < 0) {
            q2x = -q2x; q2y = -q2y; q2z = -q2z; q2w = -q2w;
            dot = -dot;
        }

        dot = Math.min(Math.max(dot, -1), 1);

        // Use linear interpolation for very close quaternions
        if (dot > 0.9995) {
            const result = {
                x: q1.x + (q2x - q1.x) * t,
                y: q1.y + (q2y - q1.y) * t,
                z: q1.z + (q2z - q1.z) * t,
                w: q1.w + (q2w - q1.w) * t
            };
            return this._normalizeQuaternion(result);
        }

        const theta = Math.acos(dot);
        const sinTheta = Math.sin(theta);
        const a = Math.sin((1 - t) * theta) / sinTheta;
        const b = Math.sin(t * theta) / sinTheta;

        return {
            x: q1.x * a + q2x * b,
            y: q1.y * a + q2y * b,
            z: q1.z * a + q2z * b,
            w: q1.w * a + q2w * b
        };
    }

    /**
     * Smooth step interpolation (ease in/out)
     * @param {number} t - Parameter [0, 1]
     * @returns {number} Smoothed parameter
     */
    static smoothStep(t) {
        return t * t * (3 - 2 * t);
    }

    /**
     * Smoother step interpolation (Ken Perlin's improved version)
     * @param {number} t - Parameter [0, 1]
     * @returns {number} Smoothed parameter
     */
    static smootherStep(t) {
        return t * t * t * (t * (t * 6 - 15) + 10);
    }

    /**
     * Cosine interpolation
     * @param {number} a - Start value
     * @param {number} b - End value
     * @param {number} t - Parameter [0, 1]
     * @returns {number} Interpolated value
     */
    static cosineInterp(a, b, t) {
        const mu2 = (1 - Math.cos(t * Math.PI)) / 2;
        return a * (1 - mu2) + b * mu2;
    }

    /**
     * Exponential ease out
     * @param {number} t - Parameter [0, 1]
     * @returns {number} Eased parameter
     */
    static expEaseOut(t) {
        return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    /**
     * Exponential ease in
     * @param {number} t - Parameter [0, 1]
     * @returns {number} Eased parameter
     */
    static expEaseIn(t) {
        return t === 0 ? 0 : Math.pow(2, 10 * (t - 1));
    }

    /**
     * Calculate tangent for Hermite interpolation
     * @private
     */
    static _calculateTangent(p0, p1, p2, tension) {
        const scale = (1 - tension) / 2;
        return {
            x: scale * (p2.x - p0.x),
            y: scale * (p2.y - p0.y),
            z: scale * (p2.z - p0.z)
        };
    }

    /**
     * Calculate distance between two points
     * @private
     */
    static _distance(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    /**
     * Quaternion logarithm
     * @private
     */
    static _quaternionLog(q) {
        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);

        if (length < 1e-6) {
            return { x: 0, y: 0, z: 0, w: Math.log(q.w) };
        }

        const theta = Math.atan2(length, q.w);
        const scale = theta / length;

        return {
            x: q.x * scale,
            y: q.y * scale,
            z: q.z * scale,
            w: Math.log(q.w * q.w + length * length) / 2
        };
    }

    /**
     * Quaternion exponential
     * @private
     */
    static _quaternionExp(q) {
        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z);

        if (length < 1e-6) {
            return { x: 0, y: 0, z: 0, w: Math.exp(q.w) };
        }

        const expW = Math.exp(q.w);
        const scale = expW * Math.sin(length) / length;

        return {
            x: q.x * scale,
            y: q.y * scale,
            z: q.z * scale,
            w: expW * Math.cos(length)
        };
    }

    /**
     * Inverse quaternion
     * @private
     */
    static _inverseQuaternion(q) {
        const lengthSq = q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w;
        return {
            x: -q.x / lengthSq,
            y: -q.y / lengthSq,
            z: -q.z / lengthSq,
            w: q.w / lengthSq
        };
    }

    /**
     * Multiply quaternions
     * @private
     */
    static _multiplyQuaternions(q1, q2) {
        return {
            x: q1.w * q2.x + q1.x * q2.w + q1.y * q2.z - q1.z * q2.y,
            y: q1.w * q2.y - q1.x * q2.z + q1.y * q2.w + q1.z * q2.x,
            z: q1.w * q2.z + q1.x * q2.y - q1.y * q2.x + q1.z * q2.w,
            w: q1.w * q2.w - q1.x * q2.x - q1.y * q2.y - q1.z * q2.z
        };
    }

    /**
     * Normalize quaternion
     * @private
     */
    static _normalizeQuaternion(q) {
        const length = Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
        if (length === 0) return { x: 0, y: 0, z: 0, w: 1 };
        return {
            x: q.x / length,
            y: q.y / length,
            z: q.z / length,
            w: q.w / length
        };
    }

    /**
     * Interpolate transform using advanced methods
     * @param {Array} transforms - Array of at least 4 transforms [p0, p1, p2, p3]
     * @param {number} t - Interpolation parameter [0, 1] (between p1 and p2)
     * @param {string} method - Interpolation method ('hermite', 'catmullrom', 'squad')
     * @returns {Object} Interpolated transform
     */
    static interpolateTransform(transforms, t, method = 'catmullrom') {
        if (transforms.length < 4) {
            throw new Error('Need at least 4 transforms for advanced interpolation');
        }

        const [t0, t1, t2, t3] = transforms;

        let position, rotation;

        // Interpolate position
        if (method === 'hermite') {
            position = this.hermite(t0.position, t1.position, t2.position, t3.position, t);
        } else if (method === 'catmullrom') {
            position = this.catmullRom(t0.position, t1.position, t2.position, t3.position, t);
        } else {
            // Fallback to simple lerp
            position = {
                x: t1.position.x + (t2.position.x - t1.position.x) * t,
                y: t1.position.y + (t2.position.y - t1.position.y) * t,
                z: t1.position.z + (t2.position.z - t1.position.z) * t
            };
        }

        // Interpolate rotation
        if (method === 'squad') {
            rotation = this.squad(t0.rotation, t1.rotation, t2.rotation, t3.rotation, t);
        } else {
            rotation = this.slerp(t1.rotation, t2.rotation, t);
        }

        return {
            position,
            rotation,
            scale: t1.scale || { x: 1, y: 1, z: 1 }
        };
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedInterpolation;
}
