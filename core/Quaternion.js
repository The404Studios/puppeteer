// === puppeteer/core/Quaternion.js ===
import Vector3 from './Vector3.js';

export default class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this._x = x; this._y = y; this._z = z; this._w = w;
    this._euler = null;
    this._isDirty = true;
  }
  
  get x() { return this._x; }
  set x(value) { this._x = value; this._isDirty = true; }
  
  get y() { return this._y; }
  set y(value) { this._y = value; this._isDirty = true; }
  
  get z() { return this._z; }
  set z(value) { this._z = value; this._isDirty = true; }
  
  get w() { return this._w; }
  set w(value) { this._w = value; this._isDirty = true; }

  identity() {
    this._x = 0;
    this._y = 0;
    this._z = 0;
    this._w = 1;
    this._isDirty = true;
    return this;
  }
  
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  
  lengthSquared() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  
  normalize() {
    let l = this.length();
    if (l === 0) {
      this._x = 0;
      this._y = 0;
      this._z = 0;
      this._w = 1;
    } else {
      l = 1 / l;
      this._x *= l;
      this._y *= l;
      this._z *= l;
      this._w *= l;
    }
    this._isDirty = true;
    return this;
  }
  
  multiply(q) {
    return this.multiplyQuaternions(this, q);
  }
  
  multiplyQuaternions(a, b) {
    // Calculate quaternion multiplication a * b
    const qax = a._x, qay = a._y, qaz = a._z, qaw = a._w;
    const qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
    
    this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby;
    this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz;
    this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx;
    this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz;
    
    this._isDirty = true;
    return this;
  }
  
  inverse() {
    // Inverse = conjugate / length^2
    this.conjugate();
    
    const lenSq = this.lengthSquared();
    if (lenSq !== 0) {
      const invLenSq = 1 / lenSq;
      this._x *= invLenSq;
      this._y *= invLenSq;
      this._z *= invLenSq;
      this._w *= invLenSq;
    }
    
    this._isDirty = true;
    return this;
  }
  
  conjugate() {
    this._x = -this._x;
    this._y = -this._y;
    this._z = -this._z;
    this._isDirty = true;
    return this;
  }
  
  dot(q) {
    return this._x * q._x + this._y * q._y + this._z * q._z + this._w * q._w;
  }
  
  setFromAxisAngle(axis, angle) {
    // Algorithm for quaternion from axis and angle
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    
    if (axis.lengthSquared() === 0) return this;
    
    const normalizedAxis = axis.length() === 1 ? axis : axis.clone().normalize();
    
    this._x = normalizedAxis.x * s;
    this._y = normalizedAxis.y * s;
    this._z = normalizedAxis.z * s;
    this._w = Math.cos(halfAngle);
    
    this._isDirty = true;
    return this;
  }
  
  setFromEuler(x, y, z, order = 'XYZ') {
    // Standard Euler angles to quaternion conversion
    const cos = Math.cos;
    const sin = Math.sin;
    
    const c1 = cos(x / 2);
    const c2 = cos(y / 2);
    const c3 = cos(z / 2);
    
    const s1 = sin(x / 2);
    const s2 = sin(y / 2);
    const s3 = sin(z / 2);
    
    if (order === 'XYZ') {
      this._x = s1 * c2 * c3 + c1 * s2 * s3;
      this._y = c1 * s2 * c3 - s1 * c2 * s3;
      this._z = c1 * c2 * s3 + s1 * s2 * c3;
      this._w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === 'YXZ') {
      this._x = s1 * c2 * c3 + c1 * s2 * s3;
      this._y = c1 * s2 * c3 - s1 * c2 * s3;
      this._z = c1 * c2 * s3 - s1 * s2 * c3;
      this._w = c1 * c2 * c3 + s1 * s2 * s3;
    } else if (order === 'ZXY') {
      this._x = s1 * c2 * c3 - c1 * s2 * s3;
      this._y = c1 * s2 * c3 + s1 * c2 * s3;
      this._z = c1 * c2 * s3 + s1 * s2 * c3;
      this._w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === 'ZYX') {
      this._x = s1 * c2 * c3 - c1 * s2 * s3;
      this._y = c1 * s2 * c3 + s1 * c2 * s3;
      this._z = c1 * c2 * s3 - s1 * s2 * c3;
      this._w = c1 * c2 * c3 + s1 * s2 * s3;
    } else if (order === 'YZX') {
      this._x = s1 * c2 * c3 + c1 * s2 * s3;
      this._y = c1 * s2 * c3 + s1 * c2 * s3;
      this._z = c1 * c2 * s3 - s1 * s2 * c3;
      this._w = c1 * c2 * c3 - s1 * s2 * s3;
    } else if (order === 'XZY') {
      this._x = s1 * c2 * c3 - c1 * s2 * s3;
      this._y = c1 * s2 * c3 - s1 * c2 * s3;
      this._z = c1 * c2 * s3 + s1 * s2 * c3;
      this._w = c1 * c2 * c3 + s1 * s2 * s3;
    }
    
    this._isDirty = true;
    return this;
  }
  
  setFromRotationMatrix(m) {
    // Algorithm for rotation matrix to quaternion conversion
    const te = m.elements;
    
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    
    const trace = m11 + m22 + m33;
    
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      
      this._w = 0.25 / s;
      this._x = (m32 - m23) * s;
      this._y = (m13 - m31) * s;
      this._z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      
      this._w = (m32 - m23) / s;
      this._x = 0.25 * s;
      this._y = (m12 + m21) / s;
      this._z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      
      this._w = (m13 - m31) / s;
      this._x = (m12 + m21) / s;
      this._y = 0.25 * s;
      this._z = (m23 + m32) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      
      this._w = (m21 - m12) / s;
      this._x = (m13 + m31) / s;
      this._y = (m23 + m32) / s;
      this._z = 0.25 * s;
    }
    
    this._isDirty = true;
    return this;
  }
  
  slerp(qb, t) {
    if (t === 0) return this.clone();
    if (t === 1) return qb.clone();
    
    const x = this._x, y = this._y, z = this._z, w = this._w;
    
    // Calculate angle between quaternions
    let cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;
    
    // Use shortest path
    if (cosHalfTheta < 0) {
      cosHalfTheta = -cosHalfTheta;
      qb = new Quaternion(-qb._x, -qb._y, -qb._z, -qb._w);
    }
    
    // If very close, linearly interpolate and normalize
    if (cosHalfTheta >= 1.0) {
      return new Quaternion(
        x + t * (qb._x - x),
        y + t * (qb._y - y),
        z + t * (qb._z - z),
        w + t * (qb._w - w)
      ).normalize();
    }
    
    // Calculate spherical interpolation parameters
    const halfTheta = Math.acos(cosHalfTheta);
    const sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    
    // If theta = 180 degrees, rotation not unique
    // Avoid the singularity by epsilon approximation
    if (Math.abs(sinHalfTheta) < 0.001) {
      return new Quaternion(
        x * 0.5 + qb._x * 0.5,
        y * 0.5 + qb._y * 0.5,
        z * 0.5 + qb._z * 0.5,
        w * 0.5 + qb._w * 0.5
      ).normalize();
    }
    
    // Calculate interpolation ratios
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    
    // Create interpolated quaternion
    return new Quaternion(
      x * ratioA + qb._x * ratioB,
      y * ratioA + qb._y * ratioB,
      z * ratioA + qb._z * ratioB,
      w * ratioA + qb._w * ratioB
    );
  }
  
  clone() {
    return new Quaternion(this._x, this._y, this._z, this._w);
  }
  
  equals(q, epsilon = Number.EPSILON) {
    return (
      Math.abs(this._x - q.x) <= epsilon &&
      Math.abs(this._y - q.y) <= epsilon &&
      Math.abs(this._z - q.z) <= epsilon &&
      Math.abs(this._w - q.w) <= epsilon
    );
  }
  
  toArray(array = [], offset = 0) {
    array[offset] = this._x;
    array[offset + 1] = this._y;
    array[offset + 2] = this._z;
    array[offset + 3] = this._w;
    
    return array;
  }
  
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._w = array[offset + 3];
    
    this._isDirty = true;
    return this;
  }
  
  // Three.js compatibility methods
  static fromThree(threeQuaternion) {
    return new Quaternion(
      threeQuaternion.x,
      threeQuaternion.y,
      threeQuaternion.z,
      threeQuaternion.w
    );
  }
  
  toThree() {
    return new THREE.Quaternion(this._x, this._y, this._z, this._w);
  }
  
  static fromEuler(x, y, z, order = 'XYZ') {
    const q = new Quaternion();
    return q.setFromEuler(x, y, z, order);
  }
  
  static fromAxisAngle(axis, angle) {
    const q = new Quaternion();
    return q.setFromAxisAngle(axis, angle);
  }
}