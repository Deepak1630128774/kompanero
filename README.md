# 👜 Kompanero Tracking Dashboard

A Node.js web application that fetches order details from Shopify and displays tracking information for fulfilled orders.

## Features

- Fetch Shopify orders by date range
- Filter by carrier (DTDC, Bluedart, Delhivery, Australia Post)
- Live tracking status from courier websites
- Beautiful leather-stitching loading animation
- Export results to CSV
- No database required - all in-memory processing

## Installation

1. Clone or download this project
2. Install dependencies:
```bash
npm install
```

3. Configure your Shopify credentials in `.env` file:
```
SHOPIFY_STORE_URL=kompanero-6152.myshopify.com
SHOPIFY_ACCESS_TOKEN=shpat_your-access-token
```

## Usage

1. Start the server:
```bash
npm start
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Select date range and carrier filter
4. Click "Process" to fetch and track orders
5. Download results as CSV

## Tech Stack

- **Backend**: Node.js + Express
- **Frontend**: HTML, CSS, JavaScript
- **Tracking**: Axios, Cheerio, Puppeteer
- **No Database**: All processing in-memory

## Project Structure

```
kompanero-tracking/
├── server.js              # Express server
├── package.json           # Dependencies
├── .env                   # Configuration
├── public/                # Frontend files
│   ├── index.html        # Main page
│   ├── style.css         # Styling
│   └── app.js            # Client-side logic
├── scripts/               # Tracking scripts
│   ├── dtdc.js           # DTDC tracking
│   ├── bluedart.js       # Bluedart tracking
│   └── delhivery.js      # Delhivery tracking
└── utils/                 # Utilities
    └── csvExport.js      # CSV export logic
```

## License

ISC
