// ============================================================================
// DOM ELEMENTS
// ============================================================================

const fromDateInput = document.getElementById('fromDate');
const toDateInput = document.getElementById('toDate');
const carrierSelect = document.getElementById('carrier');
const fulfillmentStatusSelect = document.getElementById('fulfillmentStatus');
const processBtn = document.getElementById('processBtn');
const loadingAnimation = document.getElementById('loadingAnimation');
const resultsSection = document.getElementById('resultsSection');
const resultsBody = document.getElementById('resultsBody');
const noResults = document.getElementById('noResults');
const downloadCsvBtn = document.getElementById('downloadCsvBtn');
const progressBar = document.getElementById('progressBar');
const progressPercentage = document.getElementById('progressPercentage');
const processedCount = document.getElementById('processedCount');
const totalCount = document.getElementById('totalCount');
const progressTitle = document.getElementById('progressTitle');
const progressDetails = document.getElementById('progressDetails');
const loadingText = document.getElementById('loadingText');

// Table filter elements
const filterOrderId = document.getElementById('filterOrderId');
const filterCustomer = document.getElementById('filterCustomer');
const filterItems = document.getElementById('filterItems');
const filterCarrier = document.getElementById('filterCarrier');
const filterStatus = document.getElementById('filterStatus');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');
const resultsCount = document.getElementById('resultsCount');

// Store current results for CSV export
let currentResults = [];
let filteredResults = [];

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

// Table filter event listeners
filterOrderId.addEventListener('input', applyFilters);
filterCustomer.addEventListener('input', applyFilters);
filterItems.addEventListener('input', applyFilters);
filterCarrier.addEventListener('change', applyFilters);
filterStatus.addEventListener('change', applyFilters);
clearFiltersBtn.addEventListener('click', clearFilters);

// ============================================================================
// MAIN FUNCTIONS
// ============================================================================

async function processOrders() {
    const fromDate = fromDateInput.value;
    const toDate = toDateInput.value;
    const carrier = carrierSelect.value;
    const fulfillmentStatus = fulfillmentStatusSelect.value;

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
    
    // Reset progress
    updateProgress(0, 0, 0);
    progressTitle.textContent = 'Processing Orders...';
    progressDetails.textContent = 'Connecting to Shopify...';
    loadingText.textContent = 'Crafting your tracking report...';
    
    // Hide estimated time initially
    document.getElementById('estimatedTime').style.display = 'none';

    // Generate unique session ID
    const sessionId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    // Setup SSE connection for real-time progress
    const eventSource = new EventSource(`/api/process-orders-stream/${sessionId}`);
    
    let startTime = Date.now();
    let estimatedTimeEl = document.getElementById('estimatedTime');
    
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.stage === 'fetching') {
            progressDetails.textContent = 'Fetching orders from Shopify...';
            updateProgress(0, 0, 0);
        } else if (data.stage === 'processing') {
            progressDetails.textContent = `Tracking shipments... (${data.processed}/${data.total})`;
            updateProgress(data.processed, data.total, data.percentage);
            
            // Calculate and show estimated time
            if (data.processed > 0 && data.total > 0) {
                const elapsed = (Date.now() - startTime) / 1000; // seconds
                const rate = data.processed / elapsed; // orders per second
                const remaining = data.total - data.processed;
                const estimatedSeconds = Math.ceil(remaining / rate);
                
                estimatedTimeEl.style.display = 'block';
                estimatedTimeEl.textContent = `Estimated time remaining: ${formatTime(estimatedSeconds)}`;
            }
        } else if (data.stage === 'complete') {
            progressDetails.textContent = 'Finalizing results...';
            updateProgress(data.processed, data.total, 100);
            estimatedTimeEl.style.display = 'none';
        } else if (data.stage === 'error') {
            progressDetails.textContent = 'Error occurred';
            estimatedTimeEl.style.display = 'none';
        }
    };

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
                carrier: carrier,
                fulfillmentStatus: fulfillmentStatus,
                sessionId: sessionId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to process orders');
        }

        const result = await response.json();
        currentResults = result.data || [];

        // Close SSE connection
        eventSource.close();

        // Hide loading, show results
        loadingAnimation.classList.add('hidden');
        displayResults(currentResults);

    } catch (error) {
        console.error('Error:', error);
        eventSource.close();
        alert('Error processing orders: ' + error.message);
        loadingAnimation.classList.add('hidden');
    } finally {
        processBtn.disabled = false;
        processBtn.textContent = 'Process Orders';
    }
}

// Update progress bar
function updateProgress(processed, total, percentage) {
    progressBar.style.width = percentage + '%';
    progressPercentage.textContent = percentage + '%';
    processedCount.textContent = processed;
    totalCount.textContent = total;
}

function displayResults(data) {
    resultsSection.classList.remove('hidden');
    resultsBody.innerHTML = '';
    
    // Store original results and initialize filtered results
    filteredResults = data;
    
    // Populate filter dropdowns with unique values
    populateFilterDropdowns(data);

    if (!data || data.length === 0) {
        noResults.classList.remove('hidden');
        document.querySelector('.table-container').classList.add('hidden');
        document.querySelector('.table-filters').style.display = 'none';
        resultsCount.textContent = '0 orders';
        return;
    }

    noResults.classList.add('hidden');
    document.querySelector('.table-container').classList.remove('hidden');
    document.querySelector('.table-filters').style.display = 'block';
    
    // Update results count
    resultsCount.textContent = `${data.length} order${data.length !== 1 ? 's' : ''}`;

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
    
    // Delivered status - green
    if (statusLower.includes('delivered') || statusLower.includes('delivery')) {
        return 'status-delivered';
    }
    // In transit status - yellow/orange
    else if (statusLower.includes('transit') || 
             statusLower.includes('picked') || 
             statusLower.includes('shipped') ||
             statusLower.includes('dispatched') ||
             statusLower.includes('received') ||
             statusLower.includes('out for delivery') ||
             statusLower.includes('in-transit')) {
        return 'status-transit';
    }
    // Pending/Error status - red
    else if (statusLower.includes('pending') || 
             statusLower.includes('error') ||
             statusLower.includes('failed') ||
             statusLower.includes('not found')) {
        return 'status-pending';
    }
    // Default - gray
    return 'status-default';
}

// Format time in human-readable format
function formatTime(seconds) {
    if (seconds < 60) {
        return `${seconds} seconds`;
    } else if (seconds < 3600) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return secs > 0 ? `${minutes}m ${secs}s` : `${minutes} minutes`;
    } else {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours} hours`;
    }
}

async function downloadCSV() {
    // Export filtered results if filters are active, otherwise export all
    const dataToExport = filteredResults.length > 0 ? filteredResults : currentResults;
    
    if (!dataToExport || dataToExport.length === 0) {
        alert('No data to export');
        return;
    }

    try {
        // Try server-side CSV generation first
        const response = await fetch('/api/export-csv', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ data: dataToExport })
        });

        if (!response.ok) {
            throw new Error('Server export failed, using client-side generation');
        }

        const blob = await response.blob();
        downloadBlob(blob, `kompanero-tracking-${new Date().toISOString().split('T')[0]}.csv`);

    } catch (error) {
        console.error('Server CSV export failed, using client-side:', error);
        // Fallback to client-side CSV generation
        try {
            const csv = generateCSVClient(dataToExport);
            // Add UTF-8 BOM for Excel compatibility
            const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
            downloadBlob(blob, `kompanero-tracking-${new Date().toISOString().split('T')[0]}.csv`);
        } catch (clientError) {
            console.error('Client CSV generation error:', clientError);
            alert('Error exporting CSV: ' + clientError.message);
        }
    }
}

// Helper function to download blob with better browser compatibility
function downloadBlob(blob, filename) {
    // Check if we're in Electron
    const isElectron = navigator.userAgent.toLowerCase().indexOf(' electron/') > -1;
    
    if (isElectron || window.navigator.msSaveOrOpenBlob) {
        // IE10+ and Electron
        if (window.navigator.msSaveOrOpenBlob) {
            window.navigator.msSaveOrOpenBlob(blob, filename);
        } else {
            // Electron or modern browsers
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup with delay for better compatibility
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
            }, 100);
        }
    } else {
        // Modern browsers
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    }
}

// Client-side CSV generation as fallback
function generateCSVClient(data) {
    const headers = [
        'Order ID',
        'Order Date',
        'Customer Name',
        'Ordered Items',
        'Carrier',
        'Tracking Number',
        'Tracking URL',
        'Tracking Status'
    ];

    const escapeCSV = (value) => {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    };

    const csvRows = [];
    csvRows.push(headers.join(','));

    data.forEach(row => {
        const values = [
            escapeCSV(row.orderId || ''),
            escapeCSV(row.orderDate || ''),
            escapeCSV(row.customerName || ''),
            escapeCSV(row.orderedItems || ''),
            escapeCSV(row.carrier || ''),
            escapeCSV(row.trackingNumber || ''),
            escapeCSV(row.trackingUrl || ''),
            escapeCSV(row.trackingStatus || '')
        ];
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
}

// ============================================================================
// TABLE FILTER FUNCTIONS
// ============================================================================

function populateFilterDropdowns(data) {
    // Get unique carriers
    const carriers = [...new Set(data.map(order => order.carrier))].sort();
    filterCarrier.innerHTML = '<option value="">All Carriers</option>';
    carriers.forEach(carrier => {
        const option = document.createElement('option');
        option.value = carrier;
        option.textContent = carrier;
        filterCarrier.appendChild(option);
    });

    // Get unique statuses
    const statuses = [...new Set(data.map(order => order.trackingStatus))].sort();
    filterStatus.innerHTML = '<option value="">All Statuses</option>';
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status;
        option.textContent = status;
        filterStatus.appendChild(option);
    });
}

function applyFilters() {
    const orderIdFilter = filterOrderId.value.toLowerCase().trim();
    const customerFilter = filterCustomer.value.toLowerCase().trim();
    const itemsFilter = filterItems.value.toLowerCase().trim();
    const carrierFilter = filterCarrier.value;
    const statusFilter = filterStatus.value;

    // Filter the current results
    filteredResults = currentResults.filter(order => {
        const matchesOrderId = !orderIdFilter || order.orderId.toLowerCase().includes(orderIdFilter);
        const matchesCustomer = !customerFilter || order.customerName.toLowerCase().includes(customerFilter);
        const matchesItems = !itemsFilter || order.orderedItems.toLowerCase().includes(itemsFilter);
        const matchesCarrier = !carrierFilter || order.carrier === carrierFilter;
        const matchesStatus = !statusFilter || order.trackingStatus === statusFilter;

        return matchesOrderId && matchesCustomer && matchesItems && matchesCarrier && matchesStatus;
    });

    // Show/hide clear filters button
    const hasActiveFilters = orderIdFilter || customerFilter || itemsFilter || carrierFilter || statusFilter;
    clearFiltersBtn.style.display = hasActiveFilters ? 'inline-block' : 'none';

    // Update display
    displayFilteredResults(filteredResults);
}

function displayFilteredResults(data) {
    resultsBody.innerHTML = '';
    
    // Update results count
    resultsCount.textContent = `${data.length} order${data.length !== 1 ? 's' : ''} (of ${currentResults.length} total)`;

    if (data.length === 0) {
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

function clearFilters() {
    filterOrderId.value = '';
    filterCustomer.value = '';
    filterItems.value = '';
    filterCarrier.value = '';
    filterStatus.value = '';
    clearFiltersBtn.style.display = 'none';
    
    filteredResults = currentResults;
    displayFilteredResults(currentResults);
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
