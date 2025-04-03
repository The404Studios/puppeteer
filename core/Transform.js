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