// === puppeteer/movement/PhysicsSystem.js ===
import Vector3 from '../core/Vector3.js';
import { log } from '../utils/Logger.js';

export class PhysicsSystem {
  constructor(config = {}) {
    this.config = {
      gravity: 9.8,              // Gravity strength (units/s²)
      terminalVelocity: 53.0,    // Maximum fall speed (units/s)
      friction: 0.1,             // Ground friction coefficient
      airDrag: 0.01,             // Air resistance coefficient
      collisionIterations: 2,    // Physics collision iterations for accuracy
      maxPenetrationDepth: 0.5,  // Maximum penetration before correction
      physicsFPS: 60,            // Physics update rate
      collisionRadius: 0.5,      // Default collision radius
      height: 2.0,               // Default height for capsule collider
      mass: 1.0,                 // Default mass for physics calculations
      restitution: 0.1,          // Default bounciness factor
      stepHeight: 0.3,           // Maximum height to automatically step up
      slopeLimit: 45,            // Maximum slope angle in degrees
      ...config
    };
    
    this.surfaces = new Map();   // Registered surface types and properties
    this.rigidBodies = new Map(); // Tracked physics objects
    this.staticObjects = new Map(); // Static collision objects
    this.lastPhysicsTime = 0;    // Last physics update time
    
    // Register default surface types
    this.registerSurface('default', { friction: 0.1, restitution: 0.1 });
    this.registerSurface('ice', { friction: 0.01, restitution: 0.1 });
    this.registerSurface('mud', { friction: 0.5, restitution: 0.05 });
    this.registerSurface('metal', { friction: 0.2, restitution: 0.3 });
    this.registerSurface('wood', { friction: 0.3, restitution: 0.2 });
  }
  
  registerSurface(name, properties) {
    this.surfaces.set(name, {
      friction: properties.friction ?? this.config.friction,
      restitution: properties.restitution ?? this.config.restitution,
      sound: properties.sound || null,
      particle: properties.particle || null,
      metadata: properties.metadata || {}
    });
  }
  
  registerRigidBody(id, body) {
    this.rigidBodies.set(id, {
      transform: body.transform,
      velocity: body.velocity || new Vector3(),
      angularVelocity: body.angularVelocity || new Vector3(),
      mass: body.mass || this.config.mass,
      collider: body.collider || { 
        type: 'capsule',
        radius: this.config.collisionRadius,
        height: this.config.height
      },
      restitution: body.restitution || this.config.restitution,
      friction: body.friction || this.config.friction,
      isKinematic: body.isKinematic || false,
      isTrigger: body.isTrigger || false,
      surfaceType: body.surfaceType || 'default',
      userData: body.userData || {},
      forces: [],
      collisions: []
    });
  }
  
  unregisterRigidBody(id) {
    this.rigidBodies.delete(id);
  }
  
  registerStaticObject(id, object) {
    this.staticObjects.set(id, {
      transform: object.transform,
      collider: object.collider || { 
        type: 'box',
        size: new Vector3(1, 1, 1)
      },
      surfaceType: object.surfaceType || 'default',
      isTrigger: object.isTrigger || false,
      userData: object.userData || {}
    });
  }
  
  unregisterStaticObject(id) {
    this.staticObjects.delete(id);
  }
  
  // Update physics for a movement controller
  update(controller, dt) {
    // For movement controllers, we simplify physics to primarily handle
    // gravity, collisions, and surface interactions
    
    // Apply gravity if not grounded
    if (!controller.isGrounded) {
      // Check for maximum fall speed (terminal velocity)
      if (controller.velocity.y > -this.config.terminalVelocity) {
        controller.velocity.y -= this.config.gravity * dt;
        
        // Clamp to terminal velocity
        if (controller.velocity.y < -this.config.terminalVelocity) {
          controller.velocity.y = -this.config.terminalVelocity;
        }
      }
    }
    
    // Apply ground friction
    if (controller.isGrounded) {
      const frictionFactor = Math.pow(1 - this.config.friction, dt);
      controller.velocity.x *= frictionFactor;
      controller.velocity.z *= frictionFactor;
    } else {
      // Apply air drag
      const dragFactor = Math.pow(1 - this.config.airDrag, dt);
      controller.velocity.x *= dragFactor;
      controller.velocity.z *= dragFactor;
    }
    
    // Basic collision resolution
    this._handleControllerCollisions(controller, dt);
    
    return controller;
  }
  
  // Full physics update for all registered rigid bodies
  updatePhysics(dt) {
    // Update all rigid bodies
    for (const [id, body] of this.rigidBodies) {
      if (body.isKinematic) continue; // Skip kinematic bodies
      
      // Apply gravity
      body.velocity.y -= this.config.gravity * dt;
      
      // Apply accumulated forces
      for (const force of body.forces) {
        const acceleration = force.multiplyScalar(1 / body.mass);
        body.velocity.add(acceleration.multiplyScalar(dt));
      }
      body.forces = []; // Clear forces after applying
      
      // Apply velocity
      const movement = body.velocity.multiplyScalar(dt);
      body.transform.position = body.transform.position.add(movement);
      
      // Apply angular velocity if present
      if (body.angularVelocity.lengthSquared() > 0) {
        // TODO: Implement proper angular velocity application
      }
      
      // Clear collision list for this frame
      body.collisions = [];
    }
    
    // Detect and resolve collisions
    this._detectCollisions();
    this._resolveCollisions();
    
    this.lastPhysicsTime = performance.now();
  }
  
  _handleControllerCollisions(controller, dt) {
    // Simplified collision handling for movement controllers
    
    // Perform ground check
    controller.isGrounded = this._checkGrounded(controller);
    
    // Check for collisions with static objects
    for (const object of this.staticObjects.values()) {
      const collision = this._checkCollision(
        controller.transform.position,
        object.transform.position,
        { type: 'capsule', radius: this.config.collisionRadius, height: this.config.height },
        object.collider
      );
      
      if (collision) {
        // Resolve collision by moving character out of collision
        controller.transform.position = controller.transform.position.add(
          collision.normal.multiplyScalar(collision.depth)
        );
        
        // If we hit something from below while moving up, stop upward velocity
        if (collision.normal.y < -0.7 && controller.velocity.y > 0) {
          controller.velocity.y = 0;
        }
        
        // If we hit something from above while moving down, we're grounded
        if (collision.normal.y > 0.7 && controller.velocity.y < 0) {
          controller.isGrounded = true;
          controller.velocity.y = 0;
        }
        
        // Handle impacts with walls - slide along them
        if (Math.abs(collision.normal.y) < 0.7) {
          // Project velocity onto collision plane
          const dot = controller.velocity.dot(collision.normal);
          const projection = collision.normal.multiplyScalar(dot);
          controller.velocity = controller.velocity.sub(projection);
        }
      }
    }
    
    // Handle step detection
    if (controller.isGrounded && this.config.stepHeight > 0) {
      this._handleStepUp(controller);
    }
    
    return controller;
  }
  
  _checkGrounded(controller) {
    // Simple ground check - cast a short ray downward
    const rayStart = controller.transform.position.clone();
    const groundCheckDistance = 0.1; // Small distance below feet
    
    // Add a small offset to avoid self-collision with the capsule
    const characterHeight = this.config.height;
    rayStart.y -= (characterHeight / 2) - 0.01;
    
    // Check for static objects below
    for (const object of this.staticObjects.values()) {
      // Skip triggers
      if (object.isTrigger) continue;
      
      // Simple height check for ground
      const topOfObject = object.transform.position.y;
      const bottomOfCharacter = rayStart.y;
      
      if (Math.abs(topOfObject - bottomOfCharacter) <= groundCheckDistance) {
        // Check XZ overlap
        const characterPos = controller.transform.position;
        const objectPos = object.transform.position;
        
        const dx = characterPos.x - objectPos.x;
        const dz = characterPos.z - objectPos.z;
        const distanceSquared = dx * dx + dz * dz;
        
        const characterRadius = this.config.collisionRadius;
        let objectRadius = 0;
        
        if (object.collider.type === 'box') {
          objectRadius = Math.max(object.collider.size.x, object.collider.size.z) / 2;
        } else if (object.collider.type === 'sphere') {
          objectRadius = object.collider.radius;
        }
        
        const minDistance = characterRadius + objectRadius;
        
        if (distanceSquared <= minDistance * minDistance) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  _handleStepUp(controller) {
    // Check if there's a small step in front of the player that can be climbed
    const moveDirection = new Vector3(controller.velocity.x, 0, controller.velocity.z).normalize();
    
    // Skip if not moving horizontally
    if (moveDirection.lengthSquared() < 0.001) return;
    
    const stepRayStart = controller.transform.position.clone();
    // Offset ray start to the front of the character
    stepRayStart.x += moveDirection.x * this.config.collisionRadius;
    stepRayStart.z += moveDirection.z * this.config.collisionRadius;
    // Start ray at foot level
    stepRayStart.y -= this.config.height / 2;
    
    // Check for collision in front at foot level
    for (const object of this.staticObjects.values()) {
      // Skip triggers
      if (object.isTrigger) continue;
      
      // Check if there's an obstacle at foot level
      const collision = this._checkCollision(
        stepRayStart,
        object.transform.position,
        { type: 'sphere', radius: 0.1 }, // Small sphere for detection
        object.collider
      );
      
      if (collision) {
        // Now cast a ray from step height to see if there's space
        const stepRayStartHigh = stepRayStart.clone();
        stepRayStartHigh.y += this.config.stepHeight;
        
        const collisionHigh = this._checkCollision(
          stepRayStartHigh,
          object.transform.position,
          { type: 'sphere', radius: 0.1 },
          object.collider
        );
        
        // If there's no collision at step height, we can step up
        if (!collisionHigh) {
          controller.transform.position.y += this.config.stepHeight;
          return;
        }
      }
    }
  }
  
  _checkCollision(posA, posB, colliderA, colliderB) {
    // Basic collision detection between primitive shapes
    
    // Sphere-Sphere collision
    if (colliderA.type === 'sphere' && colliderB.type === 'sphere') {
      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dz = posB.z - posA.z;
      
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      const minDistance = colliderA.radius + colliderB.radius;
      
      if (distanceSquared < minDistance * minDistance) {
        const distance = Math.sqrt(distanceSquared);
        const depth = minDistance - distance;
        const normal = new Vector3(dx, dy, dz).divideScalar(distance);
        
        return {
          collided: true,
          depth,
          normal,
          pointA: posA.add(normal.multiplyScalar(colliderA.radius)),
          pointB: posB.sub(normal.multiplyScalar(colliderB.radius))
        };
      }
    }
    
    // Box-Box collision
    if (colliderA.type === 'box' && colliderB.type === 'box') {
      // AABB collision test
      const halfSizeA = colliderA.size.multiplyScalar(0.5);
      const halfSizeB = colliderB.size.multiplyScalar(0.5);
      
      const minA = new Vector3(
        posA.x - halfSizeA.x,
        posA.y - halfSizeA.y,
        posA.z - halfSizeA.z
      );
      
      const maxA = new Vector3(
        posA.x + halfSizeA.x,
        posA.y + halfSizeA.y,
        posA.z + halfSizeA.z
      );
      
      const minB = new Vector3(
        posB.x - halfSizeB.x,
        posB.y - halfSizeB.y,
        posB.z - halfSizeB.z
      );
      
      const maxB = new Vector3(
        posB.x + halfSizeB.x,
        posB.y + halfSizeB.y,
        posB.z + halfSizeB.z
      );
      
      // Check overlap
      if (
        minA.x <= maxB.x && maxA.x >= minB.x &&
        minA.y <= maxB.y && maxA.y >= minB.y &&
        minA.z <= maxB.z && maxA.z >= minB.z
      ) {
        // Calculate penetration depth for each axis
        const depthX = Math.min(maxA.x - minB.x, maxB.x - minA.x);
        const depthY = Math.min(maxA.y - minB.y, maxB.y - minA.y);
        const depthZ = Math.min(maxA.z - minB.z, maxB.z - minA.z);
        
        // Find minimum penetration axis
        let depth, normal;
        
        if (depthX <= depthY && depthX <= depthZ) {
          depth = depthX;
          normal = new Vector3(posA.x < posB.x ? -1 : 1, 0, 0);
        } else if (depthY <= depthX && depthY <= depthZ) {
          depth = depthY;
          normal = new Vector3(0, posA.y < posB.y ? -1 : 1, 0);
        } else {
          depth = depthZ;
          normal = new Vector3(0, 0, posA.z < posB.z ? -1 : 1);
        }
        
        return {
          collided: true,
          depth,
          normal,
          pointA: posA,
          pointB: posB
        };
      }
    }
    
    // Capsule-Box collision (simplified)
    if (colliderA.type === 'capsule' && colliderB.type === 'box') {
      // Simplify capsule to sphere at center for now
      // TODO: Implement full capsule collision
      
      const sphereCollider = { type: 'sphere', radius: colliderA.radius };
      return this._checkCollision(posA, posB, sphereCollider, colliderB);
    }
    
    // Box-Capsule collision
    if (colliderA.type === 'box' && colliderB.type === 'capsule') {
      // Swap parameters to reuse capsule-box code
      return this._checkCollision(posB, posA, colliderB, colliderA);
    }
    
    // Capsule-Capsule collision (simplified)
    if (colliderA.type === 'capsule' && colliderB.type === 'capsule') {
      // Simplify to sphere-sphere for now
      // TODO: Implement full capsule-capsule collision
      
      const sphereA = { type: 'sphere', radius: colliderA.radius };
      const sphereB = { type: 'sphere', radius: colliderB.radius };
      
      return this._checkCollision(posA, posB, sphereA, sphereB);
    }
    
    // Sphere-Box collision
    if (colliderA.type === 'sphere' && colliderB.type === 'box') {
      const halfSize = colliderB.size.multiplyScalar(0.5);
      
      // Find closest point on box to sphere center
      const closestPoint = new Vector3(
        Math.max(posB.x - halfSize.x, Math.min(posA.x, posB.x + halfSize.x)),
        Math.max(posB.y - halfSize.y, Math.min(posA.y, posB.y + halfSize.y)),
        Math.max(posB.z - halfSize.z, Math.min(posA.z, posB.z + halfSize.z))
      );
      
      // Check if closest point is within sphere
      const dx = closestPoint.x - posA.x;
      const dy = closestPoint.y - posA.y;
      const dz = closestPoint.z - posA.z;
      
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      
      if (distanceSquared < colliderA.radius * colliderA.radius) {
        const distance = Math.sqrt(distanceSquared);
        const depth = colliderA.radius - distance;
        
        // Calculate normal from closest point to sphere center
        let normal;
        if (distance > 0.0001) {
          normal = new Vector3(-dx / distance, -dy / distance, -dz / distance);
        } else {
          // If sphere center is inside box, use axis with minimal penetration
          const dx1 = Math.abs(posA.x - (posB.x - halfSize.x));
          const dx2 = Math.abs((posB.x + halfSize.x) - posA.x);
          const dy1 = Math.abs(posA.y - (posB.y - halfSize.y));
          const dy2 = Math.abs((posB.y + halfSize.y) - posA.y);
          const dz1 = Math.abs(posA.z - (posB.z - halfSize.z));
          const dz2 = Math.abs((posB.z + halfSize.z) - posA.z);
          
          const dxMin = Math.min(dx1, dx2);
          const dyMin = Math.min(dy1, dy2);
          const dzMin = Math.min(dz1, dz2);
          
          if (dxMin <= dyMin && dxMin <= dzMin) {
            normal = new Vector3(dx1 < dx2 ? -1 : 1, 0, 0);
          } else if (dyMin <= dxMin && dyMin <= dzMin) {
            normal = new Vector3(0, dy1 < dy2 ? -1 : 1, 0);
          } else {
            normal = new Vector3(0, 0, dz1 < dz2 ? -1 : 1);
          }
        }
        
        return {
          collided: true,
          depth,
          normal,
          pointA: posA.add(normal.multiplyScalar(-colliderA.radius)),
          pointB: closestPoint
        };
      }
    }
    
    // Box-Sphere collision
    if (colliderA.type === 'box' && colliderB.type === 'sphere') {
      // Swap parameters to reuse sphere-box code
      const result = this._checkCollision(posB, posA, colliderB, colliderA);
      
      // Invert normal direction
      if (result) {
        result.normal = result.normal.multiplyScalar(-1);
        const temp = result.pointA;
        result.pointA = result.pointB;
        result.pointB = temp;
      }
      
      return result;
    }
    
    // No collision or unsupported collider types
    return null;
  }
  
  _detectCollisions() {
    // Detect collisions between all rigid bodies and static objects
    for (const [idA, bodyA] of this.rigidBodies) {
      // Check collisions with other rigid bodies
      for (const [idB, bodyB] of this.rigidBodies) {
        if (idA === idB) continue; // Skip self-collision
        
        // Check for collision
        const collision = this._checkCollision(
          bodyA.transform.position,
          bodyB.transform.position,
          bodyA.collider,
          bodyB.collider
        );
        
        if (collision) {
          // Add to collision list for resolution
          bodyA.collisions.push({
            objectId: idB,
            isStatic: false,
            ...collision
          });
          
          // Add reverse collision for the other body
          bodyB.collisions.push({
            objectId: idA,
            isStatic: false,
            normal: collision.normal.multiplyScalar(-1),
            depth: collision.depth,
            pointA: collision.pointB,
            pointB: collision.pointA
          });
        }
      }
      
      // Check collisions with static objects
      for (const [idStatic, staticObj] of this.staticObjects) {
        const collision = this._checkCollision(
          bodyA.transform.position,
          staticObj.transform.position,
          bodyA.collider,
          staticObj.collider
        );
        
        if (collision) {
          // Add to collision list
          bodyA.collisions.push({
            objectId: idStatic,
            isStatic: true,
            ...collision
          });
        }
      }
    }
  }
  
  _resolveCollisions() {
    // Apply impulse-based collision resolution
    for (let i = 0; i < this.config.collisionIterations; i++) {
      for (const [id, body] of this.rigidBodies) {
        for (const collision of body.collisions) {
          if (collision.isStatic) {
            // Collision with static object - simple position correction
            if (!body.isKinematic) {
              body.transform.position = body.transform.position.add(
                collision.normal.multiplyScalar(collision.depth)
              );
              
              // Reflect velocity
              const staticObj = this.staticObjects.get(collision.objectId);
              const surfaceType = staticObj?.surfaceType || 'default';
              const surface = this.surfaces.get(surfaceType);
              
              const restitution = surface ? surface.restitution : this.config.restitution;
              const friction = surface ? surface.friction : this.config.friction;
              
              // Velocity along normal
              const velAlongNormal = body.velocity.dot(collision.normal);
              
              // Only reflect if moving towards the surface
              if (velAlongNormal < 0) {
                // Reflect velocity with restitution
                const normalVelocity = collision.normal.multiplyScalar(velAlongNormal);
                const tangentVelocity = body.velocity.sub(normalVelocity);
                
                // Apply friction to tangential component
                const frictionFactor = Math.max(0, 1 - friction);
                
                body.velocity = tangentVelocity.multiplyScalar(frictionFactor)
                  .sub(normalVelocity.multiplyScalar(restitution));
              }
            }
          } else {
            // Collision with another rigid body - handle only if this is the first occurrence
            const otherBody = this.rigidBodies.get(collision.objectId);
            
            if (id < collision.objectId) { // Only process each collision pair once
              if (!body.isKinematic && !otherBody.isKinematic) {
                // Position correction to prevent sinking
                const totalMass = body.mass + otherBody.mass;
                const bodyRatio = totalMass > 0 ? otherBody.mass / totalMass : 0.5;
                const otherRatio = totalMass > 0 ? body.mass / totalMass : 0.5;
                
                // Move objects apart based on mass ratio
                body.transform.position = body.transform.position.add(
                  collision.normal.multiplyScalar(collision.depth * bodyRatio)
                );
                
                otherBody.transform.position = otherBody.transform.position.add(
                  collision.normal.multiplyScalar(-collision.depth * otherRatio)
                );
                
                // Calculate impulse for realistic bounce
                const relativeVelocity = body.velocity.sub(otherBody.velocity);
                const velAlongNormal = relativeVelocity.dot(collision.normal);
                
                // Only resolve if objects are moving toward each other
                if (velAlongNormal < 0) {
                  const restitution = Math.min(body.restitution, otherBody.restitution);
                  
                  // Impulse scalar
                  let j = -(1 + restitution) * velAlongNormal;
                  j /= 1/body.mass + 1/otherBody.mass;
                  
                  // Apply impulse
                  const impulse = collision.normal.multiplyScalar(j);
                  
                  body.velocity = body.velocity.add(impulse.multiplyScalar(1 / body.mass));
                  otherBody.velocity = otherBody.velocity.sub(impulse.multiplyScalar(1 / otherBody.mass));
                  
                  // Apply friction
                  const friction = (body.friction + otherBody.friction) * 0.5;
                  
                  if (friction > 0) {
                    // Calculate tangent vector
                    let tangent = relativeVelocity.sub(
                      collision.normal.multiplyScalar(velAlongNormal)
                    );
                    
                    if (tangent.lengthSquared() > 0.0001) {
                      tangent = tangent.normalize();
                      
                      // Calculate friction impulse
                      const jt = -relativeVelocity.dot(tangent);
                      const frictionImpulse = tangent.multiplyScalar(jt * friction);
                      
                      // Apply friction impulse
                      body.velocity = body.velocity.add(
                        frictionImpulse.multiplyScalar(1 / body.mass)
                      );
                      
                      otherBody.velocity = otherBody.velocity.sub(
                        frictionImpulse.multiplyScalar(1 / otherBody.mass)
                      );
                    }
                  }
                }
              } else if (!body.isKinematic && otherBody.isKinematic) {
                // Collision with kinematic body - treat similar to static
                body.transform.position = body.transform.position.add(
                  collision.normal.multiplyScalar(collision.depth)
                );
                
                // Reflect velocity with restitution
                const velAlongNormal = body.velocity.dot(collision.normal);
                
                // Only reflect if moving towards the surface
                if (velAlongNormal < 0) {
                  const restitution = Math.min(body.restitution, otherBody.restitution);
                  const normalVelocity = collision.normal.multiplyScalar(velAlongNormal);
                  const tangentVelocity = body.velocity.sub(normalVelocity);
                  
                  // Apply friction to tangential component
                  const friction = (body.friction + otherBody.friction) * 0.5;
                  const frictionFactor = Math.max(0, 1 - friction);
                  
                  body.velocity = tangentVelocity.multiplyScalar(frictionFactor)
                    .sub(normalVelocity.multiplyScalar(restitution));
                }
              } else if (body.isKinematic && !otherBody.isKinematic) {
                // Handle case where this body is kinematic but other is not
                otherBody.transform.position = otherBody.transform.position.add(
                  collision.normal.multiplyScalar(-collision.depth)
                );
                
                // Reflect velocity with restitution
                const velAlongNormal = otherBody.velocity.dot(collision.normal.multiplyScalar(-1));
                
                // Only reflect if moving towards the surface
                if (velAlongNormal < 0) {
                  const restitution = Math.min(body.restitution, otherBody.restitution);
                  const normalVelocity = collision.normal.multiplyScalar(-velAlongNormal);
                  const tangentVelocity = otherBody.velocity.sub(normalVelocity);
                  
                  // Apply friction to tangential component
                  const friction = (body.friction + otherBody.friction) * 0.5;
                  const frictionFactor = Math.max(0, 1 - friction);
                  
                  otherBody.velocity = tangentVelocity.multiplyScalar(frictionFactor)
                    .add(normalVelocity.multiplyScalar(restitution));
                }
              }
              // Both kinematic case - no resolution needed
              
              // Check for triggers and emit events
              if (body.isTrigger || otherBody.isTrigger) {
                // This is a trigger collision, emit trigger events
                if (body.isTrigger) {
                  this.emit('triggerEnter', {
                    trigger: id,
                    entity: collision.objectId,
                    point: collision.pointA
                  });
                }
                
                if (otherBody.isTrigger) {
                  this.emit('triggerEnter', {
                    trigger: collision.objectId,
                    entity: id,
                    point: collision.pointB
                  });
                }
              }
            }
          }
        }
      }
    }
  }
}