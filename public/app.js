// ============================================================================
// DOM ELEMENTS
// ============================================================================

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const carrierSelect = document.getElementById('carrier');
const processBtn = document.getElementById('processBtn');
const loadingAnimation = document.getElementById('loadingAnimation');
const resultsSection = document.getElementById('resultsSection');
const resultsBody = document.getElementById('resultsBody');
const noResults = document.getElementById('noResults');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');

// Store current results for CSV export
let currentResults = [];

// ============================================================================
// INITIALIZATION
// ============================================================================

// Remove preload class when page loads to start animation
window.addEventListener('load', function() {
    document.body.classList.remove('preload');
});

// Set default dates (last 30 days)
const today = new Date();
const thirtyDaysAgo = new Date(today);
thirtyDaysAgo.setDate(today.getDate() - 30);

toDateInput.valueAsDate = today;
fromDateInput.valueAsDate = thirtyDaysAgo;

// ============================================================================
// EVENT LISTENERS
// ============================================================================

processBtn.addEventListener('click', processOrders);
downloadCsvBtn.addEventListener('click', downloadCSV);

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function processOrders() {
    const fromDate = fromDateInput.value;
    const toDate = toDateInput.value;
    const carrier = carrierSelect.value;

    // Validation
    if (!fromDate || !toDate) {
        alert('Please select both From Date and To Date');
        return;
    }

    if (new Date(fromDate) > new Date(toDate)) {
        alert('From Date cannot be after To Date');
        return;
    }

    // Show loading animation
    resultsSection.classList.add('hidden');
    loadingAnimation.classList.remove('hidden');
    processBtn.disabled = true;
    processBtn.textContent = 'Processing...';

    try {
        // Call API to process orders
        const response = await fetch('/api/process-orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fromDate: fromDate + 'T00:00:00Z',
                toDate: toDate + 'T23:59:59Z',
                carrier: carrier
            })
        });

        if (!response.ok) {
            throw new Error('Failed to process orders');
        }

        const result = await response.json();
        currentResults = result.data || [];

        // Hide loading, show results
        loadingAnimation.classList.add('hidden');
        displayResults(currentResults);

    } catch (error) {
        console.error('Error:', error);
        alert('Error processing orders: ' + error.message);
        loadingAnimation.classList.add('hidden');
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = 'Process Orders';
    }
}

function displayResults(data) {
    resultsSection.classList.remove('hidden');
    resultsBody.innerHTML = '';

    if (!data || data.length === 0) {
        noResults.classList.remove('hidden');
        document.querySelector('.table-container').classList.add('hidden');
        return;
    }

    noResults.classList.add('hidden');
    document.querySelector('.table-container').classList.remove('hidden');

    data.forEach(order => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${escapeHtml(order.orderId)}</td>
            <td>${escapeHtml(order.orderDate)}</td>
            <td>${escapeHtml(order.customerName)}</td>
            <td>${escapeHtml(order.orderedItems)}</td>
            <td>${escapeHtml(order.carrier)}</td>
            <td>${escapeHtml(order.trackingNumber)}</td>
            <td>
                ${order.trackingUrl !== 'N/A' 
                    ? `<a href="${escapeHtml(order.trackingUrl)}" target="_blank" style="color: var(--primary-brown);">View</a>` 
                    : 'N/A'}
            </td>
            <td>
                <span class="status-badge ${getStatusClass(order.trackingStatus)}">
                    ${escapeHtml(order.trackingStatus)}
                </span>
            </td>
        `;
        
        resultsBody.appendChild(row);
    });
}

function getStatusClass(status) {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('delivered')) {
        return 'status-delivered';
    } else if (statusLower.includes('transit') || statusLower.includes('picked')) {
        return 'status-transit';
    } else if (statusLower.includes('pending') || statusLower.includes('error')) {
        return 'status-pending';
    }
    
    return 'status-default';
}

async function downloadCSV() {
    if (!currentResults || currentResults.length === 0) {
        alert('No data to export');
        return;
    }

    try {
        const response = await fetch('/api/export-csv', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: currentResults })
        });

        if (!response.ok) {
            throw new Error('Failed to export CSV');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kompanero-tracking-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

    } catch (error) {
        console.error('Error:', error);
        alert('Error exporting CSV: ' + error.message);
    }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================================
// ADDITIONAL STYLES FOR STATUS BADGES
// ============================================================================

// Add dynamic styles for status badges
const style = document.createElement('style');
style.textContent = `
    .status-badge {
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 0.85rem;
        font-weight: 600;
        display: inline-block;
    }
    
    .status-delivered {
        background: #D4EDDA;
        color: #155724;
    }
    
    .status-transit {
        background: #FFF3CD;
        color: #856404;
    }
    
    .status-pending {
        background: #F8D7DA;
        color: #721C24;
    }
    
    .status-default {
        background: #E2E3E5;
        color: #383D41;
    }
`;
document.head.appendChild(style);
