# 🎭 Puppeteer

<div align="center">

![Puppeteer Logo](https://img.shields.io/badge/Puppeteer-Multiplayer%20Sync-4e54c8?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiwyQzYuNDgsMiwyLDYuNDgsMiwxMnM0LjQ4LDEwLDEwLDEwczEwLTQuNDgsMTAtMTBTMTcuNTIsMiwxMiwyeiBNMTIsMjBjLTQuNDIsMC04LTMuNTgtOC04czMuNTgtOCw4LThzOCwzLjU4LDgsOFMxNi40MiwyMCwxMiwyMHogTTE1LjU0LDE1LjU0TDIwLDIwSDRsNC40Ni00LjQ2bDEuMzksMS4zOUwxMiwxNC44NWwtMi44NSwyLjA4TDEwLjU0LDE1LjU0TDEyLDExTDEzLjQ2LDE1LjU0TDE1LjU0LDE1LjU0eiIvPjwvc3ZnPg==)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![JavaScript](https://img.shields.io/badge/JavaScript-79.7%25-yellow)
![HTML](https://img.shields.io/badge/HTML-20.3%25-orange)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

**A powerful JavaScript library for multiplayer HTML applications with 3D space interpolation**

</div>

## 🚀 Overview

Puppeteer is a modular, extensible JavaScript library designed to support multiplayer game development using 3D frameworks like Three.js. It handles networking, interpolation, prediction, and movement in a lightweight, performant package that scales from simple demos to competitive multiplayer games.

> ✨ **Perfect for:** Game developers, web application developers, and anyone building multiplayer experiences in the browser.

## 🌟 Key Features

- **🌐 Seamless Networking** - WebSocket-based client/host architecture for reliable multiplayer connections
- **🎮 Player Interpolation** - Smooth movement between network updates for lag-free gameplay
- **🧊 Object-Oriented Interpolation** - Apply the same smoothing techniques to any object in your 3D space
- **⚡ Optimized Performance** - Built for low latency and high frame rates
- **🧩 Modular Design** - Use only the components you need
- **🔌 Framework Agnostic** - Works with Three.js, Babylon.js, or your custom rendering solution

## 📦 Installation

```bash
# Using npm
npm install @the404studios/puppeteer

# Using yarn
yarn add @the404studios/puppeteer
```

Or include directly in your HTML:

```html
<script src="https://cdn.jsdelivr.net/npm/@the404studios/puppeteer/dist/puppeteer.min.js"></script>
```

## 📚 Project Structure

```
/puppeteer/
├── core/            - Basic math classes (Vector3, Quaternion, Transform)
├── interp/          - Interpolation, snapshot logic
├── net/             - Networking (client & host)
├── movement/        - Physics & directional movement
├── utils/           - Utility modules (Clock, Logger, UUID)
├── index.js         - Library entry point
└── sample.html      - Example usage with Three.js
```

## 🔍 Core Concepts

### Transform & Vector Math

At the heart of Puppeteer are the mathematical utilities for handling 3D space:

```javascript
import { Vector3, Quaternion, Transform } from '@the404studios/puppeteer';

// Create a position vector
const position = new Vector3(10, 0, 5);

// Create a rotation
const rotation = new Quaternion().setFromEuler(0, Math.PI/2, 0);

// Create a complete transform
const transform = new Transform(position, rotation);

// Use vector math
const direction = Vector3.forward().applyQuaternion(rotation);
const distance = position.distanceTo(Vector3.zero());
```

### Snapshots & Interpolation

Puppeteer uses a snapshot system to record entity states over time:

```javascript
import { Snapshot, Interpolator } from '@the404studios/puppeteer';

// Create an interpolator for an entity
const playerInterpolator = new Interpolator({
  interpolationDelay: 100,  // Buffer for network jitter (ms)
  allowExtrapolation: true  // Predict beyond known states
});

// Record entity state
function onNetworkUpdate(entityId, posX, posY, posZ, rotQuat) {
  const transform = new Transform(
    new Vector3(posX, posY, posZ),
    new Quaternion(rotQuat.x, rotQuat.y, rotQuat.z, rotQuat.w)
  );
  
  const snapshot = new Snapshot(transform, performance.now());
  playerInterpolator.addSnapshot(entityId, snapshot);
}

// In your render loop, get interpolated state
function updateEntityVisuals(entityId) {
  const transform = playerInterpolator.getInterpolatedTransform(entityId);
  if (transform) {
    entityMesh.position.copy(transform.position);
    entityMesh.quaternion.copy(transform.rotation);
  }
}
```

### Movement Controller

Puppeteer includes a robust movement system that can be used for players or AI:

```javascript
import { MovementController, Transform, Vector3 } from '@the404studios/puppeteer';

// Create a transform for the entity
const entityTransform = new Transform(
  new Vector3(0, 0, 0),  // Starting position
  new Quaternion()       // Starting rotation
);

// Create the movement controller
const movement = new MovementController(entityTransform, {
  maxSpeed: 5,            // Units per second
  acceleration: 20,       // Units per second squared
  rotationSpeed: 10,      // Radians per second
  jumpForce: 8            // Initial upward velocity
});

// Set up an update loop
function update(deltaTime) {
  // Apply input
  if (keys.forward) movement.moveForward(deltaTime);
  if (keys.backward) movement.moveBackward(deltaTime);
  if (keys.left) movement.moveLeft(deltaTime);
  if (keys.right) movement.moveRight(deltaTime);
  if (keys.jump) movement.jump();
  
  // Update visual representation
  playerMesh.position.copy(entityTransform.position);
  playerMesh.quaternion.copy(entityTransform.rotation);
}
```

### Networking

Puppeteer makes multiplayer connections simple:

```javascript
import { RoomClient } from '@the404studios/puppeteer';

// Connect to a room
const client = RoomClient.connect("wss://gameserver.example.com/room/123");

// Send updates
function sendPlayerState() {
  RoomClient.send("playerUpdate", {
    position: player.transform.position,
    rotation: player.transform.rotation,
    timestamp: performance.now()
  });
}

// Receive updates
RoomClient.on("playerJoined", (playerId, initialData) => {
  console.log(`Player ${playerId} joined the game`);
  createPlayerVisual(playerId, initialData);
});

RoomClient.on("playerUpdate", (playerId, data) => {
  updatePlayerVisual(playerId, data);
});
```

### Host a Game Server

Create your own multiplayer room host:

```javascript
import { RoomHost } from '@the404studios/puppeteer';

// Start a WebSocket server
RoomHost.startServer(8080);

// Broadcast to all clients
function broadcastGameState(gameState) {
  RoomHost.broadcast(JSON.stringify({
    type: "gameState",
    data: gameState
  }));
}
```

## 🎮 Quick Start for Three.js Integration

```javascript
import * as THREE from 'three';
import Puppeteer from '@the404studios/puppeteer';

// Set up Three.js scene
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create a player with Puppeteer
const playerTransform = new Puppeteer.Transform(
    new Puppeteer.Vector3(0, 0, 0),
    new Puppeteer.Quaternion()
);

// Create visual representation
const playerGeometry = new THREE.BoxGeometry(1, 2, 1);
const playerMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
scene.add(playerMesh);

// Connect to multiplayer room
const client = new Puppeteer.Net.RoomClient("wss://example.com/game");

// Set up movement controller
const movement = new Puppeteer.Movement.MovementController(playerTransform);

// Game loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update player based on input
    if (keys.forward) movement.moveForward(0.016);
    if (keys.backward) movement.moveBackward(0.016);
    if (keys.left) movement.rotate(0.016);
    if (keys.right) movement.rotate(-0.016);
    
    // Update mesh with transform
    playerMesh.position.copy(playerTransform.position);
    playerMesh.quaternion.copy(playerTransform.rotation);
    
    // Send network updates
    client.sendTransform(playerTransform);
    
    renderer.render(scene, camera);
}

animate();
```

## 📊 Advanced Features

### Client-Side Prediction & Server Reconciliation

```javascript
// Client-side prediction
const predictionQueue = [];

// Apply input locally immediately
function applyInput(input) {
    movement.applyInput(input);
    predictionQueue.push({
        input: input,
        transform: playerTransform.clone()
    });
    client.sendInput(input);
}

// When server confirms state
client.on("serverState", (serverSnapshot, lastProcessedInput) => {
    // Find the predictionQueue entry that matches the server's last processed input
    const matchIndex = predictionQueue.findIndex(entry => entry.input.id === lastProcessedInput);
    
    if (matchIndex !== -1) {
        // Remove confirmed predictions
        const confirmedPredictions = predictionQueue.splice(0, matchIndex + 1);
        
        // Apply server correction
        playerTransform.copy(serverSnapshot.transform);
        
        // Reapply remaining inputs
        for (const entry of predictionQueue) {
            movement.applyInput(entry.input);
        }
    }
});
```

### Entity Interpolation

```javascript
// For other players or objects
const otherPlayers = {};

client.on("playerUpdate", (playerId, snapshot) => {
    if (!otherPlayers[playerId]) {
        // Create new player
        otherPlayers[playerId] = {
            interpolator: new Puppeteer.Interpolator(),
            mesh: createPlayerMesh() // Your function to create a mesh
        };
    }
    
    // Add snapshot to interpolation system
    otherPlayers[playerId].interpolator.addSnapshot(snapshot);
});

// In animation loop
function updateOtherPlayers() {
    const now = Puppeteer.Utils.Clock.now();
    
    for (const [playerId, player] of Object.entries(otherPlayers)) {
        // Get interpolated transform
        const transform = player.interpolator.computeTransformAtTime(now - 100); // 100ms buffer
        
        // Update visual representation
        player.mesh.position.copy(transform.position);
        player.mesh.quaternion.copy(transform.rotation);
    }
}
```

## 🔧 Configuration

### Interpolation Configuration

Customize the interpolation behavior with your own config:

```javascript
const customInterpolationConfig = {
  maxSnapshots: 30,               // Maximum number of snapshots to store per entity
  interpolationDelay: 100,        // Delay in ms to smooth out network jitter
  allowExtrapolation: true,       // Whether to extrapolate when no future snapshot is available
  maxExtrapolationTime: 0.5,      // Maximum time in seconds to extrapolate
  snapshotExpirationTime: 10000,  // Time in ms after which snapshots are considered expired
  blendDuration: 0.2,             // Duration in seconds for blending between states
};

const interpolator = new Puppeteer.Interpolator(customInterpolationConfig);
```

### Movement Configuration

Fine-tune the movement controller for your game's feel:

```javascript
const customMovementConfig = {
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
  autoRotate: true,        // Whether to automatically rotate to face movement direction
};

const movement = new Puppeteer.MovementController(transform, customMovementConfig);
```

## 🧪 Examples

Check out these examples to see Puppeteer in action: (coming soon)

- [Basic Connection](examples/basic-connection.html) - Simple client/server setup
- [Character Movement](examples/character-movement.html) - Player controls with interpolation
- [Object Synchronization](examples/object-sync.html) - Synchronizing multiple objects
- [Full Game Demo](examples/demo-game.html) - Complete game implementation

## 📘 Documentation

[Documentation](https://the404studios.github.io/puppeteer-docs.html)

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Real-World Use Cases

Puppeteer can be used for a variety of multiplayer web applications:

- **Multiplayer Games** - First-person shooters, RPGs, collaborative puzzles
- **Virtual Spaces** - Meeting rooms, virtual galleries, social spaces
- **Educational Simulations** - Interactive learning environments
- **Product Visualization** - Collaborative product reviews in 3D
- **Architectural Visualization** - Multi-user building tours and reviews

## 💖 Acknowledgements

- [Three.js](https://threejs.org/) - JavaScript 3D library
- [ws](https://github.com/websockets/ws) - WebSocket implementation
- The amazing community of game developers who provided feedback and testing

# Puppeteer.js Documentation (more condensed guide)

## Overview
Puppeteer.js is a modular, extensible JavaScript library designed to support multiplayer game development using 3D frameworks like Three.js. It includes networking, interpolation, prediction, and movement handling, and is structured to scale up to competitive or simulation-heavy multiplayer games.

## Table of Contents
1. [Installation](#installation)
2. [Core Components](#core-components)
3. [Real-Time Networking](#real-time-networking)
4. [Interpolation System](#interpolation-system)
5. [Movement Controller](#movement-controller)
6. [Integration Examples](#integration-examples)
7. [API Reference](#api-reference)

## Installation

Install Puppeteer.js using npm:

```bash
npm install puppeteer-js
```

Or include it via CDN:

```html
<script src="https://cdn.example.com/puppeteer/latest/puppeteer.min.js"></script>
```

## Core Components

### Vector3
Represents a point or vector in 3D space.

```javascript
// Create and manipulate vectors
const position = new Puppeteer.Vector3(0, 0, 0);
position.add(new Puppeteer.Vector3(1, 2, 3));
const distance = position.distanceTo(new Puppeteer.Vector3(5, 5, 5));
```

### Quaternion
Represents rotations in 3D space, avoiding gimbal lock issues.

```javascript
// Create and use quaternions for rotation
const rotation = new Puppeteer.Quaternion();
rotation.setFromAxisAngle(new Puppeteer.Vector3(0, 1, 0), Math.PI / 2);
rotation.multiply(anotherQuaternion);
```

### Transform
Combines position, rotation, and scale into a single object.

```javascript
// Create a transform
const transform = new Puppeteer.Transform(
    new Puppeteer.Vector3(10, 0, 5),
    new Puppeteer.Quaternion(),
    new Puppeteer.Vector3(1, 1, 1) // scale
);
```

### Matrix4
Represents a 4x4 transformation matrix for advanced 3D operations.

```javascript
// Create and manipulate matrices
const matrix = new Puppeteer.Matrix4();
matrix.setPosition(1, 2, 3);
matrix.invert();
```

## Real-Time Networking

### Introduction
The Real-Time Networking module provides advanced networking capabilities for multiplayer games. It includes entity synchronization, interpolation, peer-to-peer communication, and more.

### Key Features
- Entity state synchronization with interpolation
- Room-based multiplayer
- WebRTC peer-to-peer connections
- Client-side prediction and server reconciliation
- Network optimization utilities
- Collision detection for moving entities

### RealtimeClient
The primary class for multiplayer networking. Handles connection, synchronization, and entity management.

```javascript
// Create a realtime client
const client = new Puppeteer.RealTime.RealtimeClient({
    updateRate: 50,             // Update rate in ms
    interpolationDelay: 100,    // Interpolation delay in ms
    useP2P: true,               // Use WebRTC when available
    useLocalStorage: true       // Store state in localStorage
});

// Connect to a room
await client.connect('room_123');

// Register an entity
const transform = new Puppeteer.Transform(
    new Puppeteer.Vector3(0, 0, 0),
    new Puppeteer.Quaternion()
);

client.registerEntity('player1', transform, { 
    type: 'player',
    color: '#ff0000',
    name: 'Player 1' 
});

// Update entity
client.updateEntity('player1', transform);

// Get interpolated transform for rendering
const renderTransform = client.getInterpolatedTransform('player1');
```

### EntityState
Represents a networked entity's state at a point in time.

```javascript
const entityState = new Puppeteer.RealTime.EntityState(
    'player1',
    transform,
    timestamp,
    { type: 'player', color: '#ff0000' }
);

// Serialize for network transmission
const serializedData = entityState.serialize();

// Deserialize from network data
const receivedState = Puppeteer.RealTime.EntityState.deserialize(serializedData);
```

### RoomSyncManager
Low-level class that manages state synchronization between clients.

```javascript
const syncManager = new Puppeteer.RealTime.RoomSyncManager({
    roomId: 'room_123',
    clientId: 'client_456',
    isHost: true
});

// Register entities
syncManager.registerEntity('player1', transform, metadata, true);

// Apply network updates
syncManager.applyNetworkUpdate(entityStateData);
```

### WebRTCManager
Manages WebRTC peer-to-peer connections for direct communication between clients.

```javascript
const webrtc = new Puppeteer.RealTime.WebRTCManager({
    clientId: 'client_123'
});

// Initialize for a room
webrtc.initialize('room_456');

// Create offer to connect to a peer
const offer = await webrtc.createOffer('peer_789');

// Send data to a peer
webrtc.sendToPeer('peer_789', 'entityUpdate', entityData);

// Broadcast to all connected peers
webrtc.broadcast('gameEvent', { type: 'explosion', position: [10, 20, 30] });
```

### NetworkUtils
Utilities for optimizing network performance.

```javascript
// Calculate optimal buffer delay
const latencies = [50, 60, 55, 70, 65];
const optimalDelay = Puppeteer.RealTime.NetworkUtils.calculateOptimalDelay(
    latencies,
    50,  // Minimum delay
    300  // Maximum delay
);

// Estimate network jitter
const jitter = Puppeteer.RealTime.NetworkUtils.estimateJitter(latencies);

// Detect and adjust for clock drift
const clockDiff = Puppeteer.RealTime.NetworkUtils.estimateClockDrift(
    localTime,
    remoteTime,
    latency / 2  // Estimated one-way latency
);
```

### CollisionUtils
Utilities for detecting and resolving collisions between moving entities.

```javascript
// Detect collision between moving spheres
const collision = Puppeteer.RealTime.CollisionUtils.detectMovingSpheresCollision(
    player1Pos, player2Pos,
    player1Vel, player2Vel,
    player1Radius, player2Radius,
    deltaTime
);

if (collision) {
    // Resolve collision with impulse response
    const response = Puppeteer.RealTime.CollisionUtils.applyCollisionImpulse(
        player1Vel, player2Vel,
        collision.normal,
        player1Mass, player2Mass,
        0.5  // Restitution (bounciness)
    );
    
    // Apply new velocities
    player1.velocity = response.velA;
    player2.velocity = response.velB;
}
```

## Interpolation System

### Snapshot
Stores a Transform with a timestamp for interpolation.

```javascript
// Create a snapshot
const snapshot = new Puppeteer.Snapshot(
    transform,
    Puppeteer.Clock.now(),
    { entityId: 'player1' }
);
```

### Interpolator
Computes smooth transitions between snapshots for visual smoothing.

```javascript
// Create an interpolator
const interpolator = new Puppeteer.Interpolator({
    maxSnapshots: 10,
    interpolationDelay: 100  // ms
});

// Add snapshots as they arrive from the network
interpolator.addSnapshot('player1', snapshot1);
interpolator.addSnapshot('player1', snapshot2);

// Get interpolated transform for rendering
const renderTime = Puppeteer.Clock.now() - 100;  // 100ms delay for smoothing
const renderTransform = interpolator.getInterpolatedTransform('player1', renderTime);
```

## Movement Controller

### MovementController
Handles physics-based movement with proper acceleration, friction, and collision.

```javascript
// Create a movement controller
const controller = new Puppeteer.MovementController(playerTransform, {
    maxSpeed: 5,
    acceleration: 20,
    drag: 10,
    gravity: 9.8
});

// Apply input
controller.moveForward(deltaTime);
controller.rotate(Math.PI / 4);
controller.jump();

// Update physics
controller.update(deltaTime);
```

## Integration Examples

### Basic Multiplayer Setup

```javascript
import Puppeteer from 'puppeteer-js';

// Create realtime client
const client = new Puppeteer.RealTime.RealtimeClient();

// Connect to room
client.connect('game_room_123');

// Create local player
const playerTransform = new Puppeteer.Transform(
    new Puppeteer.Vector3(0, 0, 0),
    new Puppeteer.Quaternion()
);

client.registerEntity('player1', playerTransform, {
    type: 'player',
    color: '#ff0000',
    name: 'Player 1'
});

// Set up game loop
function gameLoop(time) {
    // Update player based on input
    if (keys.w) {
        playerTransform.position.z -= 1 * deltaTime;
        client.updateEntity('player1', playerTransform);
    }
    
    // Render all entities
    for (const entityId of client.getAllEntityIds()) {
        const renderTransform = client.getInterpolatedTransform(entityId);
        if (renderTransform) {
            // Render entity using transform
            renderEntity(entityId, renderTransform);
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Start game loop
requestAnimationFrame(gameLoop);
```

### Integration with Three.js

```javascript
import * as THREE from 'three';
import Puppeteer from 'puppeteer-js';

// Set up Three.js
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Create realtime client
const client = new Puppeteer.RealTime.RealtimeClient();
client.connect('three_demo_room');

// Create local player mesh
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const playerMesh = new THREE.Mesh(geometry, material);
scene.add(playerMesh);

// Register with Puppeteer
const playerTransform = new Puppeteer.Transform(
    new Puppeteer.Vector3(0, 0, 0),
    new Puppeteer.Quaternion()
);

client.registerEntity('player', playerTransform, {
    type: 'player',
    color: '#ff0000'
});

// Entity cache
const entityMeshes = {
    player: playerMesh
};

// Handle new entities
client.on('networkUpdate', (data) => {
    const entityId = data.entityId;
    
    // Create mesh for new entity if needed
    if (!entityMeshes[entityId]) {
        const newGeometry = new THREE.BoxGeometry(1, 1, 1);
        const newMaterial = new THREE.MeshBasicMaterial({ 
            color: data.entity.metadata.color || 0x00ff00 
        });
        const newMesh = new THREE.Mesh(newGeometry, newMaterial);
        scene.add(newMesh);
        
        entityMeshes[entityId] = newMesh;
    }
});

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    // Update all entities
    for (const [entityId, mesh] of Object.entries(entityMeshes)) {
        const transform = client.getInterpolatedTransform(entityId);
        
        if (transform) {
            // Apply transform to Three.js mesh
            mesh.position.set(
                transform.position.x,
                transform.position.y,
                transform.position.z
            );
            
            mesh.quaternion.set(
                transform.rotation.x,
                transform.rotation.y,
                transform.rotation.z,
                transform.rotation.w
            );
        }
    }
    
    // Handle keyboard input
    if (keys.w) playerTransform.position.z -= 0.1;
    if (keys.s) playerTransform.position.z += 0.1;
    if (keys.a) playerTransform.position.x -= 0.1;
    if (keys.d) playerTransform.position.x += 0.1;
    
    // Update own entity
    client.updateEntity('player', playerTransform);
    
    // Render
    renderer.render(scene, camera);
}

animate();
```

## API Reference

### Core Module

#### Vector3
- `new Vector3(x, y, z)` - Create a new vector
- `add(v)` - Add vector
- `sub(v)` - Subtract vector
- `multiplyScalar(s)` - Multiply by scalar
- `divideScalar(s)` - Divide by scalar
- `length()` - Get vector length
- `normalize()` - Normalize vector
- `dot(v)` - Dot product
- `cross(v)` - Cross product
- `distanceTo(v)` - Distance to another vector

#### Quaternion
- `new Quaternion(x, y, z, w)` - Create quaternion
- `setFromAxisAngle(axis, angle)` - Set from axis and angle
- `multiply(q)` - Multiply with another quaternion
- `slerp(q, t)` - Spherical interpolation
- `normalize()` - Normalize quaternion
- `inverse()` - Get inverse quaternion

#### Transform
- `new Transform(position, rotation, scale)` - Create transform
- `getMatrix()` - Get transformation matrix
- `setMatrix(matrix)` - Set from matrix
- `clone()` - Create copy
- `lerp(to, t)` - Linear interpolation
- `lookAt(target, up)` - Orient towards target

### Real-Time Networking Module

#### RealtimeClient
- `new RealtimeClient(options)` - Create client
- `connect(url, asHost)` - Connect to room
- `disconnect()` - Disconnect from room
- `registerEntity(entityId, transform, metadata)` - Register entity
- `updateEntity(entityId, transform, metadata)` - Update entity
- `getEntityState(entityId)` - Get entity state
- `getInterpolatedTransform(entityId)` - Get interpolated transform
- `isOwnedByMe(entityId)` - Check ownership
- `getAllEntities()` - Get all entities
- `getOwnedEntities()` - Get owned entities
- `takeOwnership(entityId)` - Take ownership
- `releaseOwnership(entityId)` - Release ownership

#### RoomSyncManager
- `new RoomSyncManager(options)` - Create sync manager
- `setupRoom(roomId, asHost)` - Setup room
- `registerEntity(entityId, transform, metadata, owned)` - Register entity
- `updateEntity(entityId, transform, metadata)` - Update entity
- `applyNetworkUpdate(data)` - Apply network update
- `getEntityState(entityId)` - Get entity state
- `getInterpolatedTransform(entityId, time)` - Get interpolated transform

#### WebRTCManager
- `new WebRTCManager(options)` - Create WebRTC manager
- `initialize(roomId)` - Initialize for room
- `createOffer(peerId)` - Create connection offer
- `handleOffer(offerData)` - Handle incoming offer
- `handleAnswer(answerData)` - Handle answer
- `handleIceCandidate(candidateData)` - Handle ICE candidate
- `sendToPeer(peerId, type, data)` - Send to specific peer
- `broadcast(type, data)` - Broadcast to all peers
- `getConnectedPeers()` - Get connected peers

### Interpolation Module

#### Interpolator
- `new Interpolator(config)` - Create interpolator
- `addSnapshot(entityId, snapshot)` - Add snapshot
- `getInterpolatedSnapshot(entityId, time)` - Get interpolated snapshot
- `getInterpolatedTransform(entityId, time)` - Get interpolated transform
- `getLatestSnapshot(entityId)` - Get latest snapshot
- `getVelocity(entityId)` - Get estimated velocity
- `clearSnapshots(entityId)` - Clear entity snapshots
- `clearAllSnapshots()` - Clear all snapshots

### Movement Module

#### MovementController
- `new MovementController(transform, options)` - Create controller
- `update(dt)` - Update physics
- `moveForward(dt)` - Move forward
- `moveBackward(dt)` - Move backward
- `moveLeft(dt)` - Move left
- `moveRight(dt)` - Move right
- `jump()` - Jump
- `rotate(angle, axis)` - Rotate
- `lookAt(target)` - Look at target
- `setPosition(position)` - Set position
- `setVelocity(velocity)` - Set velocity
- `getPosition()` - Get position
- `getVelocity()` - Get velocity

## Event System

All major components in Puppeteer.js implement an EventEmitter pattern:

```javascript
// Listen for events
client.on('connected', (data) => {
    console.log(`Connected to room: ${data.roomId}`);
});

client.on('entityUpdated', (data) => {
    console.log(`Entity updated: ${data.entityId}`);
});

// One-time event
client.once('connectionFailed', (error) => {
    console.error('Connection failed:', error);
});

// Remove event listener
client.off('entityUpdated', myHandler);
```

Common events include:
- `connected` - Connected to room
- `disconnected` - Disconnected from room
- `entityUpdated` - Entity was updated
- `networkUpdate` - Network update received
- `entityRegistered` - New entity registered
- `ownershipChanged` - Entity ownership changed
- `peerConnected` - P2P peer connected
- `peerDisconnected` - P2P peer disconnected

## Utilities

### Clock
- `now()` - Get current time in milliseconds

### UUID
- `generateUUID()` - Generate random UUID

## Browser Support

Puppeteer.js works in all modern browsers that support:
- WebSockets
- WebRTC (optional, for P2P connections)
- localStorage (optional, for state persistence)
- requestAnimationFrame
- ES6 features

## License

Puppeteer.js is released under the MIT License.

<div align="center">
  <img src="https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F%20by-The404Studios-blue" alt="Made with love by The404Studios"/>
  <br>
  <a href="https://github.com/The404Studios">View more projects</a> |
  <a href="https://github.com/The404Studios/puppeteer/issues">Report Bug</a> |
  <a href="https://github.com/The404Studios/puppeteer/issues">Request Feature</a>
</div>
