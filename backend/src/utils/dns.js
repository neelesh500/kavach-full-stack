const dns = require('dns');

function ensureDns() {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    console.error('Could not set public DNS servers:', err.message);
  }
}

module.exports = { ensureDns };
