const { browserPool } = require('../utils/browserPool');

const TIMEOUT = 45000; // Increased timeout for better reliability
const MAX_RETRIES = 3;
const STATUS_KEYWORDS = [
  'Delivered', 'Out for Delivery', 'In Transit', 'In-Transit',
  'Reached', 'Arrived', 'Dispatched', 'Picked Up', 'Shipped',
  'Shipment Received', 'Shipment Created', 'Pending', 'Undelivered',
  'RTO', 'Return', 'Cancelled', 'Exception', 'In Process',
  'Processing', 'Booked', 'Consignment Delivered', 'In Transit to Destination',
  'Out for Pickup', 'Pickup Generated', 'In Transit to HUB', 'Reached HUB',
  'Out for Delivery - Attempted'
];

async function getStatusFromEKart(page, trackingNumber) {
  const url = `https://ekartlogistics.com/ekartlogistics-web/shipmenttrack/${trackingNumber}`;
  
  // Set user agent to avoid bot detection
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
  
  try {
    // Navigate with networkidle2 to ensure page is fully loaded
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    // Wait for common status elements to appear
    await Promise.race([
      page.waitForSelector('.tracking-details, .status, [class*="status-"], .shipment-status, .tracking-status, .status-text', { 
        timeout: 15000 
      }),
      page.waitForFunction(
        () => document.body && document.body.innerText.includes('Tracking Details'),
        { timeout: 10000 }
      )
    ]).catch(() => console.log('No specific status elements found, trying fallback detection'));
  } catch (error) {
    console.log(`Navigation error: ${error.message}, attempting to continue...`);
  }

  // Check for loading state and wait if needed
  const isLoading = await page.evaluate(() => {
    return document.body && 
      (document.body.innerText.includes('Loading') || 
       document.body.innerText.includes('Please wait') ||
       document.body.innerText.includes('tracking data'));
  });
  
  if (isLoading) {
    console.log('⏳ Detected loading state, waiting for content...');
    await page.waitForTimeout(3000); // Increased wait time for slow connections
  }

  // Using STATUS_KEYWORDS defined at the top of the file

  // Try multiple strategies to find the status
  const status = await page.evaluate((keywords) => {
    function normalize(s) { return (s || '').trim(); }
    
    // Strategy 1: Check common status element classes/IDs
    const statusSelectors = [
      '.status, [class*="status-"], .shipment-status, .tracking-status, .status-text',
      '.tracking-details',
      '.delivery-status, .shipment-info',
      '.panel, .card, .box',
      'table tr:has(td:first-child:contains("Status")) td:last-child',
      'div:contains("Status") + div',
      'span:contains("Status") + span'
    ];

    for (const selector of statusSelectors) {
      try {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const el of elements) {
          const text = normalize(el.textContent);
          if (!text) continue;
          
          // Check for exact matches
          for (const kw of keywords) {
            if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
              return kw;
            }
          }
        }
      } catch (e) {}
    }
    
    // Strategy 2: Find status in tables
    try {
      const tables = document.querySelectorAll('table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td, th');
          for (let i = 0; i < cells.length - 1; i++) {
            if (/status|current status|delivery status/i.test(normalize(cells[i].textContent))) {
              const statusText = normalize(cells[i + 1].textContent);
              if (statusText) return statusText;
            }
          }
        }
      }
    } catch (e) {}

    // Strategy 3: Find by text patterns
    const allText = document.body ? document.body.innerText : '';
    const lines = allText.split('\n').map(l => normalize(l)).filter(Boolean);
    
    // Look for status near tracking number or order number
    const trackingPatterns = [
      /tracking.*status[:\s]+([^\n]+)/i,
      /status[:\s]+([^\n]+)/i,
      /current.*status[:\s]+([^\n]+)/i
    ];
    
    for (const line of lines) {
      for (const pattern of trackingPatterns) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const statusText = normalize(match[1]);
          if (statusText) return statusText;
        }
      }
    }
    
    // Final fallback: Look for any status keyword in the page
    for (const line of lines) {
      for (const kw of keywords) {
        if (new RegExp(`\\b${kw}\\b`, 'i').test(line)) {
          return kw;
        }
      }
    }
    
    return null;
  }, STATUS_KEYWORDS);

  if (status) {
    console.log(`ℹ️ Found status from EKart: ${status}`);
    return { 
      status: status,
      source: 'ekart',
      timestamp: new Date().toISOString()
    };
  }
  
  // If no status found, try to get any status-like text
  try {
    const fallbackStatus = await page.evaluate(() => {
      // Look for status in common patterns
      const statusElements = [
        ...document.querySelectorAll('[class*="status"], [id*="status"]')
      ];
      
      for (const el of statusElements) {
        const text = (el.textContent || '').trim();
        if (text && (text.includes('Status:') || 
                     text.includes('Current Status:') || 
                     /status/i.test(el.className) ||
                     /status/i.test(el.id))) {
          return text.split(':').pop().trim();
        }
      }
      return null;
    });

    if (fallbackStatus) {
      console.log(`ℹ️ Found fallback status: ${fallbackStatus}`);
      return { 
        status: fallbackStatus, 
        source: 'ekart',
        isFallback: true,
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {
    console.log(`⚠️ Error in fallback status detection: ${e.message}`);
  }

  // If still no status, try to get the page title or h1
  try {
    const pageTitle = await page.title();
    if (pageTitle && pageTitle.toLowerCase().includes('tracking')) {
      return { 
        status: `Page loaded: ${pageTitle}`, 
        source: 'ekart',
        isFallback: true,
        timestamp: new Date().toISOString()
      };
    }
  } catch (e) {}

  return { 
    status: 'Status not found', 
    source: 'ekart',
    error: 'Could not determine shipment status',
    timestamp: new Date().toISOString()
  };
}

async function getStatusFromTrackCourier(page, trackingNumber) {
  const url = `https://trackcourier.io/track-and-trace/ekart-logistics-courier/${trackingNumber}`;
  
  try {
    console.log(`🌐 Trying TrackCourier as fallback for tracking: ${trackingNumber}`);
    
    // Set user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Block unnecessary resources to speed up loading
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Navigate with networkidle2 to ensure page is fully loaded
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: TIMEOUT
    });

    // Wait for the page to load completely
    try {
      await page.waitForSelector('.tracking-result, .status-container, .shipment-status, [class*="status-"]', { 
        timeout: 15000 
      });
    } catch (e) {
      console.log('TrackCourier: No specific status elements found, continuing...');
    }

    // Check for captcha or error pages
    const hasCaptcha = await page.evaluate(() => {
      return document.body && 
        (document.body.textContent.includes('captcha') || 
         document.body.textContent.includes('security check') ||
         document.querySelector('iframe[src*="captcha"]'));
    });

    if (hasCaptcha) {
      console.log('⚠️ TrackCourier is showing a CAPTCHA, status may be limited');
    }

    const result = await page.evaluate((keywords) => {
      function normalize(s) { return (s || '').trim(); }
      
      // Try to find status in common elements first
      const statusElements = [
        ...document.querySelectorAll('.status, .status-text, .shipment-status, [class*="status-"], .tracking-status')
      ];
      
      for (const el of statusElements) {
        const text = normalize(el.textContent);
        if (!text) continue;
        
        // Check for exact matches first
        for (const kw of keywords) {
          if (new RegExp(`\\b${kw}\\b`, 'i').test(text)) {
            return { 
              status: kw, 
              source: 'trackcourier',
              element: 'status-element'
            };
          }
        }
      }
      
      // Fallback: Look for status in tables
      try {
        const tables = document.querySelectorAll('table');
        for (const table of tables) {
          const rows = table.querySelectorAll('tr');
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th')).map(cell => normalize(cell.textContent));
            const statusIndex = cells.findIndex(cell => /status/i.test(cell));
            
            if (statusIndex !== -1 && cells[statusIndex + 1]) {
              const statusText = cells[statusIndex + 1];
              for (const kw of keywords) {
                if (new RegExp(`\\b${kw}\\b`, 'i').test(statusText)) {
                  return { 
                    status: kw, 
                    source: 'trackcourier',
                    element: 'table-cell'
                  };
                }
              }
              return { 
                status: statusText, 
                source: 'trackcourier',
                element: 'table-cell-raw'
              };
            }
          }
        }
      } catch (e) {}

      // Final fallback: Scan all text for status keywords
      const allText = document.body ? document.body.innerText : '';
      const lines = allText.split('\n').map(l => normalize(l)).filter(Boolean);
      
      for (const line of lines) {
        for (const kw of keywords) {
          if (new RegExp(`\\b${kw}\\b`, 'i').test(line)) {
            return { 
              status: kw, 
              source: 'trackcourier',
              element: 'text-scan'
            };
          }
        }
      }
      
      // If we still don't have a status, try to find any status-like text
      for (const line of lines) {
        if (/status[:\s]+/i.test(line)) {
          const statusText = line.split(/[:\s]+/).slice(1).join(' ').trim();
          if (statusText) {
            return { 
              status: statusText, 
              source: 'trackcourier',
              element: 'status-prefix'
            };
          }
        }
      }
      
      // Last resort: Return the page title or first heading
      const pageTitle = document.title || '';
      const heading = document.querySelector('h1, h2, h3')?.textContent || '';
      
      return { 
        status: heading || pageTitle || 'Status not found', 
        source: 'trackcourier',
        element: 'fallback',
        success: false,
        error: 'Could not determine status from TrackCourier'
      };
      
    }, STATUS_KEYWORDS);
    
    // Clean up request interception
    await page.setRequestInterception(false);
    
    return {
      ...result,
      timestamp: new Date().toISOString(),
      success: !result.error,
      trackingNumber: trackingNumber
    };
    
  } catch (error) {
    console.error(`❌ Error in TrackCourier fallback: ${error.message}`);
    return {
      status: 'Error',
      source: 'trackcourier',
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  } finally {
    // Ensure request interception is turned off
    try {
      await page.setRequestInterception(false);
    } catch (e) {}
  }
}

async function getStatus(page, trackingNumber, retryCount = 0) {
  const attemptStart = Date.now();
  const attemptNumber = retryCount + 1;
  
  console.log(`\n🔍 Attempt ${attemptNumber} to track: ${trackingNumber}`);
  
  try {
    let result;
    
    // Try primary source (EKart)
    try {
      console.log(`🔄 Trying EKart tracking...`);
      result = await getStatusFromEKart(page, trackingNumber);
      
      if (result.status === 'Status not found' || result.error) {
        throw new Error(result.error || 'Status not found in primary source');
      }
      
      console.log(`✅ EKart status: ${result.status}`);
      
      return {
        trackingNumber,
        status: result.status,
        source: result.source,
        success: true,
        attempts: attemptNumber,
        timestamp: new Date().toISOString(),
        responseTime: Date.now() - attemptStart
      };
      
    } catch (primaryError) {
      console.log(`⚠️ EKart tracking failed: ${primaryError.message}`);
      
      // Fallback to TrackCourier
      try {
        console.log(`🔄 Falling back to TrackCourier...`);
        result = await getStatusFromTrackCourier(page, trackingNumber);
        
        if (result.status === 'Status not found' || result.error) {
          throw new Error(result.error || 'Status not found in fallback source');
        }
        
        console.log(`✅ TrackCourier status: ${result.status}`);
        
        return {
          trackingNumber,
          status: result.status,
          source: result.source,
          success: true,
          isFallback: true,
          attempts: attemptNumber,
          timestamp: new Date().toISOString(),
          responseTime: Date.now() - attemptStart
        };
        
      } catch (fallbackError) {
        console.error(`❌ Both EKart and TrackCourier failed: ${fallbackError.message}`);
        throw fallbackError;
      }
    }
    
  } catch (error) {
    // Retry logic with exponential backoff
    if (retryCount < MAX_RETRIES - 1) {
      const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Max 10s delay
      console.log(`⏳ Retrying in ${delay/1000} seconds... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(r => setTimeout(r, delay));
      return getStatus(page, trackingNumber, retryCount + 1);
    }
    
    // All retries failed
    console.error(`❌ All tracking attempts failed for: ${trackingNumber}`);
    
    return {
      trackingNumber,
      status: 'Error',
      success: false,
      error: error.message || 'Unknown error',
      attempts: attemptNumber,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - attemptStart
    };
  }
}

async function trackEKart(trackingNumber) {
  const startTime = Date.now();
  
  // Validate tracking number
  if (!trackingNumber || typeof trackingNumber !== 'string' || !trackingNumber.trim()) {
    return {
      trackingNumber: trackingNumber || 'N/A',
      status: 'Error: Invalid tracking number',
      success: false,
      source: 'validation',
      timestamp: new Date().toISOString()
    };
  }
  
  // Normalize tracking number
  trackingNumber = trackingNumber.trim();
  
  try {
    console.log(`\n🚀 Starting EKart tracking for: ${trackingNumber}`);
    
    // Execute with browser pool
    const result = await browserPool.execute(async (page) => {
      // Set default timeout and viewport
      await page.setDefaultNavigationTimeout(TIMEOUT);
      await page.setViewport({ width: 1366, height: 768 });
      
      // Disable images and styles for faster loading
      await page.setRequestInterception(true);
      page.on('request', (request) => {
        const resourceType = request.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      // Get the status
      const statusResult = await getStatus(page, trackingNumber);
      
      // Clean up
      await page.setRequestInterception(false);
      
      return statusResult;
    });
    
    // Add timing information
    const responseTime = Date.now() - startTime;
    
    console.log(`\n✅ Tracking completed in ${(responseTime / 1000).toFixed(2)}s`);
    const rawStatus = result && result.status ? String(result.status).trim() : '';
    let normalizedStatus = rawStatus;
    const lowerStatus = rawStatus.toLowerCase();
    
    if (lowerStatus && !lowerStatus.includes('deliver') && (
      lowerStatus.includes('dispatched') ||
      lowerStatus.includes('shipment received') ||
      lowerStatus.includes('received at') ||
      lowerStatus.includes('mother hub')
    )) {
      normalizedStatus = 'In Transit';
    }
    
    console.log(`📦 Status: ${normalizedStatus}`);
    console.log(`🔗 Source: ${result.source}${result.isFallback ? ' (Fallback)' : ''}`);
    
    return {
      ...result,
      status: normalizedStatus,
      responseTime,
      timestamp: new Date().toISOString(),
      success: result.success !== false && !result.error
    };
    
  } catch (error) {
    console.error(`\n❌ Critical error in trackEKart: ${error.message}`);
    
    return {
      trackingNumber,
      status: `Error: ${error.message}`,
      success: false,
      source: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime
    };
  }
}

module.exports = { trackEKart };
