const { browserPool } = require('../utils/browserPool');

const MAX_RETRIES = 2;
const TIMEOUT = 15000;

async function getStatus(page, trackingNumber, retryCount = 0) {
  try {
    const url = `https://www.delhivery.com/track-v2/package/${trackingNumber}`;
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const result = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l);
      
      const statusKeywords = [
        'Pick up Pending',
        'Picked up',
        'In Transit',
        'Out for Delivery',
        'Delivered',
        'Dispatched',
        'Pending',
        'Failed',
        'Returned',
        'RTO',
        'Cancelled'
      ];
      
      let status = 'Status not found';
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const keyword of statusKeywords) {
          if (line === keyword || line.startsWith(keyword)) {
            status = keyword;
            break;
          }
        }
        if (status !== 'Status not found') break;
      }
      
      return { status };
    });
    
    return {
      trackingNumber,
      status: result.status,
      success: true
    };
    
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return getStatus(page, trackingNumber, retryCount + 1);
    }
    
    return {
      trackingNumber,
      status: 'Error',
      success: false,
      error: error.message
    };
  }
}

async function trackDelhivery(trackingNumber) {
  try {
    const result = await browserPool.execute(async (page) => {
      return await getStatus(page, trackingNumber);
    });
    
    return result;
    
  } catch (error) {
    return {
      trackingNumber,
      status: 'Error: ' + error.message,
      success: false
    };
  }
}

module.exports = { trackDelhivery };
