# Fulfillment Filter Update

## Changes Made

### Summary
Added a new **Fulfillment Status** filter that allows users to view:
- **All Orders** - Both fulfilled and unfulfilled orders
- **Fulfilled Only** - Orders that have been shipped with tracking
- **Unfulfilled Only** - Orders that haven't been fulfilled yet

### Files Modified

#### 1. **public/index.html**
- Added new dropdown filter for "Fulfillment Status" with three options:
  - All Orders
  - Fulfilled Only
  - Unfulfilled Only

#### 2. **public/app.js**
- Added `fulfillmentStatusSelect` DOM element reference
- Updated `processOrders()` function to capture and send fulfillment status in API request

#### 3. **server.js**
- Updated `fetchShopifyOrders()` to accept `fulfillmentStatus` parameter
- Modified Shopify API call to conditionally filter by fulfillment status:
  - `fulfilled` → `fulfillment_status: 'shipped'`
  - `unfulfilled` → `fulfillment_status: 'unshipped'`
  - `all` → No fulfillment_status filter (fetches all orders)
- Updated order processing logic to handle unfulfilled orders:
  - Unfulfilled orders show "Not Fulfilled" as carrier
  - Unfulfilled orders show "Unfulfilled" as tracking status
  - Carrier filter only applies to fulfilled orders

#### 4. **main.js** (Electron)
- Applied same changes as server.js for Electron desktop app compatibility

### Behavior Changes

#### Before
- Only fetched orders with `fulfillment_status: 'shipped'`
- Ignored all unfulfilled orders
- Only showed orders with tracking information

#### After
- Fetches all orders by default (fulfilled + unfulfilled)
- Users can filter by fulfillment status
- Unfulfilled orders display with:
  - **Carrier**: "Not Fulfilled"
  - **Tracking Number**: "N/A"
  - **Tracking URL**: "N/A"
  - **Tracking Status**: "Unfulfilled"
- Fulfilled orders without tracking show:
  - **Tracking Status**: "No Tracking"

### API Changes

#### Request Payload
```json
{
  "fromDate": "2024-01-01T00:00:00Z",
  "toDate": "2024-01-31T23:59:59Z",
  "carrier": "all",
  "fulfillmentStatus": "all",  // NEW FIELD
  "sessionId": "unique-session-id"
}
```

#### Shopify API Parameters
```javascript
// All orders
{ status: 'any', created_at_min: '...', created_at_max: '...', limit: 250 }

// Fulfilled only
{ status: 'any', fulfillment_status: 'shipped', created_at_min: '...', created_at_max: '...', limit: 250 }

// Unfulfilled only
{ status: 'any', fulfillment_status: 'unshipped', created_at_min: '...', created_at_max: '...', limit: 250 }
```

### User Interface

The filter section now has 4 inputs:
1. **From Date** - Start date
2. **To Date** - End date
3. **Carrier** - DTDC, Bluedart, Delhivery, or All
4. **Fulfillment Status** - All Orders, Fulfilled Only, or Unfulfilled Only *(NEW)*

### Testing Recommendations

1. Test with "All Orders" to see both fulfilled and unfulfilled
2. Test with "Fulfilled Only" to verify it matches previous behavior
3. Test with "Unfulfilled Only" to see pending orders
4. Verify carrier filter works correctly with fulfilled orders
5. Check CSV export includes unfulfilled orders correctly

### Notes

- Unfulfilled orders won't have tracking information, so no live tracking is performed
- Carrier filter is ignored for unfulfilled orders (they show as "Not Fulfilled")
- The change is backward compatible - existing functionality remains unchanged
- Both web and Electron versions updated with identical functionality
