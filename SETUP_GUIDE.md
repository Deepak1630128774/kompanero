# 🚀 Kompanero Tracking Dashboard - Setup Guide

## Quick Start

### 1. Install Dependencies
```bash
cd kompanero-tracking
npm install
```

### 2. Configure Shopify Credentials

Edit the `.env` file with your Shopify store details:

```env
SHOPIFY_STORE_URL=kompanero-6152.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your-access-token
PORT=3000
```

**How to get Shopify credentials:**
1. Go to your Shopify Admin Panel
2. Navigate to **Apps** → **Develop apps**
3. Create a new app or use existing one
4. Get your **Access Token** (starts with `shpat_`)
5. Make sure the app has permissions to read orders and fulfillments

### 3. Start the Server
```bash
npm start
```

The server will start at `http://localhost:3000`

### 4. Open in Browser
Navigate to `http://localhost:3000` in your web browser

## Features Overview

### 📅 Date Range Filter
- Select "From Date" and "To Date" to filter orders
- Default: Last 30 days

### 🚚 Carrier Filter
- Filter by specific carrier or view all
- Supported carriers:
  - DTDC
  - Bluedart
  - Delhivery
  - Australia Post

### 🎨 Loading Animation
- Beautiful leather-stitching animation while processing
- Shows craftsman stitching women's bag and men's purse
- Kompanero brand colors and theme

### 📊 Results Table
- Displays all order details
- Shows real-time tracking status
- Color-coded status badges:
  - 🟢 Green: Delivered
  - 🟡 Yellow: In Transit
  - 🔴 Red: Pending/Error

### 📥 CSV Export
- Download results as CSV file
- Includes all order and tracking information
- Ready for Excel/Google Sheets

## Troubleshooting

### Issue: "Failed to fetch orders from Shopify"
**Solution:** 
- Check your Shopify credentials in `.env` file
- Ensure `SHOPIFY_STORE_URL` is correct (e.g., `kompanero-6152.myshopify.com`)
- Verify `SHOPIFY_ACCESS_TOKEN` is valid and starts with `shpat_`
- Confirm the app has read permissions for orders

### Issue: Tracking status shows "Error"
**Solution:** 
- Check internet connection
- Some carriers may have rate limits
- Try again after a few minutes

### Issue: Puppeteer not working
**Solution:** 
```bash
npm install puppeteer --force
```

### Issue: Port 3000 already in use
**Solution:** Change PORT in `.env` file to another port (e.g., 3001)

## Project Structure

```
kompanero-tracking/
├── server.js              # Express server & API endpoints
├── package.json           # Dependencies
├── .env                   # Configuration (DO NOT COMMIT)
├── README.md             # Project documentation
├── SETUP_GUIDE.md        # This file
│
├── public/               # Frontend files
│   ├── index.html       # Main HTML page
│   ├── style.css        # Styling with animations
│   └── app.js           # Client-side JavaScript
│
├── scripts/             # Courier tracking modules
│   ├── dtdc.js         # DTDC tracking
│   ├── bluedart.js     # Bluedart tracking
│   ├── delhivery.js    # Delhivery tracking
│   └── australiapost.js # Australia Post (placeholder)
│
└── utils/              # Utility functions
    └── csvExport.js    # CSV export logic
```

## API Endpoints

### POST `/api/process-orders`
Fetch and process orders from Shopify

**Request Body:**
```json
{
  "fromDate": "2024-01-01T00:00:00Z",
  "toDate": "2024-01-31T23:59:59Z",
  "carrier": "all"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "orderId": "#1001",
      "orderDate": "1/15/2024",
      "customerName": "John Doe",
      "orderedItems": "Leather Bag (x1)",
      "carrier": "DTDC",
      "trackingNumber": "7X110115690",
      "trackingUrl": "https://...",
      "trackingStatus": "Delivered"
    }
  ]
}
```

### POST `/api/export-csv`
Export results as CSV

**Request Body:**
```json
{
  "data": [/* array of order objects */]
}
```

**Response:** CSV file download

## Notes

- **No Database Required:** All processing happens in-memory
- **Live Tracking:** Fetches real-time status from courier websites
- **Portable:** Download and run anywhere with Node.js installed
- **Secure:** Keep your `.env` file private and never commit it

## Support

For issues or questions, check the main README.md or contact support.

---

**Made with ❤️ for Kompanero**
