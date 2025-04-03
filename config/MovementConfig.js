// === puppeteer/config/MovementConfig.js ===
export const DEFAULT_MOVEMENT_CONFIG = {
  maxSpeed: 5,             // Maximum movement speed (units per second)
  acceleration: 20,        // Acceleration rate (units per second squared)
  drag: 10,                // Drag coefficient when not providing input
  frictionFactor: 0.8,     // Instant friction factor when stopping input
  rotationSpeed: 10,       // Rotation speed (radians per second)
  jumpForce: 8,            // Initial upward velocity for jumps
  gravity: 20,             // Gravity strength
  airControlFactor: 0.3,   // Multiplier for air control (0-1)
  sprintMultiplier: 1.6,   // Speed multiplier when sprinting
  crouchMultiplier: 0.6,   // Speed multiplier when crouching
  maxDeltaTime: 0.1,       // Maximum delta time to avoid physics issues
  autoRotate: true,        // Whether to automatically rotate to face movement direction
  cameraTransform: null,   // Reference to camera transform for relative movement
  stepHeight: 0.3,         // Maximum height to automatically step up
  slideOnSlopes: true,     // Whether to slide down slopes
  maxSlideAngle: 50,       // Maximum angle in degrees before sliding occurs
  physics: {
    collisionRadius: 0.5,  // Collision radius for simple physics
    height: 2,             // Height for capsule collision
    mass: 1,               // Mass for physics calculations
    restitution: 0.1       // Bounciness factor
  }
};