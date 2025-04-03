import Snapshot from '../core/Snapshot.js';

const buffer = {};

export function addSnapshot(id, snapshot) {
  if (!buffer[id]) buffer[id] = [];
  buffer[id].push(snapshot);
  if (buffer[id].length > 20) buffer[id].shift();
}

export function getInterpolatedTransform(id, now) {
  const snaps = buffer[id];
  if (!snaps || snaps.length < 2) return null;

  let a = null, b = null;
  for (let i = snaps.length - 2; i >= 0; i--) {
    if (snaps[i].timestamp <= now) {
      a = snaps[i];
      b = snaps[i + 1];
      break;
    }
  }

  if (!a || !b) return a?.transform || null;

  const t = (now - a.timestamp) / (b.timestamp - a.timestamp);
  return {
    position: a.transform.position.lerp(b.transform.position, t),
    rotation: a.transform.rotation.slerp(b.transform.rotation, t)
  };
}
