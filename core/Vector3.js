// === puppeteer/core/Vector3.js ===
export default class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this._x = x; this._y = y; this._z = z;
    this._isDirty = true;
    this._length = null;
    this._lengthSquared = null;
  }

  get x() { return this._x; }
  set x(value) { this._x = value; this._isDirty = true; }
  
  get y() { return this._y; }
  set y(value) { this._y = value; this._isDirty = true; }
  
  get z() { return this._z; }
  set z(value) { this._z = value; this._isDirty = true; }

  add(v) { return new Vector3(this._x + v.x, this._y + v.y, this._z + v.z); }
  sub(v) { return new Vector3(this._x - v.x, this._y - v.y, this._z - v.z); }
  multiplyScalar(s) { return new Vector3(this._x * s, this._y * s, this._z * s); }
  divideScalar(s) { return s !== 0 ? this.multiplyScalar(1 / s) : new Vector3(); }

  dot(v) { return this._x * v.x + this._y * v.y + this._z * v.z; }
  
  cross(v) {
    return new Vector3(
      this._y * v.z - this._z * v.y,
      this._z * v.x - this._x * v.z,
      this._x * v.y - this._y * v.x
    );
  }
  
  lengthSquared() {
    if (this._isDirty || this._lengthSquared === null) {
      this._lengthSquared = this._x * this._x + this._y * this._y + this._z * this._z;
      this._isDirty = false;
    }
    return this._lengthSquared;
  }
  
  length() {
    if (this._isDirty || this._length === null) {
      this._length = Math.sqrt(this.lengthSquared());
    }
    return this._length;
  }
  
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  
  distanceToSquared(v) {
    const dx = this._x - v.x;
    const dy = this._y - v.y;
    const dz = this._z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }

  lerp(v, t) {
    return new Vector3(
      this._x + (v.x - this._x) * t,
      this._y + (v.y - this._y) * t,
      this._z + (v.z - this._z) * t
    );
  }
  
  lerpVectors(v1, v2, t) {
    return v1.lerp(v2, t);
  }

  applyQuaternion(q) {
    // Calculate quat * vector
    const ix = q.w * this._x + q.y * this._z - q.z * this._y;
    const iy = q.w * this._y + q.z * this._x - q.x * this._z;
    const iz = q.w * this._z + q.x * this._y - q.y * this._x;
    const iw = -q.x * this._x - q.y * this._y - q.z * this._z;

    // Calculate result * inverse quat
    return new Vector3(
      ix * q.w + iw * -q.x + iy * -q.z - iz * -q.y,
      iy * q.w + iw * -q.y + iz * -q.x - ix * -q.z,
      iz * q.w + iw * -q.z + ix * -q.y - iy * -q.x
    );
  }

  clone() {
    return new Vector3(this._x, this._y, this._z);
  }
  
  equals(v, epsilon = Number.EPSILON) {
    return (
      Math.abs(this._x - v.x) <= epsilon &&
      Math.abs(this._y - v.y) <= epsilon &&
      Math.abs(this._z - v.z) <= epsilon
    );
  }

  static fromTHREE(v) {
    return new Vector3(v.x, v.y, v.z);
  }

  toTHREE() {
    return new THREE.Vector3(this._x, this._y, this._z);
  }
  
  toArray() {
    return [this._x, this._y, this._z];
  }
  
  fromArray(array, offset = 0) {
    this._x = array[offset];
    this._y = array[offset + 1];
    this._z = array[offset + 2];
    this._isDirty = true;
    return this;
  }
  
  static zero() {
    return new Vector3(0, 0, 0);
  }
  
  static one() {
    return new Vector3(1, 1, 1);
  }
  
  static forward() {
    return new Vector3(0, 0, 1);
  }
  
  static up() {
    return new Vector3(0, 1, 0);
  }
  
  static right() {
    return new Vector3(1, 0, 0);
  }
}