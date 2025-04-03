import Vector3 from '../core/Vector3.js';

export default class MovementController {
  constructor(speed = 5) {
    this.position = new Vector3();
    this.direction = new Vector3(0, 0, 1); // forward
    this.speed = speed;
  }

  moveForward(dt) {
    const movement = this.direction.multiplyScalar(this.speed * dt);
    this.position = this.position.add(movement);
  }

  setDirection(dir) {
    this.direction = dir;
  }

  getPosition() {
    return this.position;
  }
}
