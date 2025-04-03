let socket;
const listeners = {};

export function connect(url) {
  socket = new WebSocket(url);
  socket.onmessage = (msg) => {
    const { type, data } = JSON.parse(msg.data);
    if (listeners[type]) listeners[type](data);
  };
}

export function send(type, data) {
  socket.send(JSON.stringify({ type, data }));
}

export function on(type, callback) {
  listeners[type] = callback;
}
