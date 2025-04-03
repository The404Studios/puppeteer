export default class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x; this.y = y; this.z = z;
  }

  add(v) { return new Vector3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return new Vector3(this.x - v.x, this.y - v.y, this.z - v.z); }
  multiplyScalar(s) { return new Vector3(this.x * s, this.y * s, this.z * s); }

  lerp(v, t) {
    return new Vector3(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t,
      this.z + (v.z - this.z) * t
    );
  }

  static fromTHREE(v) {
    return new Vector3(v.x, v.y, v.z);
  }

  toTHREE() {
    return new THREE.Vector3(this.x, this.y, this.z);
  }
}
