// === puppeteer/core/Snapshot.js ===
import Transform from './Transform.js';
import { now } from '../utils/Clock.js';

export default class Snapshot {
  constructor(transform, timestamp = now(), metadata = {}) {
    this.transform = transform instanceof Transform ? transform : Transform.deserialize(transform);
    this.timestamp = timestamp;
    this.metadata = metadata;
    this.id = metadata.id || null;
    this.authoritative = metadata.authoritative || false;
  }
  
  clone() {
    return new Snapshot(
      this.transform.clone(),
      this.timestamp,
      { ...this.metadata, id: this.id, authoritative: this.authoritative }
    );
  }
  
  serialize() {
    return {
      transform: this.transform.serialize(),
      timestamp: this.timestamp,
      metadata: this.metadata,
      id: this.id,
      authoritative: this.authoritative
    };
  }
  
  static deserialize(data) {
    return new Snapshot(
      Transform.deserialize(data.transform),
      data.timestamp,
      data.metadata || {}
    );
  }
  
  interpolate(other, t) {
    if (!(other instanceof Snapshot)) {
      throw new Error('Cannot interpolate with non-Snapshot object');
    }
    
    const interpolatedTransform = this.transform.lerp(other.transform, t);
    const interpolatedTimestamp = this.timestamp + t * (other.timestamp - this.timestamp);
    
    return new Snapshot(
      interpolatedTransform,
      interpolatedTimestamp,
      this.metadata
    );
  }
  
  extrapolate(deltaTime, velocity = null) {
    if (!velocity) {
      return this.clone();
    }
    
    const extrapolatedPosition = this.transform.position.add(
      velocity.multiplyScalar(deltaTime)
    );
    
    const extrapolatedTransform = new Transform(
      extrapolatedPosition,
      this.transform.rotation.clone(),
      this.transform.scale.clone()
    );
    
    return new Snapshot(
      extrapolatedTransform,
      this.timestamp + deltaTime,
      this.metadata
    );
  }
}
