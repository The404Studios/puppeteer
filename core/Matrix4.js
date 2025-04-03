// === puppeteer/core/Transform.js ===
import Vector3 from './Vector3.js';
import Quaternion from './Quaternion.js';
import Matrix4 from './Matrix4.js';

export default class Transform {
  constructor(position = new Vector3(), rotation = new Quaternion(), scale = new Vector3(1, 1, 1)) {
    this._position = position;
    this._rotation = rotation;
    this._scale = scale;
    this._matrix = null;
    this._isDirty = true;
  }
  
  get position() { return this._position; }
  set position(value) { 
    this._position = value; 
    this._isDirty = true; 
  }
  
  get rotation() { return this._rotation; }
  set rotation(value) { 
    this._rotation = value; 
    this._isDirty = true; 
  }
  
  get scale() { return this._scale; }
  set scale(value) { 
    this._scale = value; 
    this._isDirty = true; 
  }
  
  getMatrix() {
    if (this._isDirty || this._matrix === null) {
      this._matrix = Matrix4.compose(this._position, this._rotation, this._scale);
      this._isDirty = false;
    }
    return this._matrix;
  }
  
  setMatrix(matrix) {
    matrix.decompose(this._position, this._rotation, this._scale);
    this._matrix = matrix;
    this._isDirty = false;
    return this;
  }
  
  clone() {
    return new Transform(
      this._position.clone(), 
      this._rotation.clone(), 
      this._scale.clone()
    );
  }
  
  copy(transform) {
    this._position = transform.position.clone();
    this._rotation = transform.rotation.clone();
    this._scale = transform.scale.clone();
    this._isDirty = true;
    return this;
  }
  
  lerp(to, t) {
    return new Transform(
      this._position.lerp(to.position, t),
      this._rotation.slerp(to.rotation, t),
      this._scale.lerp(to.scale, t)
    );
  }
  
  lookAt(target, up = Vector3.up()) {
    const matrix = Matrix4.lookAt(this._position, target, up);
    const rotationMatrix = matrix.extractRotation();
    this._rotation.setFromRotationMatrix(rotationMatrix);
    this._isDirty = true;
    return this;
  }
  
  serialize() {
    return {
      position: {
        x: this._position.x,
        y: this._position.y,
        z: this._position.z
      },
      rotation: {
        x: this._rotation.x,
        y: this._rotation.y,
        z: this._rotation.z,
        w: this._rotation.w
      },
      scale: {
        x: this._scale.x,
        y: this._scale.y,
        z: this._scale.z
      }
    };
  }
  
  static deserialize(data) {
    return new Transform(
      new Vector3(data.position.x, data.position.y, data.position.z),
      new Quaternion(data.rotation.x, data.rotation.y, data.rotation.z, data.rotation.w),
      new Vector3(data.scale.x, data.scale.y, data.scale.z)
    );
  }
}

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
    // This method assumes the upper 3x3 of the matrix is a pure rotation matrix (i.e, unscaled)
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
    // Extract translation
    position.x = this.elements[12];
    position.y = this.elements[13];
    position.z = this.elements[14];
    
    // Extract scale
    // TODO: Implement scale extraction
    scale.x = 1;
    scale.y = 1;
    scale.z = 1;
    
    // Extract rotation
    // TODO: Implement rotation extraction to quaternion
    
    return this;
  }
  
  static compose(position, quaternion, scale) {
    const m = new Matrix4();
    
    // TODO: Implement matrix composition from position, quaternion, and scale
    
    return m;
  }
  
  static lookAt(eye, target, up) {
    const m = new Matrix4();
    
    // TODO: Implement lookAt matrix construction
    
    return m;
  }
}