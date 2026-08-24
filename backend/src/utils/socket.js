let io = null;

function initSocket(server) {
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
  if (!io) {
    throw new Error('Socket.io not initialized yet');
  }
  return io;
}

module.exports = { initSocket, getIo };
