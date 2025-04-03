// === puppeteer/core/Quaternion.js ===
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
    return new Quaternion(0, 0, 0, 1);
  }
  
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  
  normalize() {
    let l = this.length();
    if (l === 0) {
      return new Quaternion(0, 0, 0, 1);
    }
    l = 1 / l;
    return new Quaternion(this._x * l, this._y * l, this._z * l, this._w * l);
  }
  
  multiply(q) {
    return new Quaternion(
      this._w * q.x + this._x * q.w + this._y * q.z - this._z * q.y,
      this._w * q.y - this._x * q.z + this._y * q.w + this._z * q.x,
      this._w * q.z + this._x * q.y - this._y * q.x + this._z * q.w,
      this._w * q.w - this._x * q.x - this._y * q.y - this._z * q.z
    );
  }
  
  inverse() {
    return new Quaternion(-this._x, -this._y, -this._z, this._w);
  }
  
  setFromAxisAngle(axis, angle) {
    const halfAngle = angle / 2;
    const s = Math.sin(halfAngle);
    
    const normalized = axis.length() === 1 ? axis : axis.normalize();
    
    this._x = normalized.x * s;
    this._y = normalized.y * s;
    this._z = normalized.z * s;
    this._w = Math.cos(halfAngle);
    this._isDirty = true;
    
    return this;
  }
  
  setFromEuler(x, y, z) {
    const c1 = Math.cos(x / 2);
    const c2 = Math.cos(y / 2);
    const c3 = Math.cos(z / 2);
    const s1 = Math.sin(x / 2);
    const s2 = Math.sin(y / 2);
    const s3 = Math.sin(z / 2);
    
    this._x = s1 * c2 * c3 + c1 * s2 * s3;
    this._y = c1 * s2 * c3 - s1 * c2 * s3;
    this._z = c1 * c2 * s3 + s1 * s2 * c3;
    this._w = c1 * c2 * c3 - s1 * s2 * s3;
    this._isDirty = true;
    
    return this;
  }
  
  setFromRotationMatrix(m) {
    // TODO: Implement rotation matrix to quaternion conversion
    this._isDirty = true;
    return this;
  }

  slerp(to, t) {
    if (t === 0) return this.clone();
    if (t === 1) return to.clone();
    
    const cosHalfTheta = this._w * to.w + this._x * to.x + this._y * to.y + this._z * to.z;
    
    let halfTheta = Math.acos(Math.abs(Math.min(Math.max(cosHalfTheta, -1), 1)));
    let sinHalfTheta = Math.sqrt(1.0 - cosHalfTheta * cosHalfTheta);
    
    if (Math.abs(sinHalfTheta) < 0.001) {
      return new Quaternion(
        this._x * 0.5 + to.x * 0.5,
        this._y * 0.5 + to.y * 0.5,
        this._z * 0.5 + to.z * 0.5,
        this._w * 0.5 + to.w * 0.5
      ).normalize();
    }
    
    const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta;
    const ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    
    return new Quaternion(
      this._x * ratioA + to.x * ratioB,
      this._y * ratioA + to.y * ratioB,
      this._z * ratioA + to.z * ratioB,
      this._w * ratioA + to.w * ratioB
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

  static fromTHREE(q) {
    return new Quaternion(q.x, q.y, q.z, q.w);
  }

  toTHREE() {
    return new THREE.Quaternion(this._x, this._y, this._z, this._w);
  }
  
  static fromEuler(x, y, z) {
    const q = new Quaternion();
    return q.setFromEuler(x, y, z);
  }
  
  static fromAxisAngle(axis, angle) {
    const q = new Quaternion();
    return q.setFromAxisAngle(axis, angle);
  }
}