const { browserPool } = require('../utils/browserPool');

const MAX_RETRIES = 2;
const TIMEOUT = 15000;

async function getStatusFromDelhivery(page, trackingNumber) {
  const url = `https://www.delhivery.com/track-v2/package/${trackingNumber}`;
  
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT
  });
  
  try {
    await page.waitForFunction(() => {
      const text = document.body && document.body.innerText || '';
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
      return statusKeywords.some(k => text.includes(k));
    }, { timeout: 5000 });
  } catch (e) {}
  
  return await page.evaluate(() => {
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
    
    return { status, source: 'delhivery' };
  });
}

async function getStatusFromTrackCourier(page, trackingNumber) {
  const url = `https://trackcourier.io/track-and-trace/delhivery-courier/${trackingNumber}`;
  
  await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT
  });
  
  try {
    await page.waitForFunction(() => {
      const allText = document.body && document.body.innerText || '';
      const hasHeader = allText.includes('Delhivery Courier');
      if (hasHeader) return true;
      return /Delivered|Out for Delivery|In Transit|Picked Up|Pending|Dispatched|Failed|Returned|RTO|Cancelled/i.test(allText);
    }, { timeout: 5000 });
  } catch (e) {}
  
  return await page.evaluate(() => {
    const allText = document.body.innerText;
    const lines = allText.split('\n').map(l => l.trim()).filter(l => l);
    
    let status = 'Status not found';
    
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Delhivery Courier')) {
        if (i + 2 < lines.length) {
          const possibleStatus = lines[i + 2];
          if (possibleStatus.match(/^(Delivered|Out for Delivery|In Transit|Picked Up|Pending|Dispatched|Failed|Returned|RTO|Cancelled)/i)) {
            status = possibleStatus;
          }
        }
      }
    }
    
    return { status, source: 'trackcourier' };
  });
}

async function getStatus(page, trackingNumber, retryCount = 0) {
  try {
    // Try primary Delhivery tracking first
    let result;
    try {
      result = await getStatusFromDelhivery(page, trackingNumber);
      
      // If status not found in primary source, try backup source
      if (result.status === 'Status not found') {
        throw new Error('Status not found in primary source');
      }
      
      return {
        trackingNumber,
        status: result.status,
        source: result.source,
        success: true
      };
      
    } catch (primaryError) {
      // If primary source fails, try backup source
      try {
        result = await getStatusFromTrackCourier(page, trackingNumber);
        
        return {
          trackingNumber,
          status: result.status,
          source: result.source,
          success: true
        };
        
      } catch (backupError) {
        throw new Error(`Primary: ${primaryError.message}, Backup: ${backupError.message}`);
      }
    }
    
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
      success: false,
      source: 'error'
    };
  }
}

module.exports = { trackDelhivery };
