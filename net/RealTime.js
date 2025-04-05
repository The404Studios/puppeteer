// === puppeteer/net/RealTime.js ===
import { 
  EntityState,
  RoomSyncManager,
  WebRTCManager,
  RealtimeClient,
  NetworkUtils,
  CollisionUtils
} from './RealTimeSync.js';

// Re-export all components from RealTimeSync
export {
  EntityState,
  RoomSyncManager,
  WebRTCManager,
  RealtimeClient,
  NetworkUtils,
  CollisionUtils
};

// === Update puppeteer/index.js to include RealTime module ===
// Add these imports to the existing index.js
import Vector3 from './core/Vector3.js';
import Quaternion from './core/Quaternion.js';
import Transform from './core/Transform.js';
import Matrix4 from './core/Matrix4.js';
import Snapshot from './core/Snapshot.js';
import { Interpolator } from './interp/Interpolator.js';
import * as RoomClient from './net/RoomClient.js';
import * as RealTime from './net/RealTime.js';
import MovementController from './movement/MovementController.js';
import * as Clock from './utils/Clock.js';

// Update the default export to include RealTime
export default {
  // Core math classes
  Vector3,
  Quaternion,
  Transform,
  Matrix4,
  
  // Interpolation
  Snapshot,
  Interpolator,
  
  // Networking
  RoomClient,
  RealTime,
  
  // Movement
  MovementController,
  
  // Utilities
  Clock
};

// === README.md extension for RealTime networking ===
// # Real-Time Networking Extension for Puppeteer.js
// 
// This extension adds enhanced real-time networking capabilities to Puppeteer.js,
// specifically designed for multiplayer games requiring smooth movement and state
// synchronization.
// 
// ## Features
// 
// - **Entity State Synchronization**: Reliable synchronization of entity transforms
// - **Interpolation**: Smooth visual representation of networked entities
// - **Local Storage Persistence**: Optional persistence of room state
// - **WebRTC Support**: Optional peer-to-peer connections for lower latency
// - **Room Management**: Easy room creation and joining
// - **Network Utilities**: Tools for handling latency, jitter, and clock drift
// - **Collision Detection**: Utilities for detecting and resolving collisions between moving entities
// 
// ## Basic Usage
// 
// ```javascript
// import Puppeteer from './puppeteer/index.js';
// 
// // Create realtime client
// const client = new Puppeteer.RealTime.RealtimeClient();
// 
// // Connect to a room
// client.connect('room_123');
// 
// // Register an entity
// const transform = new Puppeteer.Transform(
//   new Puppeteer.Vector3(0, 0, 0),
//   new Puppeteer.Quaternion()
// );
// 
// client.registerEntity('player1', transform, { type: 'player' });
// 
// // Update entity
// function update() {
//   // Update position
//   transform.position.x += 1;
//   
//   // Sync with network
//   client.updateEntity('player1', transform);
//   
//   // Request next frame
//   requestAnimationFrame(update);
// }
// 
// // Start update loop
// update();
// ```
// 
// ## Advanced Features
// 
// ### WebRTC P2P Connections
// 
// For lower latency connections between clients:
// 
// ```javascript
// const client = new Puppeteer.RealTime.RealtimeClient({
//   useP2P: true
// });
// ```
// 
// ### Optimizing Network Performance
// 
// ```javascript
// // Calculate optimal delay based on network conditions
// const latencies = [50, 60, 55, 70, 65];
// const optimalDelay = Puppeteer.RealTime.NetworkUtils.calculateOptimalDelay(latencies);
// 
// const client = new Puppeteer.RealTime.RealtimeClient({
//   interpolationDelay: optimalDelay
// });
// ```
// 
// ### Collision Detection for Moving Entities
// 
// ```javascript
// const collision = Puppeteer.RealTime.CollisionUtils.detectMovingSpheresCollision(
//   player1Pos, player2Pos,
//   player1Vel, player2Vel,
//   player1Radius, player2Radius,
//   deltaTime
// );
// 
// if (collision) {
//   // Handle collision
//   const response = Puppeteer.RealTime.CollisionUtils.applyCollisionImpulse(
//     player1Vel, player2Vel,
//     collision.normal,
//     player1Mass, player2Mass,
//     0.5 // restitution
//   );
//   
//   player1.velocity = response.velA;
//   player2.velocity = response.velB;
// }
// ```
// 
// ## Integration with Three.js
// 
// ```javascript
// // Create Three.js objects
// const geometry = new THREE.BoxGeometry(1, 1, 1);
// const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
// const mesh = new THREE.Mesh(geometry, material);
// scene.add(mesh);
// 
// // Register with Puppeteer
// const transform = new Puppeteer.Transform(
//   new Puppeteer.Vector3(0, 0, 0),
//   new Puppeteer.Quaternion()
// );
// 
// client.registerEntity('player1', transform);
// 
// // Update Three.js object in render loop
// function animate() {
//   // Get interpolated transform for smooth rendering
//   const renderTransform = client.getInterpolatedTransform('player1');
//   
//   if (renderTransform) {
//     // Apply transform to Three.js object
//     mesh.position.set(
//       renderTransform.position.x,
//       renderTransform.position.y,
//       renderTransform.position.z
//     );
//     
//     mesh.quaternion.set(
//       renderTransform.rotation.x,
//       renderTransform.rotation.y,
//       renderTransform.rotation.z,
//       renderTransform.rotation.w
//     );
//   }
//   
//   renderer.render(scene, camera);
//   requestAnimationFrame(animate);
// }
// 
// animate();
// ```