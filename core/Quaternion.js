export default class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x; this.y = y; this.z = z; this.w = w;
  }

  slerp(to, t) {
    const fromQuat = new THREE.Quaternion(this.x, this.y, this.z, this.w);
    const toQuat = new THREE.Quaternion(to.x, to.y, to.z, to.w);
    fromQuat.slerp(toQuat, t);
    return new Quaternion(fromQuat.x, fromQuat.y, fromQuat.z, fromQuat.w);
  }

  static fromTHREE(q) {
    return new Quaternion(q.x, q.y, q.z, q.w);
  }

  toTHREE() {
    return new THREE.Quaternion(this.x, this.y, this.z, this.w);
  }
}
