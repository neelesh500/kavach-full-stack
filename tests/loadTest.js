const axios = require('axios');

async function runLoadTest(concurrentRequests) {
    console.log(`Initialising load test with ${concurrentRequests} concurrent simulated examinees...`);

    // Target the Node.js API Gateway firewall layer 
    const gatewayUrl = 'http://localhost:3000/api/v1/questions/submit';

    let promises = [];
    const payloadBytes = "A".repeat(45000); // ~45kb payload (Just under 50kb DDoS cap)

    for (let i = 0; i < concurrentRequests; i++) {
        promises.push(
            axios.post(gatewayUrl, {
                plaintextQuestion: payloadBytes,
                metadata: { exam: "KAVACH-PHASE-1", sessionToken: `token-${i}` }
            }).catch(e => e.response ? e.response.status : "Gateway Unreachable")
        );
    }

    console.time("LoadTestExecution");
    const results = await Promise.all(promises);
    console.timeEnd("LoadTestExecution");

    const successes = results.filter(r => r && r.status === 201).length;
    const rateLimits = results.filter(r => r === 429).length;
    const failures = results.length - successes - rateLimits;

    console.log('\n---- ZERO-TRUST THROUGHPUT METRICS ----');
    console.log(`Total Requests Injected: ${concurrentRequests}`);
    console.log(`Success (201 Secured & Wiped): ${successes}`);
    console.log(`Rate Limited (429 Rejected): ${rateLimits}`);
    console.log(`Failed / Other: ${failures}`);
}

// Simulated concurrency limits for local workstation checks
runLoadTest(50);
