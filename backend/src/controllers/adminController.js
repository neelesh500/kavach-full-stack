const { seedCustodiansAndShares } = require('../services/seedService');

async function setup(req, res) {
  const data = await seedCustodiansAndShares();
  res.json({
    message: '5 custodians created, master key split into 5 shares (threshold 3)',
    ...data
  });
}

module.exports = { setup };
