import Vector3 from './Vector3.js';
import Quaternion from './Quaternion.js';

export default class Transform {
  constructor(position = new Vector3(), rotation = new Quaternion()) {
    this.position = position;
    this.rotation = rotation;
  }

  clone() {
    return new Transform(this.position, this.rotation);
  }
}
