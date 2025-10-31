const axios = require('axios');
const cheerio = require('cheerio');

const MAX_RETRIES = 2;
const RETRY_DELAY = 2000; // 2 seconds
const REQUEST_TIMEOUT = 30000; // 30 seconds for slow production servers

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function trackDTDC(consignmentNo, retryCount = 0) {
  try {
    const url = `https://txk.dtdc.com/ctbs-tracking/customerInterface.tr?submitName=showCITrackingDetails&cType=Consignment&cnNo=${consignmentNo}`;
    
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive'
      },
      timeout: REQUEST_TIMEOUT
    });

    const $ = cheerio.load(data);

    let lastStatus = '';
    
    // Method 1: Look for "Last Status" label
    $('*').each((i, elem) => {
      const text = $(elem).text().trim();
      if (text === 'Last Status' || text === 'Last Status:') {
        let statusElem = $(elem).next();
        if (statusElem.length === 0) {
          statusElem = $(elem).parent().next();
        }
        
        let rawStatus = statusElem.text().trim();
        lastStatus = rawStatus.split('\n')[0].trim();
        return false;
      }
    });

    // Method 2: Look in table cells if Method 1 failed
    if (!lastStatus) {
      $('td, th').each((i, elem) => {
        const text = $(elem).text().trim();
        if (text.toLowerCase().includes('last status')) {
          const nextCell = $(elem).next('td');
          if (nextCell.length > 0) {
            lastStatus = nextCell.text().trim().split('\n')[0].trim();
            return false;
          }
        }
      });
    }

    // Method 3: Look for common status keywords in the page
    if (!lastStatus) {
      const statusKeywords = ['Delivered', 'In Transit', 'Out for Delivery', 'Picked Up', 'Booked', 'Pending'];
      const pageText = $('body').text();
      
      for (const keyword of statusKeywords) {
        if (pageText.includes(keyword)) {
          lastStatus = keyword;
          break;
        }
      }
    }

    if (lastStatus && lastStatus.length > 0) {
      return {
        success: true,
        status: lastStatus,
        trackingNumber: consignmentNo
      };
    } else {
      // Retry if we haven't exceeded max retries
      if (retryCount < MAX_RETRIES) {
        await sleep(RETRY_DELAY * (retryCount + 1));
        return trackDTDC(consignmentNo, retryCount + 1);
      }
      
      return {
        success: false,
        status: 'Status not found',
        trackingNumber: consignmentNo
      };
    }

  } catch (error) {
    console.error(`[DTDC] Error tracking ${consignmentNo} (attempt ${retryCount + 1}/${MAX_RETRIES + 1}):`, error.message);
    
    // Retry on error if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED')) {
      console.log(`[DTDC] Retrying ${consignmentNo} in ${RETRY_DELAY * (retryCount + 1)}ms...`);
      await sleep(RETRY_DELAY * (retryCount + 1));
      return trackDTDC(consignmentNo, retryCount + 1);
    }
    
    return {
      success: false,
      status: 'Error: ' + error.message,
      trackingNumber: consignmentNo
    };
  }
}

module.exports = { trackDTDC };
