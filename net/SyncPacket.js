export function encodeTransform(id, transform, timestamp) {
  return JSON.stringify({
    type: 'transform',
    id,
    position: transform.position,
    rotation: transform.rotation,
    timestamp
  });
}

export function decodeTransform(json) {
  const { id, position, rotation, timestamp } = JSON.parse(json);
  return {
    id,
    transform: new Transform(
      new Vector3(position.x, position.y, position.z),
      new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w)
    ),
    timestamp
  };
}