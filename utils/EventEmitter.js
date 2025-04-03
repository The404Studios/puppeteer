// === puppeteer/utils/EventEmitter.js ===

/**
 * A lightweight event handling system
 * Allows registration, deregistration, and triggering of events
 */
export default class EventEmitter {
  constructor() {
    this._events = new Map();
    this._onceEvents = new Map();
  }
  
  /**
   * Register an event handler for a specific event type
   * @param {string} eventType - The name of the event to listen for
   * @param {Function} handler - The callback function to execute when the event occurs
   * @returns {EventEmitter} - Returns this instance for chaining
   */
  on(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function');
    }
    
    if (!this._events.has(eventType)) {
      this._events.set(eventType, []);
    }
    
    this._events.get(eventType).push(handler);
    return this;
  }
  
  /**
   * Register an event handler that will be removed after it's called once
   * @param {string} eventType - The name of the event to listen for
   * @param {Function} handler - The callback function to execute when the event occurs
   * @returns {EventEmitter} - Returns this instance for chaining
   */
  once(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function');
    }
    
    if (!this._onceEvents.has(eventType)) {
      this._onceEvents.set(eventType, []);
    }
    
    this._onceEvents.get(eventType).push(handler);
    return this;
  }
  
  /**
   * Remove an event handler for a specific event type
   * @param {string} eventType - The name of the event
   * @param {Function} [handler] - The callback function to remove. If omitted, all handlers for this event type will be removed
   * @returns {EventEmitter} - Returns this instance for chaining
   */
  off(eventType, handler) {
    // If no handler is specified, remove all handlers for this event type
    if (!handler) {
      this._events.delete(eventType);
      this._onceEvents.delete(eventType);
      return this;
    }
    
    // Otherwise, remove the specific handler
    if (this._events.has(eventType)) {
      const handlers = this._events.get(eventType);
      const index = handlers.indexOf(handler);
      
      if (index !== -1) {
        handlers.splice(index, 1);
        
        // If no more handlers, remove the event type from the map
        if (handlers.length === 0) {
          this._events.delete(eventType);
        }
      }
    }
    
    // Also check once events
    if (this._onceEvents.has(eventType)) {
      const handlers = this._onceEvents.get(eventType);
      const index = handlers.indexOf(handler);
      
      if (index !== -1) {
        handlers.splice(index, 1);
        
        // If no more handlers, remove the event type from the map
        if (handlers.length === 0) {
          this._onceEvents.delete(eventType);
        }
      }
    }
    
    return this;
  }
  
  /**
   * Emit an event, triggering all registered handlers
   * @param {string} eventType - The name of the event to emit
   * @param {...any} args - Arguments to pass to the event handlers
   * @returns {boolean} - Returns true if any handlers were called, false otherwise
   */
  emit(eventType, ...args) {
    let handled = false;
    
    // Handle regular event listeners
    if (this._events.has(eventType)) {
      const handlers = this._events.get(eventType);
      
      for (const handler of handlers) {
        try {
          handler(...args);
          handled = true;
        } catch (error) {
          console.error(`Error in event handler for "${eventType}":`, error);
        }
      }
    }
    
    // Handle one-time event listeners
    if (this._onceEvents.has(eventType)) {
      const handlers = this._onceEvents.get(eventType);
      
      // Clear the handlers first to prevent issues if the handler registers again
      this._onceEvents.delete(eventType);
      
      for (const handler of handlers) {
        try {
          handler(...args);
          handled = true;
        } catch (error) {
          console.error(`Error in one-time event handler for "${eventType}":`, error);
        }
      }
    }
    
    return handled;
  }
  
  /**
   * Get all registered event types
   * @returns {Array<string>} - Array of event type names
   */
  eventNames() {
    const eventTypes = new Set([
      ...this._events.keys(),
      ...this._onceEvents.keys()
    ]);
    
    return Array.from(eventTypes);
  }
  
  /**
   * Get the count of listeners for a specific event type
   * @param {string} eventType - The name of the event
   * @returns {number} - The number of listeners
   */
  listenerCount(eventType) {
    let count = 0;
    
    if (this._events.has(eventType)) {
      count += this._events.get(eventType).length;
    }
    
    if (this._onceEvents.has(eventType)) {
      count += this._onceEvents.get(eventType).length;
    }
    
    return count;
  }
  
  /**
   * Remove all event listeners
   * @returns {EventEmitter} - Returns this instance for chaining
   */
  removeAllListeners() {
    this._events.clear();
    this._onceEvents.clear();
    return this;
  }
}