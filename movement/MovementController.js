// === puppeteer/movement/MovementController.js ===
import Vector3 from '../core/Vector3.js';
import Quaternion from '../core/Quaternion.js';
import Transform from '../core/Transform.js';
import { now } from '../utils/Clock.js';
import { PhysicsSystem } from './PhysicsSystem.js';
import { CollisionSystem } from './CollisionSystem.js';
import { InputState } from './InputState.js';
import { DEFAULT_MOVEMENT_CONFIG } from '../config/MovementConfig.js';
import { log } from '../utils/Logger.js';
import EventEmitter from '../utils/EventEmitter.js';

export class MovementController extends EventEmitter {
  constructor(transform = new Transform(), config = {}) {
    super();
    this.transform = transform;
    this.config = { ...DEFAULT_MOVEMENT_CONFIG, ...config };
    
    this.velocity = new Vector3();
    this.acceleration = new Vector3();
    this.angularVelocity = new Vector3();
    
    this.inputState = new InputState();
    
    this.physics = new PhysicsSystem(this.config.physics);
    this.collision = new CollisionSystem();
    
    this.lastUpdateTime = now();
    this.isGrounded = false;
    this.isJumping = false;
    this.isCrouching = false;
    
    this.movementStates = new Map();
    this.currentState = 'idle';
    
    this.setupStates();
  }
  
  setupStates() {
    // Define state machine for different movement behaviors
    this.movementStates.set('idle', {
      enter: () => {
        this.velocity.x *= this.config.frictionFactor;
        this.velocity.z *= this.config.frictionFactor;
      },
      update: (dt) => {
        // Apply drag in idle state
        this.velocity.x *= (1 - this.config.drag * dt);
        this.velocity.z *= (1 - this.config.drag * dt);
        
        // Transition to walking if input received
        if (this.inputState.isMoving()) {
          this.changeState('walking');
        }
        
        // Transition to jumping if jump input received
        if (this.inputState.jump && this.isGrounded) {
          this.changeState('jumping');
        }
        
        // Transition to falling if not grounded
        if (!this.isGrounded && this.velocity.y < 0) {
          this.changeState('falling');
        }
      }
    });
    
    this.movementStates.set('walking', {
      enter: () => {
        // Walking entry logic
      },
      update: (dt) => {
        // Calculate movement direction based on input
        const moveDirection = this.calculateMoveDirection();
        
        // Apply acceleration in move direction
        const acceleration = moveDirection.multiplyScalar(this.config.acceleration);
        this.velocity.x += acceleration.x * dt;
        this.velocity.z += acceleration.z * dt;
        
        // Clamp to max speed
        const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (horizontalSpeed > this.config.maxSpeed) {
          const factor = this.config.maxSpeed / horizontalSpeed;
          this.velocity.x *= factor;
          this.velocity.z *= factor;
        }
        
        // Handle rotation based on movement direction
        if (this.config.autoRotate && moveDirection.lengthSquared() > 0.01) {
          const targetRotation = this.calculateTargetRotation(moveDirection);
          this.transform.rotation = this.smoothRotation(this.transform.rotation, targetRotation, dt);
        }
        
        // Transition to idle if no input
        if (!this.inputState.isMoving()) {
          this.changeState('idle');
        }
        
        // Transition to jumping if jump input received
        if (this.inputState.jump && this.isGrounded) {
          this.changeState('jumping');
        }
        
        // Transition to running if sprint is active
        if (this.inputState.sprint) {
          this.changeState('running');
        }
        
        // Transition to falling if not grounded
        if (!this.isGrounded && this.velocity.y < 0) {
          this.changeState('falling');
        }
      }
    });
    
    this.movementStates.set('running', {
      enter: () => {
        // Running entry logic
      },
      update: (dt) => {
        // Similar to walking but with higher max speed
        const moveDirection = this.calculateMoveDirection();
        
        const acceleration = moveDirection.multiplyScalar(this.config.acceleration * this.config.sprintMultiplier);
        this.velocity.x += acceleration.x * dt;
        this.velocity.z += acceleration.z * dt;
        
        const maxSpeed = this.config.maxSpeed * this.config.sprintMultiplier;
        const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        if (horizontalSpeed > maxSpeed) {
          const factor = maxSpeed / horizontalSpeed;
          this.velocity.x *= factor;
          this.velocity.z *= factor;
        }
        
        // Handle rotation
        if (this.config.autoRotate && moveDirection.lengthSquared() > 0.01) {
          const targetRotation = this.calculateTargetRotation(moveDirection);
          this.transform.rotation = this.smoothRotation(this.transform.rotation, targetRotation, dt);
        }
        
        // Transitions
        if (!this.inputState.sprint) {
          this.changeState('walking');
        }
        
        if (!this.inputState.isMoving()) {
          this.changeState('idle');
        }
        
        if (this.inputState.jump && this.isGrounded) {
          this.changeState('jumping');
        }
        
        if (!this.isGrounded && this.velocity.y < 0) {
          this.changeState('falling');
        }
      }
    });
    
    this.movementStates.set('jumping', {
      enter: () => {
        this.velocity.y = this.config.jumpForce;
        this.isGrounded = false;
        this.isJumping = true;
        this.emit('jump', { position: this.transform.position.clone() });
      },
      update: (dt) => {
        // Apply reduced air control
        const moveDirection = this.calculateMoveDirection();
        const airAcceleration = moveDirection.multiplyScalar(this.config.acceleration * this.config.airControlFactor);
        
        this.velocity.x += airAcceleration.x * dt;
        this.velocity.z += airAcceleration.z * dt;
        
        // Clamp horizontal velocity
        const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        const maxAirSpeed = this.config.maxSpeed * (this.inputState.sprint ? this.config.sprintMultiplier : 1);
        if (horizontalSpeed > maxAirSpeed) {
          const factor = maxAirSpeed / horizontalSpeed;
          this.velocity.x *= factor;
          this.velocity.z *= factor;
        }
        
        // Transition to falling when velocity becomes negative
        if (this.velocity.y < 0) {
          this.changeState('falling');
        }
      }
    });
    
    this.movementStates.set('falling', {
      enter: () => {
        this.isGrounded = false;
      },
      update: (dt) => {
        // Apply reduced air control (same as jumping)
        const moveDirection = this.calculateMoveDirection();
        const airAcceleration = moveDirection.multiplyScalar(this.config.acceleration * this.config.airControlFactor);
        
        this.velocity.x += airAcceleration.x * dt;
        this.velocity.z += airAcceleration.z * dt;
        
        // Clamp horizontal velocity
        const horizontalSpeed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
        const maxAirSpeed = this.config.maxSpeed * (this.inputState.sprint ? this.config.sprintMultiplier : 1);
        if (horizontalSpeed > maxAirSpeed) {
          const factor = maxAirSpeed / horizontalSpeed;
          this.velocity.x *= factor;
          this.velocity.z *= factor;
        }
        
        // Transition to idle or walking when grounded
        if (this.isGrounded) {
          this.changeState(this.inputState.isMoving() ? 'walking' : 'idle');
        }
      }
    });
  }
  
  changeState(newState) {
    if (this.currentState === newState) return;
    
    const oldState = this.currentState;
    this.currentState = newState;
    
    const state = this.movementStates.get(newState);
    if (state && state.enter) {
      state.enter();
    }
    
    this.emit('stateChange', { from: oldState, to: newState });
  }
  
  calculateMoveDirection() {
    // Create normalized movement vector from input
    const moveDirection = new Vector3();
    
    if (this.inputState.forward) moveDirection.z -= 1;
    if (this.inputState.backward) moveDirection.z += 1;
    if (this.inputState.left) moveDirection.x -= 1;
    if (this.inputState.right) moveDirection.x += 1;
    
    // Normalize only if length > 0
    const length = moveDirection.length();
    if (length > 0) {
      moveDirection.x /= length;
      moveDirection.z /= length;
    }
    
    // Apply camera rotation if available
    if (this.config.cameraTransform) {
      // Extract camera's forward and right vectors
      const cameraForward = new Vector3(0, 0, -1).applyQuaternion(this.config.cameraTransform.rotation);
      cameraForward.y = 0; // Project onto horizontal plane
      cameraForward = cameraForward.normalize();
      
      const cameraRight = new Vector3(1, 0, 0).applyQuaternion(this.config.cameraTransform.rotation);
      cameraRight.y = 0; // Project onto horizontal plane
      cameraRight = cameraRight.normalize();
      
      // Calculate movement direction relative to camera
      const relativeDirection = new Vector3();
      relativeDirection.add(cameraForward.multiplyScalar(-moveDirection.z));
      relativeDirection.add(cameraRight.multiplyScalar(moveDirection.x));
      
      if (relativeDirection.lengthSquared() > 0) {
        return relativeDirection.normalize();
      }
    }
    
    return moveDirection;
  }
  
  calculateTargetRotation(direction) {
    // Calculate rotation to face movement direction
    const angle = Math.atan2(direction.x, -direction.z);
    return Quaternion.fromEuler(0, angle, 0);
  }
  
  smoothRotation(current, target, dt) {
    // Slerp rotation at appropriate speed
    const t = Math.min(dt * this.config.rotationSpeed, 1);
    return current.slerp(target, t);
  }
  
  update(dt) {
    // Save current timestamp
    const currentTime = now();
    if (dt === undefined) {
      dt = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
    }
    this.lastUpdateTime = currentTime;
    
    // Cap delta time to avoid physics issues after pauses
    dt = Math.min(dt, this.config.maxDeltaTime);
    
    // Update current state
    const state = this.movementStates.get(this.currentState);
    if (state && state.update) {
      state.update(dt);
    }
    
    // Apply gravity
    if (!this.isGrounded || this.currentState === 'jumping') {
      this.velocity.y -= this.config.gravity * dt;
    }
    
    // Perform physics and collision checks
    this.physics.update(this, dt);
    this.isGrounded = this.collision.checkGrounded(this);
    
    // Update transform based on velocity
    const movement = this.velocity.multiplyScalar(dt);
    this.transform.position = this.transform.position.add(movement);
    
    // Reset jumping flag if grounded
    if (this.isGrounded && this.isJumping) {
      this.isJumping = false;
      this.emit('land', { position: this.transform.position.clone() });
    }
    
    // If we have angular velocity, apply it
    if (this.angularVelocity.lengthSquared() > 0) {
      // Convert angular velocity to quaternion change
      const angle = this.angularVelocity.length() * dt;
      const axis = this.angularVelocity.normalize();
      const rotationDelta = Quaternion.fromAxisAngle(axis, angle);
      
      // Apply to current rotation
      this.transform.rotation = rotationDelta.multiply(this.transform.rotation);
    }
    
    // Emit update event
    this.emit('update', {
      position: this.transform.position.clone(),
      rotation: this.transform.rotation.clone(),
      velocity: this.velocity.clone(),
      state: this.currentState,
      grounded: this.isGrounded,
      dt: dt
    });
    
    return this.transform;
  }
  
  setPosition(position) {
    this.transform.position = position instanceof Vector3 ? position : new Vector3(position.x, position.y, position.z);
    return this;
  }
  
  setRotation(rotation) {
    this.transform.rotation = rotation instanceof Quaternion ? rotation : new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    return this;
  }
  
  setTransform(transform) {
    this.transform = transform;
    return this;
  }
  
  setVelocity(velocity) {
    this.velocity = velocity instanceof Vector3 ? velocity : new Vector3(velocity.x, velocity.y, velocity.z);
    return this;
  }
  
  setInput(inputState) {
    this.inputState = inputState;
    return this;
  }
  
  getPosition() {
    return this.transform.position;
  }
  
  getRotation() {
    return this.transform.rotation;
  }
  
  getTransform() {
    return this.transform;
  }
  
  getVelocity() {
    return this.velocity;
  }
  
  moveForward(dt) {
    this.inputState.forward = true;
    this.update(dt);
    this.inputState.forward = false;
    return this;
  }
  
  moveBackward(dt) {
    this.inputState.backward = true;
    this.update(dt);
    this.inputState.backward = false;
    return this;
  }
  
  moveLeft(dt) {
    this.inputState.left = true;
    this.update(dt);
    this.inputState.left = false;
    return this;
  }
  
  moveRight(dt) {
    this.inputState.right = true;
    this.update(dt);
    this.inputState.right = false;
    return this;
  }
  
  jump() {
    if (this.isGrounded) {
      this.inputState.jump = true;
      this.update();
      this.inputState.jump = false;
    }
    return this;
  }
  
  sprint(active = true) {
    this.inputState.sprint = active;
    return this;
  }
  
  crouch(active = true) {
    this.inputState.crouch = active;
    if (active && !this.isCrouching) {
      this.isCrouching = true;
      // Adjust collider size, speed, etc.
    } else if (!active && this.isCrouching) {
      this.isCrouching = false;
      // Restore collider size, speed, etc.
    }
    return this;
  }
  
  rotate(angle, axis = new Vector3(0, 1, 0)) {
    const rotation = Quaternion.fromAxisAngle(axis, angle);
    this.transform.rotation = rotation.multiply(this.transform.rotation);
    return this;
  }
  
  lookAt(target) {
    this.transform.lookAt(target);
    return this;
  }
}

// === puppeteer/movement/InputState.js ===
export class InputState {
  constructor() {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.jump = false;
    this.sprint = false;
    this.crouch = false;
    this.primaryAction = false;
    this.secondaryAction = false;
    
    // Mouse/look input
    this.lookX = 0;
    this.lookY = 0;
    
    // Additional controls
    this.custom = new Map();
  }
  
  isMoving() {
    return this.forward || this.backward || this.left || this.right;
  }
  
  reset() {
    this.forward = false;
    this.backward = false;
    this.left = false;
    this.right = false;
    this.jump = false;
    this.sprint = false;
    this.crouch = false;
    this.primaryAction = false;
    this.secondaryAction = false;
    this.lookX = 0;
    this.lookY = 0;
    this.custom.clear();
  }
  
  setCustomInput(key, value) {
    this.custom.set(key, value);
  }
  
  getCustomInput(key) {
    return this.custom.get(key);
  }
  
  serialize() {
    const result = {
      forward: this.forward,
      backward: this.backward,
      left: this.left,
      right: this.right,
      jump: this.jump,
      sprint: this.sprint,
      crouch: this.crouch,
      primaryAction: this.primaryAction,
      secondaryAction: this.secondaryAction,
      lookX: this.lookX,
      lookY: this.lookY
    };
    
    // Add custom inputs
    for (const [key, value] of this.custom.entries()) {
      result[key] = value;
    }
    
    return result;
  }
  
  static deserialize(data) {
    const input = new InputState();
    
    input.forward = data.forward || false;
    input.backward = data.backward || false;
    input.left = data.left || false;
    input.right = data.right || false;
    input.jump = data.jump || false;
    input.sprint = data.sprint || false;
    input.crouch = data.crouch || false;
    input.primaryAction = data.primaryAction || false;
    input.secondaryAction = data.secondaryAction || false;
    input.lookX = data.lookX || 0;
    input.lookY = data.lookY || 0;
    
    // Add any other properties as custom inputs
    for (const [key, value] of Object.entries(data)) {
      if (!input.hasOwnProperty(key)) {
        input.custom.set(key, value);
      }
    }
    
    return input;
  }
}