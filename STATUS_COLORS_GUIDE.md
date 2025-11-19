# Status Badge Color Guide

## 🎨 Color Coding System

### 🟢 Green - Delivered
**When to show:** Order has been successfully delivered

**Keywords detected:**
- "delivered"
- "delivery"

**Visual:**
```
┌─────────────────┐
│   Delivered     │  ← Green background (#D4EDDA)
└─────────────────┘     Dark green text (#155724)
```

**Examples:**
- ✅ "Delivered"
- ✅ "Delivery Completed"
- ✅ "Successfully Delivered"

---

### 🟡 Yellow/Orange - In Transit
**When to show:** Order is on the way but not yet delivered

**Keywords detected:**
- "transit"
- "picked"
- "shipped"
- "dispatched"
- "out for delivery"
- "in-transit"

**Visual:**
```
┌─────────────────┐
│   In Transit    │  ← Yellow background (#FFF3CD)
└─────────────────┘     Orange text (#856404)
```

**Examples:**
- ✅ "In Transit"
- ✅ "Picked Up"
- ✅ "Shipped"
- ✅ "Dispatched"
- ✅ "Out for Delivery"

---

### 🔴 Red - Pending/Error
**When to show:** Order has issues or is waiting

**Keywords detected:**
- "pending"
- "error"
- "failed"
- "not found"

**Visual:**
```
┌─────────────────┐
│     Pending     │  ← Red background (#F8D7DA)
└─────────────────┘     Dark red text (#721C24)
```

**Examples:**
- ✅ "Pending"
- ✅ "Error: Not Found"
- ✅ "Failed to Track"
- ✅ "Status Not Found"

---

### ⚪ Gray - Unknown/Other
**When to show:** Status doesn't match any category

**Visual:**
```
┌─────────────────┐
│     Unknown     │  ← Gray background (#E2E3E5)
└─────────────────┘     Dark gray text (#383D41)
```

**Examples:**
- ✅ "Processing"
- ✅ "Awaiting Pickup"
- ✅ Any other status

---

## 🔍 Detection Logic

### Priority Order:
1. **First check**: Delivered (green)
2. **Second check**: In Transit (yellow)
3. **Third check**: Pending/Error (red)
4. **Default**: Unknown (gray)

### Case Insensitive:
All checks are case-insensitive, so these all work:
- "DELIVERED" → Green
- "delivered" → Green
- "Delivered" → Green
- "DeliVERed" → Green

### Partial Matching:
Checks if status **contains** the keyword:
- "Successfully Delivered" → Green (contains "delivered")
- "Item In Transit" → Yellow (contains "transit")
- "Shipment Pending" → Red (contains "pending")

---

## 📊 Common Carrier Status Mappings

### DTDC
| DTDC Status | Badge Color | Keyword Match |
|-------------|-------------|---------------|
| "Delivered" | 🟢 Green | delivered |
| "In Transit" | 🟡 Yellow | transit |
| "Picked Up" | 🟡 Yellow | picked |
| "Pending" | 🔴 Red | pending |

### BlueDart
| BlueDart Status | Badge Color | Keyword Match |
|-----------------|-------------|---------------|
| "Delivered" | 🟢 Green | delivered |
| "Out for Delivery" | 🟡 Yellow | out for delivery |
| "Dispatched" | 🟡 Yellow | dispatched |
| "Not Found" | 🔴 Red | not found |

### Delhivery
| Delhivery Status | Badge Color | Keyword Match |
|------------------|-------------|---------------|
| "Delivered" | 🟢 Green | delivered |
| "In-Transit" | 🟡 Yellow | in-transit |
| "Shipped" | 🟡 Yellow | shipped |
| "Pending" | 🔴 Red | pending |

---

## 🎯 Quick Reference

```javascript
// Status Detection Function
function getStatusClass(status) {
    const statusLower = status.toLowerCase();
    
    // 🟢 GREEN - Delivered
    if (statusLower.includes('delivered') || 
        statusLower.includes('delivery')) {
        return 'status-delivered';
    }
    
    // 🟡 YELLOW - In Transit
    else if (statusLower.includes('transit') || 
             statusLower.includes('picked') || 
             statusLower.includes('shipped') ||
             statusLower.includes('dispatched') ||
             statusLower.includes('out for delivery') ||
             statusLower.includes('in-transit')) {
        return 'status-transit';
    }
    
    // 🔴 RED - Pending/Error
    else if (statusLower.includes('pending') || 
             statusLower.includes('error') ||
             statusLower.includes('failed') ||
             statusLower.includes('not found')) {
        return 'status-pending';
    }
    
    // ⚪ GRAY - Unknown
    return 'status-default';
}
```

---

## ✅ Testing Examples

### Test Case 1: Delivered Orders
```
Input: "Delivered"
Output: 🟢 Green badge

Input: "Delivery Completed"
Output: 🟢 Green badge

Input: "Successfully Delivered to Customer"
Output: 🟢 Green badge
```

### Test Case 2: In Transit Orders
```
Input: "In Transit"
Output: 🟡 Yellow badge

Input: "Picked Up from Warehouse"
Output: 🟡 Yellow badge

Input: "Out for Delivery"
Output: 🟡 Yellow badge
```

### Test Case 3: Problem Orders
```
Input: "Pending"
Output: 🔴 Red badge

Input: "Error: Tracking Not Found"
Output: 🔴 Red badge

Input: "Failed to Deliver"
Output: 🔴 Red badge
```

### Test Case 4: Unknown Status
```
Input: "Processing at Hub"
Output: ⚪ Gray badge

Input: "Awaiting Pickup"
Output: ⚪ Gray badge

Input: "Customs Clearance"
Output: ⚪ Gray badge
```

---

## 🎨 CSS Classes

```css
/* Green - Delivered */
.status-delivered {
    background: #D4EDDA;
    color: #155724;
}

/* Yellow - In Transit */
.status-transit {
    background: #FFF3CD;
    color: #856404;
}

/* Red - Pending/Error */
.status-pending {
    background: #F8D7DA;
    color: #721C24;
}

/* Gray - Unknown */
.status-default {
    background: #E2E3E5;
    color: #383D41;
}
```

---

## 🔧 Customization

### To Add New Keywords:
Edit the `getStatusClass()` function in `public/app.js`:

```javascript
// Add to delivered check
if (statusLower.includes('delivered') || 
    statusLower.includes('delivery') ||
    statusLower.includes('YOUR_NEW_KEYWORD')) {
    return 'status-delivered';
}
```

### To Add New Status Category:
1. Add new CSS class in `style.css`
2. Add new condition in `getStatusClass()`
3. Update this guide

---

## 📝 Notes

- All status checks are **case-insensitive**
- Uses **partial matching** (contains, not exact match)
- **Priority order** matters (delivered checked first)
- Easy to extend with new keywords
- Works with all courier services
