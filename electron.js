const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');

let mainWindow;
let serverApp;
let server;

// Import your existing server routes
const { trackDTDC } = require('./scripts/dtdc');
const { trackBlueDart } = require('./scripts/bluedart');
const { trackDelhivery } = require('./scripts/delhivery');
const { convertToCSV } = require('./utils/csvExport');

const PORT = 3000;

// Create Express server
function createServer() {
  require('dotenv').config();
  
  serverApp = express();
  serverApp.use(bodyParser.json());
  serverApp.use(express.static(path.join(__dirname, 'public')));

  // Import all your existing routes from server.js
  const axios = require('axios');
  const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
  const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

  // Helper function to fetch Shopify orders with pagination
  async function fetchShopifyOrders(fromDate, toDate) {
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
            fulfillment_status: 'shipped',
            created_at_min: fromDate,
            created_at_max: toDate,
            limit: 250
          };

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

  // Helper function to track order based on carrier
  async function trackOrder(carrier, trackingNumber) {
    try {
      switch (carrier.toLowerCase()) {
        case 'dtdc':
          return await trackDTDC(trackingNumber);
        case 'bluedart':
        case 'blue dart':
          return await trackBlueDart(trackingNumber);
        case 'delhivery':
          return await trackDelhivery(trackingNumber);
        default:
          return {
            success: false,
            status: 'Carrier not supported',
            trackingNumber
          };
      }
    } catch (error) {
      return {
        success: false,
        status: 'Error: ' + error.message,
        trackingNumber
      };
    }
  }

  // API endpoint to process orders
  serverApp.post('/api/process-orders', async (req, res) => {
    const requestId = Date.now().toString().slice(-4);
    
    try {
      const { fromDate, toDate, carrier } = req.body;

      if (!fromDate || !toDate) {
        return res.status(400).json({ error: 'Date range is required' });
      }

      console.log(`\n[${requestId}] Processing orders from ${fromDate} to ${toDate}, carrier: ${carrier || 'All'}`);

      const orders = await fetchShopifyOrders(fromDate, toDate);
      console.log(`[${requestId}] ✓ Total orders fetched: ${orders.length}`);

      const CONCURRENT_LIMIT = 30;
      const results = [];
      
      for (let i = 0; i < orders.length; i += CONCURRENT_LIMIT) {
        const batch = orders.slice(i, i + CONCURRENT_LIMIT);
        const batchPromises = batch.map(async (order) => {
        try {
          if (!order.fulfillments || order.fulfillments.length === 0) {
            return null;
          }

          const fulfillment = order.fulfillments[0];
          const trackingNumber = fulfillment.tracking_number;
          const trackingUrl = fulfillment.tracking_url || '';
          const carrierName = fulfillment.tracking_company || 'Unknown';

          if (carrier && carrier !== 'all' && carrierName.toLowerCase() !== carrier.toLowerCase()) {
            return null;
          }

          const customerName = order.customer 
            ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
            : 'N/A';

          const orderedItems = order.line_items
            .map(item => `${item.title} (x${item.quantity})`)
            .join(', ');

          let trackingStatus = 'Pending';
          if (trackingNumber) {
            const trackingResult = await trackOrder(carrierName, trackingNumber);
            trackingStatus = trackingResult.status || 'Unknown';
          }

          return {
            orderId: order.name || order.id,
            orderDate: order.created_at ? new Date(order.created_at).toLocaleDateString() : '',
            customerName,
            orderedItems,
            carrier: carrierName,
            trackingNumber: trackingNumber || 'N/A',
            trackingUrl: trackingUrl || 'N/A',
            trackingStatus
          };
        } catch (error) {
          console.error(`Error processing order ${order.name}:`, error.message);
          return null;
        }
      });

        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults.filter(result => result !== null));
        
        console.log(`[${requestId}] Processed ${Math.min(i + CONCURRENT_LIMIT, orders.length)}/${orders.length} orders`);
      }

      console.log(`[${requestId}] ✓ Completed: ${results.length} orders processed\n`);
      res.json({ success: true, data: results });

    } catch (error) {
      console.error(`[${requestId}] Error processing orders:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // API endpoint to export CSV
  serverApp.post('/api/export-csv', (req, res) => {
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

  server = serverApp.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`👜 Kompanero Tracking Desktop App`);
    console.log(`${'='.repeat(60)}`);
    console.log(`🚀 Express server running on http://localhost:${PORT}`);
    console.log(`✓ Server ready!`);
    console.log(`${'='.repeat(60)}\n`);
  });
}

// Create Electron window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: path.join(__dirname, 'public', 'icon.png'), // Add your icon
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    autoHideMenuBar: true,
    backgroundColor: '#ffffff'
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

  console.log('🖥️ Window ready!');
}

// App lifecycle
app.whenReady().then(() => {
  console.log('🚀 Starting Kompanero Tracking Desktop App...');
  
  // Start Express server first
  createServer();
  
  // Wait a bit for server to start, then create window
  setTimeout(() => {
    createWindow();
  }, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Close server
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
