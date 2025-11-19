const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.error('SMTP configuration missing. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.');
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return cachedTransporter;
}

function escapeHtml(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDisplayDate(value) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    return String(value);
  }
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}-${month}-${year}`;
}

function buildPickupPendingEmailHtml(orders, context) {
  const fromDisplay = context && context.fromDate ? formatDisplayDate(context.fromDate) : '';
  const toDisplay = context && context.toDate ? formatDisplayDate(context.toDate) : '';
  const safeFromDate = fromDisplay ? escapeHtml(fromDisplay) : '';
  const safeToDate = toDisplay ? escapeHtml(toDisplay) : '';
  const safeCarrier = context && context.carrier && context.carrier !== 'all' ? escapeHtml(context.carrier) : '';
  const safeFulfillment = context && context.fulfillmentStatus && context.fulfillmentStatus !== 'all' ? escapeHtml(context.fulfillmentStatus) : '';

  const reportTitle = context && context.reportTitle
    ? escapeHtml(context.reportTitle)
    : 'Unfulfilled & Not Delivered Orders Report';

  const metaParts = [];
  if (safeFromDate && safeToDate) {
    metaParts.push(`Period: ${safeFromDate} to ${safeToDate}`);
  }
  if (safeCarrier) {
    metaParts.push(`Carrier: ${safeCarrier}`);
  }
  if (safeFulfillment) {
    metaParts.push(`Fulfillment: ${safeFulfillment}`);
  }
  const metaLine = metaParts.join(' | ');

  const rowsHtml = orders
    .map((order, index) => {
      const orderId = escapeHtml(order.orderId || '');
      const trackingNumber = escapeHtml(order.trackingNumber || '');
      const orderDate = escapeHtml(order.orderDate || '');
      const customerName = escapeHtml(order.customerName || '');
      const orderedItems = escapeHtml(order.orderedItems || '');
      const carrier = escapeHtml(order.carrier || '');
      const trackingStatus = escapeHtml(order.trackingStatus || '');

      return `
        <tr>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${index + 1}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${orderId}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${trackingNumber}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${orderDate}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${customerName}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${orderedItems}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${carrier}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;font-size:12px;">${trackingStatus}</td>
        </tr>`;
    })
    .join('');

  const tableBody = rowsHtml || `
        <tr>
          <td colspan="8" style="padding:16px 12px;border:1px solid #e0e0e0;font-size:13px;text-align:center;color:#666666;">No unfulfilled or not-delivered orders for the selected filters.</td>
        </tr>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>${reportTitle} - Kompanero</title>
</head>
<body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;background-color:#f5f3ef;color:#333333;">
  <div style="max-width:900px;margin:0 auto;background-color:#ffffff;border:1px solid #e0ded8;">
    <div style="padding:16px 24px;border-bottom:4px solid #c49a3b;">
      <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
        <tr>
          <td style="vertical-align:middle;white-space:nowrap;">
            <img src="https://kompanero.in/cdn/shop/files/Kompanero_Logo_nofgh_9577cbe3-e2de-460c-afc0-216ac43635e2.png?v=1693299674&width=360" alt="Kompanero Logo" style="height:32px;display:block;" />
          </td>
          <td style="vertical-align:middle;padding-left:12px;">
            <div style="font-size:18px;font-weight:bold;color:#333333;">${reportTitle}</div>
            <div style="font-size:12px;color:#777777;">Kompanero</div>
          </td>
        </tr>
      </table>
    </div>
    <div style="padding:16px 24px 8px 24px;font-size:14px;line-height:1.5;">
      <p style="margin:0 0 8px 0;">Dear Team,</p>
      <p style="margin:0 0 12px 0;">The following orders require your attention.</p>
      ${metaLine ? `<p style="margin:0 0 4px 0;font-size:12px;color:#666666;">${metaLine}</p>` : ''}
    </div>
    <div style="padding:0 24px 24px 24px;">
      <table cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;font-family:Arial,Helvetica,sans-serif;">
        <thead>
          <tr>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">#</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">Order No</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">AWB</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">Order Date</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">Customer</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">Items</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">Courier</th>
            <th style="padding:8px 12px;border:1px solid #e0e0e0;background-color:#c49a3b;color:#ffffff;font-size:12px;text-align:left;">Status</th>
          </tr>
        </thead>
        <tbody>
${tableBody}
        </tbody>
      </table>
    </div>
    <div style="padding:12px 24px 16px 24px;font-size:12px;color:#666666;border-top:1px solid #e0ded8;">
      <div style="margin-bottom:2px;">Best regards,</div>
      <div>Kompanero Automated System</div>
    </div>
  </div>
</body>
</html>`;

  return html;
}

async function sendPickupPendingEmail(orders, context) {
  if (!orders || orders.length === 0) {
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }

  const from = process.env.REPORT_EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.REPORT_EMAIL_TO || from;

  if (!to) {
    console.error('No REPORT_EMAIL_TO or SMTP_USER configured for pickup pending email.');
    return false;
  }

  const subject = 'Unfulfilled & Not Delivered Orders Report - Kompanero';
  const html = buildPickupPendingEmailHtml(orders, Object.assign({}, context || {}, {
    reportTitle: 'Unfulfilled & Not Delivered Orders Report'
  }));

  await transporter.sendMail({
    from,
    to,
    subject,
    html
  });

  return true;
}

async function sendUnfulfilledOrdersEmail(orders, context) {
  if (!orders || orders.length === 0) {
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }

  const from = process.env.REPORT_EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.REPORT_EMAIL_TO || from;

  if (!to) {
    console.error('No REPORT_EMAIL_TO or SMTP_USER configured for unfulfilled orders email.');
    return false;
  }

  const subject = 'Unfulfilled Orders Report - Kompanero';
  const html = buildPickupPendingEmailHtml(orders, Object.assign({}, context || {}, {
    reportTitle: 'Unfulfilled Orders Report'
  }));

  await transporter.sendMail({
    from,
    to,
    subject,
    html
  });

  return true;
}

async function sendNotDeliveredOrdersEmail(orders, context) {
  if (!orders || orders.length === 0) {
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }

  const from = process.env.REPORT_EMAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const to = process.env.REPORT_EMAIL_TO || from;

  if (!to) {
    console.error('No REPORT_EMAIL_TO or SMTP_USER configured for not delivered orders email.');
    return false;
  }

  const subject = 'Not Delivered Orders Report - Kompanero';
  const html = buildPickupPendingEmailHtml(orders, Object.assign({}, context || {}, {
    reportTitle: 'Not Delivered Orders Report'
  }));

  await transporter.sendMail({
    from,
    to,
    subject,
    html
  });

  return true;
}

module.exports = {
  sendPickupPendingEmail,
  buildPickupPendingEmailHtml,
  sendUnfulfilledOrdersEmail,
  sendNotDeliveredOrdersEmail
};
