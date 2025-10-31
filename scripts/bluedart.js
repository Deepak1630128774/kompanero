const { browserPool } = require('../utils/browserPool');

const TIMEOUT = 30000; // Increased for production
const MAX_RETRIES = 2;
const PAGE_WAIT = 3000; // Reduced from 8s to 3s

async function getTrackingInfo(page, trackingNumber, retryCount = 0) {
  try {
    const url = `https://trackcourier.io/track-and-trace/blue-dart-courier/${trackingNumber}`;
    
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
      
      let status = 'Status not found';
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('Blue Dart Courier')) {
          if (i + 2 < lines.length) {
            const possibleStatus = lines[i + 2];
            if (possibleStatus.match(/^(Delivered|Out for Delivery|In Transit|Picked Up|Pending)/i)) {
              status = possibleStatus;
            }
          }
        }
      }
      
      return { status };
    });
    
    return {
      trackingNumber,
      status: result.status,
      success: true
    };
    
  } catch (error) {
    console.error(`[BlueDart] Error tracking ${trackingNumber} (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      return getTrackingInfo(page, trackingNumber, retryCount + 1);
    }
    
    return {
      trackingNumber,
      status: 'Error',
      success: false,
      error: error.message
    };
  }
}

async function trackBlueDart(trackingNumber) {
  try {
    const result = await browserPool.execute(async (page) => {
      return await getTrackingInfo(page, trackingNumber);
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

module.exports = { trackBlueDart };
