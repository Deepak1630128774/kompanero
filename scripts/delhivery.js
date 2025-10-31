const { browserPool } = require('../utils/browserPool');

const MAX_RETRIES = 2;
const TIMEOUT = 20000; // Balanced timeout for production
const PAGE_WAIT = 2000; // Wait time after page load

async function getStatus(page, trackingNumber, retryCount = 0) {
  try {
    const url = `https://www.delhivery.com/track-v2/package/${trackingNumber}`;
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });
    
    await new Promise(resolve => setTimeout(resolve, PAGE_WAIT));
    
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
    console.error(`[Delhivery] Error tracking ${trackingNumber} (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 2000));
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
