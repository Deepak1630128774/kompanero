const { browserPool } = require('../utils/browserPool');

const TIMEOUT = 45000;
const MAX_RETRIES = 1;
const RETRY_DELAY = 2000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// PRIMARY METHOD: Direct DTDC website tracking
async function trackDTDCDirect(page, trackingNumber, retryCount = 0) {
  try {
    const url = `https://txk.dtdc.com/ctbs-tracking/customerInterface.tr?submitName=showCITrackingDetails&cType=Consignment&cnNo=${trackingNumber}`;
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to tracking page
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT 
    });
    
    // Wait for content or status keywords to appear (fast exit)
    try {
      await page.waitForFunction(() => {
        const text = document.body && document.body.innerText || '';
        if (text.includes('Last Status')) return true;
        return /Delivered|In Transit|Out for Delivery|Picked Up|Booked|Pending/i.test(text);
      }, { timeout: 5000 });
    } catch (e) {}
    
    // Extract status using page.evaluate
    const lastStatus = await page.evaluate(() => {
      let status = '';
      
      // Method 1: Look for "Last Status" label
      const allElements = document.querySelectorAll('*');
      for (const elem of allElements) {
        const text = elem.textContent.trim();
        if (text === 'Last Status' || text === 'Last Status:') {
          const nextElem = elem.nextElementSibling || elem.parentElement?.nextElementSibling;
          if (nextElem) {
            const rawStatus = nextElem.textContent.trim();
            status = rawStatus.split('\n')[0].trim();
            break;
          }
        }
      }
      
      // Method 2: Look in table cells if Method 1 failed
      if (!status) {
        const cells = document.querySelectorAll('td, th');
        for (const cell of cells) {
          const text = cell.textContent.trim();
          if (text.toLowerCase().includes('last status')) {
            const nextCell = cell.nextElementSibling;
            if (nextCell && nextCell.tagName === 'TD') {
              status = nextCell.textContent.trim().split('\n')[0].trim();
              break;
            }
          }
        }
      }
      
      // Method 3: Look for common status keywords in the page
      if (!status) {
        const statusKeywords = ['Delivered', 'In Transit', 'Out for Delivery', 'Picked Up', 'Booked', 'Pending'];
        const pageText = document.body.textContent;
        
        for (const keyword of statusKeywords) {
          if (pageText.includes(keyword)) {
            status = keyword;
            break;
          }
        }
      }
      
      return status;
    });

    if (lastStatus && lastStatus.length > 0) {
      return {
        trackingNumber,
        status: lastStatus,
        success: true,
        method: 'direct'
      };
    } else {
      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        await sleep(RETRY_DELAY * (retryCount + 1));
        return trackDTDCDirect(page, trackingNumber, retryCount + 1);
      }
      
      return {
        trackingNumber,
        status: 'Status not found',
        success: false,
        method: 'direct'
      };
    }

  } catch (error) {
    // Retry on error if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES && (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT')) {
      await sleep(RETRY_DELAY * (retryCount + 1));
      return trackDTDCDirect(page, trackingNumber, retryCount + 1);
    }
    
    return {
      trackingNumber,
      status: 'Error: ' + error.message,
      success: false,
      method: 'direct',
      error: error.message
    };
  }
}

// FALLBACK METHOD: trackcourier.io tracking
async function trackDTDCFallback(page, trackingNumber, retryCount = 0) {
  try {
    const url = `https://trackcourier.io/track-and-trace/dtdc/${trackingNumber}`;
    
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: TIMEOUT
    });
    
    // Quick targeted wait for status text
    try {
      await page.waitForFunction(() => {
        const text = document.body && document.body.innerText || '';
        return /Delivered|Out for Delivery|In Transit|In-Transit|Picked Up|Pending|Dispatched|Booked|Shipment Picked|Consignment Delivered|DTDC/i.test(text);
      }, { timeout: 5000 });
    } catch (e) {}
    
    const result = await page.evaluate(() => {
      const allText = document.body.innerText;
      const lines = allText.split('\n').map(l => l.trim()).filter(l => l);
      
      let status = 'Status not found';
      
      // Search for status keywords in all text
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if line contains status keywords
        if (line.match(/^(Delivered|Out for Delivery|In Transit|In-Transit|Picked Up|Pending|Dispatched|Booked|Shipment Picked|Consignment Delivered)/i)) {
          status = line;
          break;
        }
        
        // Check after DTDC mention
        if (line.includes('DTDC')) {
          if (i + 2 < lines.length) {
            const possibleStatus = lines[i + 2];
            if (possibleStatus.match(/^(Delivered|Out for Delivery|In Transit|In-Transit|Picked Up|Pending|Dispatched|Booked)/i)) {
              status = possibleStatus;
              break;
            }
          }
        }
      }
      
      return { status };
    });
    
    return {
      trackingNumber,
      status: result.status,
      success: result.status !== 'Status not found',
      method: 'fallback'
    };
    
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      await sleep(RETRY_DELAY);
      return trackDTDCFallback(page, trackingNumber, retryCount + 1);
    }
    
    return {
      trackingNumber,
      status: 'Error',
      success: false,
      method: 'fallback',
      error: error.message
    };
  }
}

async function trackDTDC(trackingNumber) {
  try {
    const result = await browserPool.execute(async (page) => {
      // Try primary method first (direct DTDC website)
      console.log(`[DTDC] Trying direct method for ${trackingNumber}`);
      const directResult = await trackDTDCDirect(page, trackingNumber);
      
      // Check if direct method succeeded
      if (directResult.success && 
          directResult.status && 
          directResult.status !== 'Status not found' && 
          !directResult.status.toLowerCase().includes('error')) {
        console.log(`[DTDC] ✓ Direct method succeeded: ${directResult.status}`);
        return directResult;
      }
      
      // If direct method failed, try fallback
      console.log(`[DTDC] Direct method failed, trying fallback for ${trackingNumber}`);
      const fallbackResult = await trackDTDCFallback(page, trackingNumber);
      
      if (fallbackResult.success) {
        console.log(`[DTDC] ✓ Fallback method succeeded: ${fallbackResult.status}`);
        return fallbackResult;
      }
      
      // Both methods failed, return the better result
      console.log(`[DTDC] Both methods failed for ${trackingNumber}`);
      return directResult.status !== 'Status not found' ? directResult : fallbackResult;
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

module.exports = { trackDTDC };
