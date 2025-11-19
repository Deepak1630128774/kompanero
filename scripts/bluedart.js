const { browserPool } = require('../utils/browserPool');

const TIMEOUT = 30000;
const MAX_RETRIES = 2;

async function getTrackingInfo(page, trackingNumber, retryCount = 0) {
  try {
    const url = `https://trackcourier.io/track-and-trace/blue-dart-courier/${trackingNumber}`;
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });
    
    try {
      await page.waitForFunction(() => {
        const allText = document.body && document.body.innerText || '';
        return allText.includes('Blue Dart Courier') || /Delivered|Out for Delivery|In Transit|Picked Up|Pending/i.test(allText);
      }, { timeout: 5000 });
    } catch (e) {}
    
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
