// === puppeteer/examples/realtime-example.js ===
import Vector3 from '../core/Vector3.js';
import Quaternion from '../core/Quaternion.js';
import Transform from '../core/Transform.js';
import { RealtimeClient } from '../net/RealTimeSync.js';
import { now } from '../utils/Clock.js';

// Create HTML structure
const setupUI = () => {
  // Create game container
  const gameContainer = document.createElement('div');
  gameContainer.id = 'game-container';
  gameContainer.style.position = 'relative';
  gameContainer.style.width = '100vw';
  gameContainer.style.height = '100vh';
  gameContainer.style.overflow = 'hidden';
  gameContainer.style.backgroundColor = '#333';
  
  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  
  // Create UI overlay
  const uiOverlay = document.createElement('div');
  uiOverlay.id = 'ui-overlay';
  uiOverlay.style.position = 'absolute';
  uiOverlay.style.top = '10px';
  uiOverlay.style.left = '10px';
  uiOverlay.style.zIndex = '10';
  
  // Create player stats display
  const playerStats = document.createElement('div');
  playerStats.id = 'player-stats';
  playerStats.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  playerStats.style.padding = '10px';
  playerStats.style.borderRadius = '5px';
  playerStats.style.marginBottom = '10px';
  playerStats.style.color = 'white';
  playerStats.style.fontFamily = 'Arial, sans-serif';
  playerStats.innerHTML = 'Players: <span id="player-count">0</span> | Room: <span id="room-code">-</span>';
  
  // Create connection form
  const connectionForm = document.createElement('div');
  connectionForm.id = 'connection-form';
  connectionForm.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  connectionForm.style.padding = '10px';
  connectionForm.style.borderRadius = '5px';
  connectionForm.style.marginBottom = '10px';
  connectionForm.style.color = 'white';
  connectionForm.style.fontFamily = 'Arial, sans-serif';
  
  const roomInput = document.createElement('input');
  roomInput.id = 'room-input';
  roomInput.type = 'text';
  roomInput.placeholder = 'Room code';
  roomInput.style.padding = '5px';
  roomInput.style.marginRight = '5px';
  
  const connectButton = document.createElement('button');
  connectButton.id = 'connect-button';
  connectButton.textContent = 'Connect';
  connectButton.style.padding = '5px 10px';
  connectButton.style.backgroundColor = '#4e54c8';
  connectButton.style.color = 'white';
  connectButton.style.border = 'none';
  connectButton.style.borderRadius = '3px';
  connectButton.style.cursor = 'pointer';
  
  const createButton = document.createElement('button');
  createButton.id = 'create-button';
  createButton.textContent = 'Create Room';
  createButton.style.padding = '5px 10px';
  createButton.style.backgroundColor = '#3c9e41';
  createButton.style.color = 'white';
  createButton.style.border = 'none';
  createButton.style.borderRadius = '3px';
  createButton.style.cursor = 'pointer';
  createButton.style.marginLeft = '5px';
  
  connectionForm.appendChild(roomInput);
  connectionForm.appendChild(connectButton);
  connectionForm.appendChild(createButton);
  
  // Add elements to page
  uiOverlay.appendChild(playerStats);
  uiOverlay.appendChild(connectionForm);
  gameContainer.appendChild(canvas);
  gameContainer.appendChild(uiOverlay);
  document.body.appendChild(gameContainer);
  
  return {
    canvas,
    playerCount: document.getElementById('player-count'),
    roomCode: document.getElementById('room-code'),
    roomInput: document.getElementById('room-input'),
    connectButton: document.getElementById('connect-button'),
    createButton: document.getElementById('create-button')
  };
};

// Main application
const runRealtimeExample = () => {
  // Setup UI
  const ui = setupUI();
  const canvas = ui.canvas;
  const ctx = canvas.getContext('2d');
  
  // Resize handler
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });
  
  // Create realtime client
  const realtime = new RealtimeClient({
    updateRate: 50,
    interpolationDelay: 100,
    useLocalStorage: true
  });
  
  // Player entities
  const entities = new Map();
  let localPlayerId = `player_${Math.floor(Math.random() * 1000)}`;
  
  // Create local player
  const createLocalPlayer = () => {
    const transform = new Transform(
      new Vector3(canvas.width / 2, canvas.height / 2, 0),
      new Quaternion(),
      new Vector3(1, 1, 1)
    );
    
    realtime.registerEntity(localPlayerId, transform, {
      type: 'player',
      color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
      name: `Player ${localPlayerId.split('_')[1]}`
    });
    
    return localPlayerId;
  };
  
  // Movement variables
  let keys = {};
  const PLAYER_SPEED = 200; // pixels per second
  
  // Input handling
  window.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
  });
  
  window.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
  });
  
  // Connect to room
  ui.connectButton.addEventListener('click', () => {
    const roomId = ui.roomInput.value.trim();
    if (!roomId) return;
    
    realtime.connect(roomId).then(success => {
      if (success) {
        ui.roomCode.textContent = roomId;
        createLocalPlayer();
      }
    });
  });
  
  // Create room
  ui.createButton.addEventListener('click', () => {
    const roomId = `room_${Math.floor(Math.random() * 10000)}`;
    ui.roomInput.value = roomId;
    
    realtime.connect(roomId, true).then(success => {
      if (success) {
        ui.roomCode.textContent = roomId;
        createLocalPlayer();
      }
    });
  });
  
  // Realtime events
  realtime.on('connected', (data) => {
    console.log(`Connected to room ${data.roomId}`);
  });
  
  realtime.on('entityUpdated', (data) => {
    entities.set(data.entityId, data.entity);
    updatePlayerCount();
  });
  
  realtime.on('networkUpdate', (data) => {
    entities.set(data.entityId, data.entity);
    updatePlayerCount();
  });
  
  // Update player count display
  const updatePlayerCount = () => {
    const count = Array.from(entities.values())
      .filter(entity => entity.metadata.type === 'player')
      .length;
    
    ui.playerCount.textContent = count;
  };
  
  // Game loop
  let lastTime = 0;
  
  const gameLoop = (time) => {
    const dt = (time - lastTime) / 1000; // convert to seconds
    lastTime = time;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Update local player position based on input
    if (realtime.isOwnedByMe(localPlayerId)) {
      const playerState = realtime.getEntityState(localPlayerId);
      
      if (playerState) {
        const transform = playerState.transform;
        let dx = 0;
        let dy = 0;
        
        // Compute movement based on keys
        if (keys['w'] || keys['arrowup']) dy -= PLAYER_SPEED * dt;
        if (keys['s'] || keys['arrowdown']) dy += PLAYER_SPEED * dt;
        if (keys['a'] || keys['arrowleft']) dx -= PLAYER_SPEED * dt;
        if (keys['d'] || keys['arrowright']) dx += PLAYER_SPEED * dt;
        
        // Normalize diagonal movement
        if (dx !== 0 && dy !== 0) {
          const length = Math.sqrt(dx * dx + dy * dy);
          dx = dx / length * PLAYER_SPEED * dt;
          dy = dy / length * PLAYER_SPEED * dt;
        }
        
        // Update position
        const newPosition = new Vector3(
          transform.position.x + dx,
          transform.position.y + dy,
          transform.position.z
        );
        
        // Keep within bounds
        newPosition.x = Math.max(20, Math.min(canvas.width - 20, newPosition.x));
        newPosition.y = Math.max(20, Math.min(canvas.height - 20, newPosition.y));
        
        // Update entity
        const newTransform = new Transform(
          newPosition,
          transform.rotation,
          transform.scale
        );
        
        realtime.updateEntity(localPlayerId, newTransform);
      }
    }
    
    // Render all entities
    for (const [entityId, entity] of entities.entries()) {
      // Get interpolated transform for rendering
      let renderTransform;
      if (entityId === localPlayerId && realtime.isOwnedByMe(localPlayerId)) {
        // Use latest transform for local player
        renderTransform = entity.transform;
      } else {
        // Use interpolated transform for other entities
        renderTransform = realtime.getInterpolatedTransform(entityId) || entity.transform;
      }
      
      // Skip entities without position
      if (!renderTransform) continue;
      
      // Render based on entity type
      if (entity.metadata.type === 'player') {
        const pos = renderTransform.position;
        const isLocal = entityId === localPlayerId && realtime.isOwnedByMe(localPlayerId);
        
        // Draw player
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 20, 0, Math.PI * 2);
        ctx.fillStyle = entity.metadata.color || '#ffffff';
        ctx.fill();
        
        // Draw outline for local player
        if (isLocal) {
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        
        // Draw player name
        ctx.font = '12px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText(entity.metadata.name || entityId, pos.x, pos.y - 30);
      }
    }
    
    requestAnimationFrame(gameLoop);
  };
  
  // Start game loop
  gameLoop(0);
};

// Auto-start if this is loaded directly
if (typeof window !== 'undefined') {
  window.addEventListener('load', runRealtimeExample);
}

export default runRealtimeExample;

// === puppeteer/examples/realtime-example.html ===
// <!DOCTYPE html>
// <html lang="en">
// <head>
//     <meta charset="UTF-8">
//     <meta name="viewport" content="width=device-width, initial-scale=1.0">
//     <title>Puppeteer.js Real-Time Example</title>
//     <style>
//         body {
//             margin: 0;
//             padding: 0;
//             overflow: hidden;
//             font-family: Arial, sans-serif;
//         }
//     </style>
// </head>
// <body>
//     <script type="module">
//         import runRealtimeExample from './realtime-example.js';
//         runRealtimeExample();
//     </script>
// </body>
// </html>