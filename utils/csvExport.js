function convertToCSV(data) {
  if (!data || data.length === 0) {
    return '';
  }

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

function escapeCSV(value) {
  if (value === null || value === undefined) {
    return '';
  }
  
  const stringValue = String(value);
  
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  
  return stringValue;
}

module.exports = { convertToCSV };
