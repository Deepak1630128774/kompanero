# 🏗️ Kompanero Tracking Dashboard - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                             │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Frontend (public/)                      │  │
│  │                                                             │  │
│  │  • index.html  - UI Structure                              │  │
│  │  • style.css   - Styling + Animations                      │  │
│  │  • app.js      - Client Logic                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              ↕                                   │
│                         HTTP/JSON                                │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                    Express Server (server.js)                    │
│                                                                   │
│  API Endpoints:                                                  │
│  • POST /api/process-orders  - Fetch & track orders             │
│  • POST /api/export-csv      - Export to CSV                    │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Order Processing Logic                      │   │
│  │                                                           │   │
│  │  1. Fetch orders from Shopify                            │   │
│  │  2. Filter by date & carrier                             │   │
│  │  3. Extract tracking info                                │   │
│  │  4. Track each order via courier scripts                 │   │
│  │  5. Return results                                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         ↕                    ↕                    ↕
    ┌────────┐          ┌─────────┐          ┌─────────┐
    │Shopify │          │Tracking │          │  CSV    │
    │  API   │          │Scripts  │          │ Export  │
    └────────┘          └─────────┘          └─────────┘
         ↓                    ↓
    Orders Data      ┌──────────────────┐
                     │  scripts/        │
                     │  • dtdc.js       │
                     │  • bluedart.js   │
                     │  • delhivery.js  │
                     │  • australiapost.js
                     └──────────────────┘
                            ↓
                    ┌──────────────────┐
                    │ Courier Websites │
                    │ (Live Tracking)  │
                    └──────────────────┘
```

## Data Flow

### 1. User Interaction Flow

```
User Opens Dashboard
       ↓
Selects Date Range & Carrier
       ↓
Clicks "Process Orders"
       ↓
Frontend sends POST to /api/process-orders
       ↓
Loading Animation Displays
       ↓
Server processes request
       ↓
Results displayed in table
       ↓
User clicks "Download CSV"
       ↓
CSV file downloaded
```

### 2. Backend Processing Flow

```
Receive API Request
       ↓
Validate Input (dates, carrier)
       ↓
┌──────────────────────────────────┐
│ Fetch Orders from Shopify API    │
│ - Use date range filter           │
│ - Filter by fulfillment status    │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ Process Each Order                │
│ - Extract order details           │
│ - Get tracking number             │
│ - Get carrier name                │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ Track Order Based on Carrier      │
│                                   │
│ DTDC → dtdc.js (Axios+Cheerio)   │
│ Bluedart → bluedart.js (Puppeteer)│
│ Delhivery → delhivery.js (Puppeteer)│
│ Australia Post → australiapost.js │
└──────────────────────────────────┘
       ↓
┌──────────────────────────────────┐
│ Compile Results                   │
│ - Order ID, Date, Customer        │
│ - Items, Carrier, Tracking #      │
│ - Tracking URL, Status            │
└──────────────────────────────────┘
       ↓
Return JSON Response to Frontend
```

### 3. Tracking Script Flow

#### DTDC (Axios + Cheerio)
```
Input: Tracking Number
       ↓
Build URL with tracking number
       ↓
HTTP GET request (Axios)
       ↓
Parse HTML (Cheerio)
       ↓
Find "Last Status" element
       ↓
Extract status text
       ↓
Return status
```

#### Bluedart & Delhivery (Puppeteer)
```
Input: Tracking Number
       ↓
Launch headless browser
       ↓
Navigate to tracking page
       ↓
Wait for page load (8s for Bluedart, 3s for Delhivery)
       ↓
Execute JavaScript in page context
       ↓
Extract status from page text
       ↓
Close browser
       ↓
Return status
```

## Component Responsibilities

### Frontend Components

#### index.html
- **Purpose**: Structure and layout
- **Contains**: 
  - Header with logo
  - Filter inputs (dates, carrier)
  - Loading animation container
  - Results table
  - Footer

#### style.css
- **Purpose**: Styling and animations
- **Features**:
  - Kompanero brand colors
  - Responsive design
  - Leather-stitching animation
  - Table styling
  - Button styles

#### app.js
- **Purpose**: Client-side logic
- **Functions**:
  - Handle form submission
  - Make API calls
  - Display results
  - Download CSV
  - Input validation

### Backend Components

#### server.js
- **Purpose**: Main server and API
- **Responsibilities**:
  - Express server setup
  - API endpoint handlers
  - Shopify integration
  - Coordinate tracking scripts
  - Error handling

#### Tracking Scripts

**dtdc.js**
- Method: HTTP scraping
- Library: Axios + Cheerio
- Speed: Fast (~1-2s per request)
- Reliability: High

**bluedart.js**
- Method: Browser automation
- Library: Puppeteer
- Speed: Slow (~10s per request)
- Reliability: Medium (depends on page load)

**delhivery.js**
- Method: Browser automation
- Library: Puppeteer
- Speed: Medium (~5s per request)
- Reliability: Medium

**australiapost.js**
- Method: Placeholder
- Returns: "In Transit"
- Note: Needs actual implementation

#### Utilities

**csvExport.js**
- **Purpose**: Convert JSON to CSV
- **Features**:
  - Escape special characters
  - Handle commas and quotes
  - Format headers

## Configuration

### Environment Variables (.env)
```
SHOPIFY_STORE_URL      - Your Shopify store URL (e.g., kompanero-6152.myshopify.com)
SHOPIFY_ACCESS_TOKEN   - Shopify Access Token (starts with shpat_)
SHOPIFY_API_VERSION    - API version (default: 2024-01)
PORT                   - Server port (default: 3000)
```

### Dependencies (package.json)
```
express        - Web server framework
axios          - HTTP client
cheerio        - HTML parsing
puppeteer      - Browser automation
dotenv         - Environment variables
body-parser    - Request body parsing
```

## Security Considerations

1. **Environment Variables**: Sensitive data in .env (not committed)
2. **API Keys**: Never exposed to frontend
3. **Input Validation**: Date ranges validated before processing
4. **Error Handling**: Graceful error messages (no stack traces to client)
5. **HTTPS**: Should use HTTPS in production
6. **Rate Limiting**: Consider adding rate limiting for API endpoints

## Performance Considerations

1. **In-Memory Processing**: No database overhead
2. **Sequential Tracking**: Orders tracked one by one (can be parallelized)
3. **Puppeteer Overhead**: Browser automation is slow
4. **Timeout Settings**: Configured for each carrier
5. **Retry Logic**: Automatic retries for failed requests

## Scalability Notes

Current implementation is suitable for:
- Small to medium order volumes (< 100 orders per request)
- Single user/admin access
- Development and testing

For production/scale:
- Add request queuing
- Implement parallel tracking
- Add caching layer
- Consider database for results
- Add authentication
- Implement rate limiting

## Error Handling

### Frontend
- Input validation before submission
- User-friendly error messages
- Loading state management

### Backend
- Try-catch blocks for all async operations
- Timeout handling
- Retry logic in tracking scripts
- Graceful degradation

### Tracking Scripts
- Timeout configurations
- Retry mechanisms (max 2 retries)
- Error status returned on failure

## Testing Recommendations

1. **Unit Tests**: Test individual tracking scripts
2. **Integration Tests**: Test API endpoints
3. **E2E Tests**: Test complete user flow
4. **Load Tests**: Test with multiple orders
5. **Error Tests**: Test error scenarios

## Deployment Checklist

- [ ] Configure production Shopify credentials
- [ ] Set appropriate timeouts
- [ ] Enable HTTPS
- [ ] Add authentication
- [ ] Set up logging
- [ ] Configure error monitoring
- [ ] Test all carriers
- [ ] Verify CSV export
- [ ] Check responsive design
- [ ] Performance testing

---

**Architecture designed for simplicity, portability, and ease of use** 🏗️
