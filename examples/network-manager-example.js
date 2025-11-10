/**
 * NetworkManager Example
 * Shows how to use the integrated NetworkManager for multiplayer
 */

const NetworkManager = require('../net/NetworkManager.js');
const DebugOverlay = require('../utils/DebugOverlay.js');

// Create network manager with all features enabled
const network = new NetworkManager({
    url: 'ws://localhost:8080', // Your WebSocket server
    enablePrediction: true,      // Client-side prediction
    enableCompression: true,     // Packet compression
    enableReliability: false,    // Reliable channel (set true for critical messages)
    enableAuth: false,           // Authentication (set true and configure auth)
    enableDebug: true            // Debug logging
});

// Optional: Create debug overlay
let debugOverlay = null;
if (typeof document !== 'undefined') {
    debugOverlay = new DebugOverlay({
        position: 'top-right',
        theme: 'dark'
    });
}

// Handle connection
network.onConnected(() => {
    console.log('✓ Connected to server');

    // Register local player entity
    const initialTransform = {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0, w: 1 },
        scale: { x: 1, y: 1, z: 1 }
    };

    network.registerEntity('myPlayer', initialTransform, true);

    // Start sending updates
    startGameLoop();
});

network.onDisconnected(() => {
    console.log('✗ Disconnected from server');
});

// Handle entity updates from server
network.onEntityUpdate((entityId, entity) => {
    console.log(`Entity ${entityId} updated:`, entity.transform);

    // Update your 3D scene/rendering here
    updateVisual(entityId, entity.transform);
});

// Handle custom messages
network.on(100, (data, metadata) => {
    console.log('Received custom message:', data);
});

// Connect to server
async function start() {
    try {
        await network.connect();
        console.log('Connected and ready!');
    } catch (error) {
        console.error('Failed to connect:', error);
    }
}

// Game loop
let lastTime = performance.now();
const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    rotateLeft: false,
    rotateRight: false
};

function startGameLoop() {
    function loop() {
        const now = performance.now();
        const deltaTime = (now - lastTime) / 1000;
        lastTime = now;

        // Get input from keyboard/gamepad
        updateInput();

        // Send input to server (with client-side prediction)
        if (hasInput()) {
            network.sendInput(input);
        }

        // Update local player transform
        const entity = network.getEntity('myPlayer');
        if (entity) {
            // Apply local movement (predicted)
            applyMovement(entity.transform, input, deltaTime);

            // Send entity update to server (compressed)
            network.sendEntityUpdate('myPlayer', entity.transform);
        }

        // Record frame for FPS tracking
        network.recordFrame();

        // Update debug overlay
        if (debugOverlay) {
            const stats = network.getStats();
            debugOverlay.update({
                'Network': {
                    'Connected': stats.connected,
                    'Entities': stats.entities,
                    'Ping': stats.timeSync ? `${stats.timeSync.latency.toFixed(0)}ms` : 'N/A',
                    'Jitter': stats.timeSync ? `${stats.timeSync.jitter.toFixed(0)}ms` : 'N/A'
                },
                'Performance': stats.performance ? {
                    'FPS': stats.performance.fps,
                    'Packets/s': `${stats.performance.packetsPerSecondSent}↑ ${stats.performance.packetsPerSecondReceived}↓`,
                    'Data': `${stats.performance.kbPerSecondSent}KB/s↑ ${stats.performance.kbPerSecondReceived}KB/s↓`
                } : {},
                'Prediction': stats.prediction ? {
                    'Reconciliations': stats.prediction.reconciliationCount,
                    'Avg Error': stats.prediction.averageError.toFixed(3),
                    'Max Error': stats.prediction.maxError.toFixed(3)
                } : {}
            });
        }

        requestAnimationFrame(loop);
    }

    loop();
}

// Input handling (example)
function updateInput() {
    if (typeof window !== 'undefined') {
        const keys = window.keys || {};
        input.forward = keys['w'] || false;
        input.backward = keys['s'] || false;
        input.left = keys['a'] || false;
        input.right = keys['d'] || false;
        input.rotateLeft = keys['arrowleft'] || false;
        input.rotateRight = keys['arrowright'] || false;
    }
}

function hasInput() {
    return input.forward || input.backward || input.left || input.right ||
           input.rotateLeft || input.rotateRight;
}

// Movement (example)
function applyMovement(transform, input, deltaTime) {
    const speed = 5;
    const rotSpeed = 3;

    if (input.forward) {
        transform.position.z -= speed * deltaTime;
    }
    if (input.backward) {
        transform.position.z += speed * deltaTime;
    }
    if (input.left) {
        transform.position.x -= speed * deltaTime;
    }
    if (input.right) {
        transform.position.x += speed * deltaTime;
    }

    // Simple Y-axis rotation
    if (input.rotateLeft) {
        const angle = rotSpeed * deltaTime;
        const c = Math.cos(angle / 2);
        const s = Math.sin(angle / 2);
        transform.rotation = {
            x: 0,
            y: s,
            z: 0,
            w: c
        };
    }
    if (input.rotateRight) {
        const angle = -rotSpeed * deltaTime;
        const c = Math.cos(angle / 2);
        const s = Math.sin(angle / 2);
        transform.rotation = {
            x: 0,
            y: s,
            z: 0,
            w: c
        };
    }
}

// Visual update (example - integrate with your renderer)
function updateVisual(entityId, transform) {
    // Example for Three.js:
    // const mesh = scene.getObjectByName(entityId);
    // if (mesh) {
    //     mesh.position.set(transform.position.x, transform.position.y, transform.position.z);
    //     mesh.quaternion.set(transform.rotation.x, transform.rotation.y, transform.rotation.z, transform.rotation.w);
    // }

    console.log(`Update visual for ${entityId}:`, transform);
}

// Cleanup on exit
function cleanup() {
    network.disconnect();
    if (debugOverlay) {
        debugOverlay.destroy();
    }
}

if (typeof process !== 'undefined') {
    process.on('SIGINT', cleanup);
}

if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanup);

    // Set up keyboard input
    window.keys = {};
    window.addEventListener('keydown', (e) => {
        window.keys[e.key.toLowerCase()] = true;
    });
    window.addEventListener('keyup', (e) => {
        window.keys[e.key.toLowerCase()] = false;
    });
}

// Start the application
console.log('🎭 Puppeteer NetworkManager Example');
console.log('Starting...');
start();

// Export for use as module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { network, start, cleanup };
}
