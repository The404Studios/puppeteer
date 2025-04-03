# 🎭 Puppeteer

<div align="center">

![Puppeteer Logo](https://img.shields.io/badge/Puppeteer-Multiplayer%20Sync-4e54c8?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiwyQzYuNDgsMiwyLDYuNDgsMiwxMnM0LjQ4LDEwLDEwLDEwczEwLTQuNDgsMTAtMTBTMTcuNTIsMiwxMiwyeiBNMTIsMjBjLTQuNDIsMC04LTMuNTgtOC04czMuNTgtOCw4LThzOCwzLjU4LDgsOFMxNi40MiwyMCwxMiwyMHogTTE1LjU0LDE1LjU0TDIwLDIwSDRsNC40Ni00LjQ2bDEuMzksMS4zOUwxMiwxNC44NWwtMi44NSwyLjA4TDEwLjU0LDE1LjU0TDEyLDExTDEzLjQ2LDE1LjU0TDE1LjU0LDE1LjU0eiIvPjwvc3ZnPg==)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![JavaScript](https://img.shields.io/badge/JavaScript-79.7%25-yellow)
![HTML](https://img.shields.io/badge/HTML-20.3%25-orange)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)
[![Stars](https://img.shields.io/github/stars/The404Studios/puppeteer?style=social)](https://github.com/The404Studios/puppeteer/stargazers)

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

- **Vector3 / Quaternion:** Core math utilities for 3D space.
- **Transform:** Combines position and rotation.
- **Snapshot:** Stores a Transform with a timestamp.
- **Interpolator:** Computes smooth transitions between Snapshots.
- **RoomClient:** Handles WebSocket client networking.
- **RoomHost:** Hosts WebSocket server for multiplayer rooms.
- **MovementController:** Moves a player in a specific direction based on speed and deltaTime.

## 🎮 Quick Start

```javascript
import Puppeteer from '@the404studios/puppeteer';

// Set up Three.js scene (or your preferred rendering engine)
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

## 🧪 Examples

Check out these examples to see Puppeteer in action: (coming soon)

- [Basic Connection](examples/basic-connection.html) - Simple client/server setup
- [Character Movement](examples/character-movement.html) - Player controls with interpolation
- [Object Synchronization](examples/object-sync.html) - Synchronizing multiple objects
- [Full Game Demo](examples/demo-game.html) - Complete game implementation

## 📘 Documentation

For detailed API documentation, visit [our documentation site](https://the404studios.github.io/puppeteer/).

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 💖 Acknowledgements

- [Three.js](https://threejs.org/) - JavaScript 3D library
- [ws](https://github.com/websockets/ws) - WebSocket implementation
- The amazing community of game developers who provided feedback and testing

---

<div align="center">
  <img src="https://img.shields.io/badge/Made%20with%20%E2%9D%A4%EF%B8%8F%20by-The404Studios-blue" alt="Made with love by The404Studios"/>
  <br>
  <a href="https://github.com/The404Studios">View more projects</a> |
  <a href="https://github.com/The404Studios/puppeteer/issues">Report Bug</a> |
  <a href="https://github.com/The404Studios/puppeteer/issues">Request Feature</a>
</div>
