require('dotenv').config();
const cluster = require('cluster');
const os = require('os');
const { createServer } = require('./src/server');
const logger = require('./src/config/logger');

const PORT = process.env.PORT || 3000;
const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
    logger.info(`Primary process ${process.pid} is running`);
    logger.info(`Forking server with ${numCPUs} processes for extreme concurrency...`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died. Respawning...`);
        cluster.fork();
    });
} else {
    // Worker process
    const { server } = createServer();
    server.listen(PORT, () => {
        logger.info(`Worker ${process.pid} started and listening on port ${PORT}`);
    });
}
