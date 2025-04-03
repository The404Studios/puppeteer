// === puppeteer/net/Prediction.js ===
import { now } from '../utils/Clock.js';
import Vector3 from '../core/Vector3.js';
import Transform from '../core/Transform.js';

export class PredictionSystem {
  constructor(config = {}) {
    this.config = {
      bufferSize: 60,         // Number of inputs to store
      reconciliationThreshold: 0.01,  // Minimum difference to apply correction
      maxRewindTime: 500,     // Maximum ms to rewind for reconciliation
      smoothingFactor: 0.3,   // Correction blending factor (0-1)
      ...config
    };
    
    this.inputBuffer = [];    // Store of sent inputs
    this.lastProcessedInput = 0;  // Last input acknowledged by server
    this.pendingCorrection = null;  // Server correction to apply
    this.entityId = null;     // ID of the entity being predicted
  }
  
  setEntityId(entityId) {
    this.entityId = entityId;
  }
  
  recordInput(inputState, sequence) {
    // Store input with timestamp and sequence number
    this.inputBuffer.push({
      state: inputState,
      sequence: sequence,
      timestamp: now(),
      processed: false
    });
    
    // Keep buffer size in check
    while (this.inputBuffer.length > this.config.bufferSize) {
      this.inputBuffer.shift();
    }
    
    return sequence;
  }
  
  processServerUpdate(serverState, lastProcessedSequence) {
    // Mark inputs as processed
    for (const input of this.inputBuffer) {
      if (input.sequence <= lastProcessedSequence) {
        input.processed = true;
      }
    }
    
    this.lastProcessedInput = lastProcessedSequence;
    
    // Calculate if we need to reconcile
    const needsReconciliation = this._needsReconciliation(serverState);
    
    if (needsReconciliation) {
      this.pendingCorrection = {
        serverState: serverState,
        unprocessedInputs: this.inputBuffer.filter(input => !input.processed)
      };
    }
    
    return needsReconciliation;
  }
  
  _needsReconciliation(serverState) {
    if (!this.entityId) return false;
    
    // Get our current predicted position
    const clientState = this._getCurrentState();
    if (!clientState) return false;
    
    // Compare positions
    const positionDifference = clientState.position.distanceTo(serverState.position);
    
    // Check if difference exceeds threshold
    return positionDifference > this.config.reconciliationThreshold;
  }
  
  reconcile(movementController) {
    if (!this.pendingCorrection) return false;
    
    const { serverState, unprocessedInputs } = this.pendingCorrection;
    
    // Reset to server state
    movementController.setPosition(serverState.position);
    movementController.setVelocity(serverState.velocity || new Vector3());
    
    // Reapply all unprocessed inputs
    for (const input of unprocessedInputs) {
      // Apply the input to the movement controller
      movementController.setInput(input.state);
      movementController.update();
    }
    
    this.pendingCorrection = null;
    return true;
  }
  
  _getCurrentState() {
    // This would get the current state from whatever system is tracking it
    // For example, from the movement controller
    return null; // Placeholder
  }
  
  getPendingInputCount() {
    return this.inputBuffer.filter(input => !input.processed).length;
  }
  
  clearBuffer() {
    this.inputBuffer = [];
    this.lastProcessedInput = 0;
    this.pendingCorrection = null;
  }
}