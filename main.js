const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Load .env from the correct location (development vs production)
const isDev = !app.isPackaged;
const envPath = isDev 
  ? path.join(__dirname, '.env')
  : path.join(process.resourcesPath, '.env');

// Check if .env exists, if not try current directory (for portable exe)
const finalEnvPath = fs.existsSync(envPath) 
  ? envPath 
  : path.join(path.dirname(process.execPath), '.env');

require('dotenv').config({ path: finalEnvPath });

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { trackDTDC } = require('./scripts/dtdc');
const { trackBlueDart } = require('./scripts/bluedart');
const { trackDelhivery } = require('./scripts/delhivery');
const { trackEKart } = require('./scripts/ekart');
const { convertToCSV } = require('./utils/csvExport');
const { sendPickupPendingEmail, sendUnfulfilledOrdersEmail, sendNotDeliveredOrdersEmail } = require('./utils/email');

let mainWindow;
let server;
const PORT = 3000;

// Express server setup
function startExpressServer() {
  const expressApp = express();
  
  expressApp.use(bodyParser.json());
  expressApp.use(express.static(path.join(__dirname, 'public')));

  // Shopify configuration
  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

  // Validate Shopify credentials
  if (!SHOPIFY_STORE_URL || !SHOPIFY_ACCESS_TOKEN) {
    console.error('\n❌ ERROR: Shopify credentials not found!');
    console.error('📝 Please create a .env file with:');
    console.error('   SHOPIFY_STORE_URL=your-store.myshopify.com');
    console.error('   SHOPIFY_ACCESS_TOKEN=shpat_your_token_here');
    console.error(`\n📁 .env file should be at: ${finalEnvPath}\n`);
  }

  // Helper function to fetch Shopify orders with pagination
  async function fetchShopifyOrders(fromDate, toDate, fulfillmentStatus = 'all') {
    try {
      let allOrders = [];
      let nextPageUrl = null;
      let hasNextPage = true;
      
      while (hasNextPage) {
        let response;
        
        if (nextPageUrl) {
          response = await axios.get(nextPageUrl, { 
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
          });
        } else {
          const url = `https://${SHOPIFY_STORE_URL}/admin/api/${SHOPIFY_API_VERSION}/orders.json`;
          const params = {
            status: 'any',
            created_at_min: fromDate,
            created_at_max: toDate,
            limit: 250
          };

          // Add fulfillment status filter if specified
          if (fulfillmentStatus === 'fulfilled') {
            params.fulfillment_status = 'shipped';
          } else if (fulfillmentStatus === 'unfulfilled') {
            params.fulfillment_status = 'unshipped';
          }
          // If 'all', don't add fulfillment_status parameter to get all orders

          response = await axios.get(url, { 
            params,
            headers: {
              'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
            }
          });
        }

        const orders = response.data.orders || [];
        allOrders = allOrders.concat(orders);

        const linkHeader = response.headers.link;
        if (linkHeader && linkHeader.includes('rel="next"')) {
          const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
          if (nextMatch) {
            nextPageUrl = nextMatch[1];
          } else {
            hasNextPage = false;
          }
        } else {
          hasNextPage = false;
        }

        console.log(`Fetched ${orders.length} orders (Total: ${allOrders.length})`);
        
        if (orders.length < 250) {
          hasNextPage = false;
        }
      }

      return allOrders;
    } catch (error) {
      console.error('Error fetching Shopify orders:', error.message);
      throw new Error('Failed to fetch orders from Shopify');
    }
  }

  // Helper function to track order based on carrier and/or tracking URL
  async function trackOrder(carrier, trackingNumber, trackingUrl) {
    try {
      const raw = (carrier || '').toString();
      const lower = raw.toLowerCase().trim();
      const reduced = lower.replace(/[^a-z]/g, ''); // remove spaces, dashes, etc.

      // Normalize by includes to handle variations from Shopify
      if (reduced.includes('dtdc')) {
        return await trackDTDC(trackingNumber);
      }
      if (reduced.includes('bluedart')) {
        return await trackBlueDart(trackingNumber);
      }
      if (reduced.includes('delhivery')) {
        return await trackDelhivery(trackingNumber);
      }
      if (
        reduced.includes('ekart') ||
        reduced.includes('flipkart') ||
        reduced.includes('kart') ||
        lower.includes('ekart') ||
        lower.includes('e-kart') ||
        lower.includes('e kart') ||
        lower.includes('flipkart') ||
        lower.includes('kart')
      ) {
        return await trackEKart(trackingNumber);
      }

      // Fallback by tracking URL if carrier label is unreliable
      const urlLower = (trackingUrl || '').toString().toLowerCase();
      if (urlLower) {
        if (urlLower.includes('dtdc') || urlLower.includes('/track-and-trace/dtdc')) {
          return await trackDTDC(trackingNumber);
        }
        if (urlLower.includes('blue-dart') || urlLower.includes('bluedart') || urlLower.includes('/track-and-trace/blue-dart')) {
          return await trackBlueDart(trackingNumber);
        }
        if (urlLower.includes('delhivery') || urlLower.includes('/track-and-trace/delhivery')) {
          return await trackDelhivery(trackingNumber);
        }
        if (urlLower.includes('ekart') || urlLower.includes('ekartlogistics') || urlLower.includes('flipkart')) {
          return await trackEKart(trackingNumber);
        }
      }

      // Final fallback by tracking number patterns (e.g., EKart LUAP prefix)
      const tnLower = (trackingNumber || '').toString().toLowerCase();
      if (/^lua/.test(tnLower)) {
        return await trackEKart(trackingNumber);
      }

      console.log(`[Router:electron] Carrier not supported. carrier='${carrier}', url='${trackingUrl || ''}'`);
      return {
        success: false,
        status: 'Carrier not supported',
        trackingNumber
      };
    } catch (error) {
      return {
        success: false,
        status: 'Error: ' + error.message,
        trackingNumber
      };
    }
  }

  // Store active SSE connections
  const activeConnections = new Map();

  // SSE endpoint for real-time progress
  expressApp.get('/api/process-orders-stream/:sessionId', (req, res) => {
    const sessionId = req.params.sessionId;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    activeConnections.set(sessionId, res);

    req.on('close', () => {
      activeConnections.delete(sessionId);
    });
  });

  // API endpoint to process orders with real-time updates
  expressApp.post('/api/process-orders', async (req, res) => {
    const requestId = Date.now().toString().slice(-4);
    const sessionId = req.body.sessionId;
    
    try {
      const { fromDate, toDate, carrier, fulfillmentStatus } = req.body;

      if (!fromDate || !toDate) {
        return res.status(400).json({ error: 'Date range is required' });
      }

      console.log(`\n[${requestId}] Processing orders from ${fromDate} to ${toDate}, carrier: ${carrier || 'All'}, fulfillment: ${fulfillmentStatus || 'All'}`);

      // Send initial progress
      sendProgress(sessionId, { stage: 'fetching', processed: 0, total: 0, percentage: 0 });

      const orders = await fetchShopifyOrders(fromDate, toDate, fulfillmentStatus || 'all');
      console.log(`[${requestId}] ✓ Total orders fetched: ${orders.length}`);

      // Send total count
      sendProgress(sessionId, { stage: 'processing', processed: 0, total: orders.length, percentage: 0 });

      // Process orders in small batches to prevent system overload
      const BATCH_SIZE = 5; // Process 3 orders at a time
      const results = [];
      let processedCount = 0;
      
      for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = orders.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (order) => {
          try {
            // Get customer name
            const customerName = order.customer 
              ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
              : 'N/A';

            // Precompute order-level items string (fallback)
            const orderItemsString = order.line_items
              .map(item => `${item.title} (x${item.quantity})`)
              .join(', ');

            // Build results for each fulfillment (supports multiple tracking numbers)
            const fulfillmentResults = [];
            const fulfilledItemIds = new Set();

            // Group successful fulfillments by courier id (tracking number) so all items for the same tracking come in a single row
            const fulfillmentGroups = new Map();
            (order.fulfillments || []).forEach(fulfillment => {
              if ((fulfillment.status || '').toLowerCase() !== 'success') {
                return;
              }

              const trackingNumber = fulfillment.tracking_number || 'N/A';
              const trackingUrl = fulfillment.tracking_url || 'N/A';
              const carrierName = fulfillment.tracking_company || 'Unknown';
              const key = trackingNumber !== 'N/A' ? trackingNumber : `${carrierName}||${trackingUrl}`;

              if (!fulfillmentGroups.has(key)) {
                fulfillmentGroups.set(key, {
                  trackingNumber,
                  trackingUrl,
                  carrierName,
                  // Map of orderLineId -> { title, quantity }
                  lineItems: new Map()
                });
              }

              const group = fulfillmentGroups.get(key);
              (fulfillment.line_items || []).forEach(fli => {
                const orderLineId = fli.line_item_id || fli.id;
                if (!orderLineId) return;

                fulfilledItemIds.add(orderLineId);

                const title = fli.title || 'Unknown Item';
                const qty = fli.quantity || 0;

                const existing = group.lineItems.get(orderLineId);
                if (existing) {
                  existing.quantity += qty;
                } else {
                  group.lineItems.set(orderLineId, { title, quantity: qty });
                }
              });
            });

            // 2️⃣ Handle fulfilled parts (one row per courier id)
            for (const group of fulfillmentGroups.values()) {
              let trackingStatus = 'Unfulfilled';
              if (group.trackingNumber !== 'N/A') {
                const trackingResult = await trackOrder(group.carrierName, group.trackingNumber, group.trackingUrl);
                trackingStatus = trackingResult.status || 'Unknown';
              }

              const orderedItemsString = Array.from(group.lineItems.values())
                .map(li => `${li.title} (x${li.quantity})`)
                .join(', ');

              fulfillmentResults.push({
                orderId: order.name,
                orderDate: new Date(order.created_at).toLocaleDateString(),
                customerName,
                orderedItems: orderedItemsString || orderItemsString,
                carrier: group.carrierName,
                trackingNumber: group.trackingNumber,
                trackingUrl: group.trackingUrl,
                trackingStatus
              });
            }

            // 3️⃣ Handle pending (unfulfilled) line items based on Shopify's fulfillable_quantity
            const pendingItems = (order.line_items || []).filter(li => (li.fulfillable_quantity || 0) > 0);

            if (pendingItems.length > 0) {
              fulfillmentResults.push({
                orderId: order.name,
                orderDate: new Date(order.created_at).toLocaleDateString(),
                customerName,
                orderedItems: pendingItems.map(li => `${li.title} (x${li.quantity})`).join(', '),
                carrier: 'Not Fulfilled',
                trackingNumber: 'N/A',
                trackingUrl: 'N/A',
                trackingStatus: 'Unfulfilled'
              });
            }

            return fulfillmentResults;
          } catch (error) {
            console.error(`Error processing order ${order.name}:`, error.message);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.flat().filter(result => result !== null));
        
        processedCount = Math.min(i + BATCH_SIZE, orders.length);
        const percentage = Math.floor((processedCount / orders.length) * 100);
        
        // Send progress update after each batch
        sendProgress(sessionId, { 
          stage: 'processing', 
          processed: processedCount, 
          total: orders.length, 
          percentage 
        });
        
        console.log(`[${requestId}] Processed ${processedCount}/${orders.length} orders (${percentage}%)`);
      }

      // Send completion
      sendProgress(sessionId, { 
        stage: 'complete', 
        processed: orders.length, 
        total: orders.length, 
        percentage: 100 
      });

      const unfulfilledOrders = [];
      const notDeliveredOrders = [];

      results.forEach((order) => {
        const status = (order.trackingStatus || '').toLowerCase();
        const carrierNameLower = (order.carrier || '').toLowerCase();
        const isUnfulfilled = status.includes('unfulfilled') || carrierNameLower === 'not fulfilled';
        const isNotDelivered = status.includes('not delivered') || status.includes('undelivered');

        if (isUnfulfilled) {
          unfulfilledOrders.push(order);
        }
        if (isNotDelivered) {
          notDeliveredOrders.push(order);
        }
      });

      if (unfulfilledOrders.length > 0) {
        try {
          await sendUnfulfilledOrdersEmail(unfulfilledOrders, {
            fromDate,
            toDate,
            carrier,
            fulfillmentStatus
          });
        } catch (emailError) {
          console.error('Error sending unfulfilled orders email:', emailError.message || emailError);
        }
      }

      if (notDeliveredOrders.length > 0) {
        try {
          await sendNotDeliveredOrdersEmail(notDeliveredOrders, {
            fromDate,
            toDate,
            carrier,
            fulfillmentStatus
          });
        } catch (emailError) {
          console.error('Error sending not delivered orders email:', emailError.message || emailError);
        }
      }

      console.log(`[${requestId}] ✓ Completed: ${results.length} orders processed\n`);
      res.json({ success: true, data: results, totalOrders: orders.length });

    } catch (error) {
      console.error(`[${requestId}] Error processing orders:`, error);
      sendProgress(sessionId, { stage: 'error', error: error.message });
      res.status(500).json({ error: error.message });
    }
  });

  // Helper function to send progress updates
  function sendProgress(sessionId, data) {
    if (!sessionId) return;
    const connection = activeConnections.get(sessionId);
    if (connection) {
      connection.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }

  // Test endpoint to track a single shipment
  expressApp.post('/api/test-track', async (req, res) => {
    try {
      const { carrier, trackingNumber } = req.body;
      if (!carrier || !trackingNumber) {
        return res.status(400).json({ error: 'carrier and trackingNumber required' });
      }
      const result = await trackOrder(carrier, trackingNumber, null);
      res.json(result);
    } catch (error) {
      console.error('Error in /api/test-track:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // API endpoint to export CSV
  expressApp.post('/api/export-csv', (req, res) => {
    try {
      const { data } = req.body;

      if (!data || data.length === 0) {
        return res.status(400).json({ error: 'No data to export' });
      }

      const csv = convertToCSV(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=kompanero-tracking.csv');
      res.send(csv);

    } catch (error) {
      console.error('Error exporting CSV:', error);
      res.status(500).json({ error: error.message });
    }
  });

  server = expressApp.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👜 Kompanero Tracking Dashboard`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Ready to track orders!`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

// Create the browser window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: '👜 Kompanero Tracking Dashboard',
    icon: path.join(__dirname, 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    autoHideMenuBar: true,
    backgroundColor: '#FAF7F2'
  });

  // Load the app
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // App lifecycle
  app.whenReady().then(() => {
    startExpressServer();
    
    // Wait a bit for server to start
    setTimeout(() => {
      createWindow();
    }, 1000);

    app.on('activate', () => {
      // On macOS it's common to re-create a window when dock icon is clicked
      if (process.platform === 'darwin' && BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) {
      server.close();
    }
    app.quit();
  }
});

app.on('before-quit', () => {
  if (server) {
    server.close();
  }
});
