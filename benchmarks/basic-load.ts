import autocannon from 'autocannon';

async function runBenchmark() {
  console.log('🔥 Starting benchmark on http://localhost:3000 ...');

  const instance = autocannon({
    url: 'http://localhost:3000',
    connections: 10, // default
    pipelining: 1, // default
    duration: 10, // 10 seconds
    requests: [
        {
            method: 'GET',
            path: '/health' // We will target the health endpoint for a baseline
        }
    ]
  }, (err, result) => {
    if (err) {
        console.error('Benchmark failed:', err);
        return;
    }
    
    console.log('\n✅ Benchmark finished!');
    console.log('------------------------------------------------');
    console.log(`Total Requests: ${result.requests.total}`);
    console.log(`Duration:       ${result.duration}s`);
    console.log(`Throughput:     ${result.throughput.average} bytes/sec`);
    console.log('------------------------------------------------');
    console.log('Latency (Response Time):');
    console.log(`  Average:      ${result.latency.average} ms`);
    console.log(`  Std Dev:      ${result.latency.stddev} ms`);
    console.log(`  Min:          ${result.latency.min} ms`);
    console.log(`  Max:          ${result.latency.max} ms`);
    console.log(`  p99:          ${result.latency.p99} ms`);
    console.log('------------------------------------------------');
  });

  autocannon.track(instance, { renderProgressBar: true });
}

runBenchmark();
