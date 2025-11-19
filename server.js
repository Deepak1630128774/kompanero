require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const path = require('path');
const { trackDTDC } = require('./scripts/dtdc');
const { trackBlueDart } = require('./scripts/bluedart');
const { trackDelhivery } = require('./scripts/delhivery');
const { trackEKart } = require('./scripts/ekart');
const { convertToCSV } = require('./utils/csvExport');
const { sendPickupPendingEmail, sendUnfulfilledOrdersEmail, sendNotDeliveredOrdersEmail } = require('./utils/email');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Shopify configuration
const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-01';

// Helper function to fetch Shopify orders with pagination
async function fetchShopifyOrders(fromDate, toDate, fulfillmentStatus = 'all') {
  try {
    let allOrders = [];
    let nextPageUrl = null;
    let hasNextPage = true;
    
    while (hasNextPage) {
      let response;
      
      if (nextPageUrl) {
        // Use the full next page URL from Link header
        response = await axios.get(nextPageUrl, { 
          headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN
          }
        });
      } else {
        // First request with filters
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

      // Check for next page using Link header
      const linkHeader = response.headers.link;
      if (linkHeader && linkHeader.includes('rel="next"')) {
        // Extract the full next URL
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
      
      // If we got less than 250, there are no more pages
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
      // Handle: ekart, e-kart, e kart, ekartlogistics, flipkart logistics
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

    // Final fallback by tracking number patterns (EKart common prefixes like LUAP)
    const tnLower = (trackingNumber || '').toString().toLowerCase();
    if (/^lua/.test(tnLower)) {
      return await trackEKart(trackingNumber);
    }

    console.log(`[Router] Carrier not supported. carrier='${carrier}', url='${trackingUrl || ''}'`);
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
app.get('/api/process-orders-stream/:sessionId', (req, res) => {
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

// Helper function to send progress updates
function sendProgress(sessionId, data) {
  if (!sessionId) return;
  const connection = activeConnections.get(sessionId);
  if (connection) {
    connection.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

// API endpoint to process orders with real-time updates
app.post('/api/process-orders', async (req, res) => {
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

    // Fetch orders from Shopify (with pagination)
    const orders = await fetchShopifyOrders(fromDate, toDate, fulfillmentStatus || 'all');
    console.log(`[${requestId}] ✓ Total orders fetched: ${orders.length}`);

    // Send total count
    sendProgress(sessionId, { stage: 'processing', processed: 0, total: orders.length, percentage: 0 });

    // Process orders with concurrency limit to prevent memory issues
    const CONCURRENT_LIMIT = parseInt(process.env.SERVER_CONCURRENCY || '5', 10); // Configurable concurrency
    const results = [];
    let processedCount = 0;
    
    for (let i = 0; i < orders.length; i += CONCURRENT_LIMIT) {
      const batch = orders.slice(i, i + CONCURRENT_LIMIT);
      const batchPromises = batch.map(async (order) => {
      try {
        // Get customer name
        const customerName = order.customer 
          ? `${order.customer.first_name || ''} ${order.customer.last_name || ''}`.trim()
          : 'N/A';

        // Get ordered items
        const orderedItems = order.line_items
          .map(item => `${item.title} (x${item.quantity})`)
          .join(', ');

        // Check if order has fulfillment data
        let trackingNumber = 'N/A';
        let trackingUrl = 'N/A';
        let carrierName = 'Not Fulfilled';
        let trackingStatus = 'Unfulfilled';

        if (order.fulfillments && order.fulfillments.length > 0) {
          const fulfillment = order.fulfillments[0];
          trackingNumber = fulfillment.tracking_number || 'N/A';
          trackingUrl = fulfillment.tracking_url || 'N/A';
          carrierName = fulfillment.tracking_company || 'Unknown';

          // Track the order if it has tracking number
          if (trackingNumber !== 'N/A') {
            const trackingResult = await trackOrder(carrierName, trackingNumber, trackingUrl);
            trackingStatus = trackingResult.status || 'Unknown';
          } else {
            trackingStatus = 'No Tracking';
          }
        }

        // Filter by carrier if specified (only for fulfilled orders)
        if (carrier && carrier !== 'all') {
          if (carrierName === 'Not Fulfilled' || carrierName.toLowerCase() !== carrier.toLowerCase()) {
            return null;
          }
        }

        return {
          orderId: order.name || order.id,
          orderDate: order.created_at ? new Date(order.created_at).toLocaleDateString() : '',
          customerName,
          orderedItems,
          carrier: carrierName,
          trackingNumber: trackingNumber,
          trackingUrl: trackingUrl,
          trackingStatus
        };
      } catch (error) {
        console.error(`Error processing order ${order.name}:`, error.message);
        return null;
      }
    });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults.filter(result => result !== null));
      
      processedCount = Math.min(i + CONCURRENT_LIMIT, orders.length);
      const percentage = Math.floor((processedCount / orders.length) * 100);
      
      // Send progress update
      sendProgress(sessionId, { 
        stage: 'processing', 
        processed: processedCount, 
        total: orders.length, 
        percentage 
      });
      
      console.log(`[${requestId}] Processed ${processedCount}/${orders.length} orders`);
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

    console.log(`[${requestId}] Completed: ${results.length} orders processed\n`);
    res.json({ success: true, data: results, totalOrders: orders.length });

  } catch (error) {
    console.error(`[${requestId}] Error processing orders:`, error);
    sendProgress(sessionId, { stage: 'error', error: error.message });
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint to track a single shipment
app.post('/api/test-track', async (req, res) => {
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
app.post('/api/export-csv', (req, res) => {
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

// Start server
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`👜 Kompanero Tracking Dashboard`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Ready to track orders!`);
  console.log(`${'='.repeat(60)}\n`);
});
