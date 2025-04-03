// === puppeteer/core/Matrix4.js ===
import Vector3 from './Vector3.js';
import Quaternion from './Quaternion.js';

export default class Matrix4 {
  constructor() {
    this.elements = [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ];
  }
  
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    const e = this.elements;
    
    e[0] = n11; e[4] = n12; e[8] = n13; e[12] = n14;
    e[1] = n21; e[5] = n22; e[9] = n23; e[13] = n24;
    e[2] = n31; e[6] = n32; e[10] = n33; e[14] = n34;
    e[3] = n41; e[7] = n42; e[11] = n43; e[15] = n44;
    
    return this;
  }
  
  identity() {
    this.set(
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    );
    
    return this;
  }
  
  clone() {
    return new Matrix4().fromArray(this.elements);
  }
  
  copy(m) {
    const te = this.elements;
    const me = m.elements;
    
    for (let i = 0; i < 16; i++) {
      te[i] = me[i];
    }
    
    return this;
  }
  
  fromArray(array, offset = 0) {
    for (let i = 0; i < 16; i++) {
      this.elements[i] = array[i + offset];
    }
    
    return this;
  }
  
  toArray(array = [], offset = 0) {
    const te = this.elements;
    
    for (let i = 0; i < 16; i++) {
      array[i + offset] = te[i];
    }
    
    return array;
  }
  
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  
  multiplyMatrices(a, b) {
    const ae = a.elements;
    const be = b.elements;
    const te = this.elements;
    
    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];
    
    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    
    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;
    
    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;
    
    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;
    
    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;
    
    return this;
  }
  
  setPosition(x, y, z) {
    const te = this.elements;
    
    if (x instanceof Vector3) {
      te[12] = x.x;
      te[13] = x.y;
      te[14] = x.z;
    } else {
      te[12] = x;
      te[13] = y;
      te[14] = z;
    }
    
    return this;
  }
  
  invert() {
    // Based on http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.htm
    const te = this.elements;
    
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15];
    
    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34;
    
    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    
    if (det === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    
    const detInv = 1 / det;
    
    te[0] = t11 * detInv;
    te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv;
    te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv;
    te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv;
    
    te[4] = t12 * detInv;
    te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv;
    te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv;
    te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv;
    
    te[8] = t13 * detInv;
    te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv;
    te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv;
    te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv;
    
    te[12] = t14 * detInv;
    te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv;
    te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv;
    te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv;
    
    return this;
  }
  
  extractRotation() {
    // This method extracts the rotation portion of the matrix
    const m = new Matrix4();
    const te = this.elements;
    
    const m11 = te[0], m12 = te[4], m13 = te[8];
    const m21 = te[1], m22 = te[5], m23 = te[9];
    const m31 = te[2], m32 = te[6], m33 = te[10];
    
    m.set(
      m11, m12, m13, 0,
      m21, m22, m23, 0,
      m31, m32, m33, 0,
      0, 0, 0, 1
    );
    
    return m;
  }
  
  decompose(position, quaternion, scale) {
    const te = this.elements;
    
    // Extract position
    position.x = te[12];
    position.y = te[13];
    position.z = te[14];
    
    // Extract scale by calculating the length of the columns
    let sx = new Vector3(te[0], te[1], te[2]).length();
    const sy = new Vector3(te[4], te[5], te[6]).length();
    const sz = new Vector3(te[8], te[9], te[10]).length();
    
    // If determinant is negative, we need to invert one scale
    const det = this.determinant();
    if (det < 0) sx = -sx;
    
    scale.x = sx;
    scale.y = sy;
    scale.z = sz;
    
    // Extract rotation
    // Scale the rotation part
    const invSX = 1 / sx;
    const invSY = 1 / sy;
    const invSZ = 1 / sz;
    
    const m11 = te[0] * invSX;
    const m12 = te[4] * invSY;
    const m13 = te[8] * invSZ;
    const m21 = te[1] * invSX;
    const m22 = te[5] * invSY;
    const m23 = te[9] * invSZ;
    const m31 = te[2] * invSX;
    const m32 = te[6] * invSY;
    const m33 = te[10] * invSZ;
    
    // http://www.euclideanspace.com/maths/geometry/rotations/conversions/matrixToQuaternion/index.htm
    const trace = m11 + m22 + m33;
    
    if (trace > 0) {
      const s = 0.5 / Math.sqrt(trace + 1.0);
      quaternion.w = 0.25 / s;
      quaternion.x = (m32 - m23) * s;
      quaternion.y = (m13 - m31) * s;
      quaternion.z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m11 - m22 - m33);
      quaternion.w = (m32 - m23) / s;
      quaternion.x = 0.25 * s;
      quaternion.y = (m12 + m21) / s;
      quaternion.z = (m13 + m31) / s;
    } else if (m22 > m33) {
      const s = 2.0 * Math.sqrt(1.0 + m22 - m11 - m33);
      quaternion.w = (m13 - m31) / s;
      quaternion.x = (m12 + m21) / s;
      quaternion.y = 0.25 * s;
      quaternion.z = (m23 + m32) / s;
    } else {
      const s = 2.0 * Math.sqrt(1.0 + m33 - m11 - m22);
      quaternion.w = (m21 - m12) / s;
      quaternion.x = (m13 + m31) / s;
      quaternion.y = (m23 + m32) / s;
      quaternion.z = 0.25 * s;
    }
    
    return this;
  }
  
  determinant() {
    const te = this.elements;
    
    const n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12];
    const n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13];
    const n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14];
    const n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    
    return (
      n41 * (
        n14 * n23 * n32 -
        n13 * n24 * n32 -
        n14 * n22 * n33 +
        n12 * n24 * n33 +
        n13 * n22 * n34 -
        n12 * n23 * n34
      ) +
      n42 * (
        n11 * n23 * n34 -
        n11 * n24 * n33 +
        n14 * n21 * n33 -
        n13 * n21 * n34 +
        n13 * n24 * n31 -
        n14 * n23 * n31
      ) +
      n43 * (
        n11 * n24 * n32 -
        n11 * n22 * n34 -
        n14 * n21 * n32 +
        n12 * n21 * n34 +
        n14 * n22 * n31 -
        n12 * n24 * n31
      ) +
      n44 * (
        n11 * n22 * n33 -
        n11 * n23 * n32 +
        n13 * n21 * n32 -
        n12 * n21 * n33 -
        n13 * n22 * n31 +
        n12 * n23 * n31
      )
    );
  }
  
  static compose(position, quaternion, scale) {
    const m = new Matrix4();
    const te = m.elements;
    
    // Set rotation component from quaternion
    const x = quaternion.x, y = quaternion.y, z = quaternion.z, w = quaternion.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    
    const sx = scale.x, sy = scale.y, sz = scale.z;
    
    te[0] = (1 - (yy + zz)) * sx;
    te[1] = (xy + wz) * sx;
    te[2] = (xz - wy) * sx;
    te[3] = 0;
    
    te[4] = (xy - wz) * sy;
    te[5] = (1 - (xx + zz)) * sy;
    te[6] = (yz + wx) * sy;
    te[7] = 0;
    
    te[8] = (xz + wy) * sz;
    te[9] = (yz - wx) * sz;
    te[10] = (1 - (xx + yy)) * sz;
    te[11] = 0;
    
    te[12] = position.x;
    te[13] = position.y;
    te[14] = position.z;
    te[15] = 1;
    
    return m;
  }
  
  static lookAt(eye, target, up) {
    const m = new Matrix4();
    const te = m.elements;
    
    const z = new Vector3().subVectors(eye, target).normalize();
    
    // If the distance is zero, z will be NaN
    if (z.lengthSquared() === 0) {
      z.z = 1;
    }
    
    const x = new Vector3().crossVectors(up, z).normalize();
    
    // If up and z are parallel, x will be zero
    if (x.lengthSquared() === 0) {
      z.x += 0.0001; // Slightly change z
      x.crossVectors(up, z).normalize();
    }
    
    const y = new Vector3().crossVectors(z, x);
    
    te[0] = x.x; te[4] = y.x; te[8] = z.x;
    te[1] = x.y; te[5] = y.y; te[9] = z.y;
    te[2] = x.z; te[6] = y.z; te[10] = z.z;
    
    return m;
  }
  
  // Helper method for Vector3
  subVectors(a, b) {
    return new Vector3(a.x - b.x, a.y - b.y, a.z - b.z);
  }
  
  // Helper method for Vector3
  crossVectors(a, b) {
    const ax = a.x, ay = a.y, az = a.z;
    const bx = b.x, by = b.y, bz = b.z;
    
    return new Vector3(
      ay * bz - az * by,
      az * bx - ax * bz,
      ax * by - ay * bx
    );
  }
  
  // Three.js compatibility methods
  fromThree(threeMatrix) {
    return this.fromArray(threeMatrix.elements);
  }
  
  toThree() {
    return new THREE.Matrix4().fromArray(this.elements);
  }
}