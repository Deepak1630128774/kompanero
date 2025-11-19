const { trackEKart } = require('./scripts/ekart');
const { browserPool } = require('./utils/browserPool');

async function testTracking(trackingNumber) {
  console.log(`Testing EKart tracking for: ${trackingNumber}`);
  
  try {
    // Track the shipment using the browser pool
    const startTime = Date.now();
    const result = await browserPool.execute(async (page) => {
      return await trackEKart(trackingNumber);
    });
    
    const endTime = Date.now();
    
    console.log('\n=== Tracking Result ===');
    console.log(`Status: ${result.status}`);
    console.log(`Success: ${result.success}`);
    if (result.source) console.log(`Source: ${result.source}`);
    if (result.error) console.log(`Error: ${result.error}`);
    console.log(`Time taken: ${(endTime - startTime) / 1000} seconds`);
    
  } catch (error) {
    console.error('Error during tracking:', error);
  } finally {
    // Close the browser pool when done
    if (browserPool && typeof browserPool.close === 'function') {
      await browserPool.close();
    }
    process.exit(0);
  }
}

// Run the test with the provided tracking number
testTracking('LUAP0000377082');

