const puppeteer = require('puppeteer');

const MAX_RETRIES = 1;
const RETRY_DELAY = 2000; // 2 seconds
const REQUEST_TIMEOUT = 45000; // 45 seconds

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function trackDTDC(consignmentNo, retryCount = 0) {
  let browser = null;
  
  try {
    const url = `https://txk.dtdc.com/ctbs-tracking/customerInterface.tr?submitName=showCITrackingDetails&cType=Consignment&cnNo=${consignmentNo}`;
    
    // Launch browser with production-friendly settings
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920x1080'
      ],
      timeout: REQUEST_TIMEOUT
    });

    const page = await browser.newPage();
    
    // Set realistic viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to tracking page
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: REQUEST_TIMEOUT 
    });

    // Wait a bit for dynamic content
    await sleep(2000);
    
    // Extract status using page.evaluate (runs in browser context)
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

    // Close browser before returning
    await browser.close();
    
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
    // Ensure browser is closed on error
    if (browser) {
      try {
        await browser.close();
      } catch (closeError) {
        console.error('Error closing browser:', closeError.message);
      }
    }
    
    // Retry on error if we haven't exceeded max retries
    if (retryCount < MAX_RETRIES && (error.name === 'TimeoutError' || error.code === 'ETIMEDOUT')) {
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
