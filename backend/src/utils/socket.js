let io = null;

function initSocket(server) {
  if (process.env.VERCEL) {
    io = { emit: () => { } };
    return io;
  }
  const { Server } = require('socket.io');
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });
  io.on('connection', (socket) => {
    socket.emit('connected', { message: 'Real-time channel ready' });
  });
  return io;
}

function getIo() {
  if (process.env.VERCEL && !io) {
    return { emit: () => { } };
  }
  if (!io) {
    // Graceful fallback incase serverless misses init
    return { emit: () => { } };
  }
  return io;
}

module.exports = { initSocket, getIo };
