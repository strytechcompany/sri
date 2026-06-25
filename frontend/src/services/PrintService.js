import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { settingsAPI } from './api';

// ─── Module-level singleton lock ──────────────────────────────────────────────
// expo-print's native layer only allows ONE print/file operation at a time.
// Using printToFileAsync+shareAsync completely avoids the Print.printAsync
// singleton lock that causes "Another print request is already in progress".
let _busy = false;
const acquire = () => { if (_busy) return false; _busy = true; return true; };
const release = () => { _busy = false; };

const generateHTML = async (transaction, isThermal = true, customTamilMsg) => {
  const settingsReq = await settingsAPI.getSettings();
  const settings = settingsReq.data.data;
  const { shopProfile, billSettings } = settings;
  const tamilMsg = customTamilMsg ?? billSettings.tamilMessage;
  const footerMsg = billSettings.footerMessage;
  const {
    _id,
    createdAt,
    transactionType,
    customerId,
    issueItems = [],
    receiptItems = [],
    paymentMode,
    paymentDetails,
    issueTotalWeight,
    issueTotalAmount,
    receiptTotalWeight,
    receiptTotalAmount,
    finalAmount,
    goldRate,
    description,
    goldPaymentWeight,
    goldPaymentPurity,
    goldConvertedAmount,
    oldBalanceBefore,
    oldBalanceAfter,
    advanceBalanceBefore,
    advanceBalanceAfter,
    convertedGram,
    gstDetails,
  } = transaction;

  const dateStr = new Date(createdAt).toLocaleDateString('en-GB');
  const timeStr = new Date(createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const row = (label, value, className = '') => `
    <table class="info-row ${className}">
      <tr>
        <td class="label-cell">${label}</td>
        <td class="value-cell">${value}</td>
      </tr>
    </table>
  `;

  const thermalStyles = `
    html, body { margin: 0; padding: 0; width: 80mm; height: auto; background: #fff; color: #000; font-family: monospace; font-size: 12px; font-weight: bold; }
    * { color: #000; background: #fff; }
    .receipt-container { width: 75mm; height: auto; margin: 0 auto; padding: 0 0 0 2mm; font-family: monospace; font-size: 12px; font-weight: bold; color: #000; background: #fff; text-align: left; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
    .info-row { width: 100%; border-collapse: collapse; margin: 2px 0; font-size: 12px; font-weight: bold; color: #000; background: #fff; }
    .info-row td { padding: 0 2px; vertical-align: top; color: #000; background: #fff; }
    .label-cell { text-align: left; width: 45%; }
    .value-cell { text-align: right; width: 55%; }
    table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 12px; table-layout: fixed; font-weight: bold; color: #000; background: #fff; }
    th, td { text-align: left; padding: 2px; vertical-align: top; word-wrap: break-word; color: #000; background: #fff; }
    th { border-bottom: 1px dashed #000; }
    .amt-col { text-align: right; }
  `;

  const styles = thermalStyles; // Standardize all printing to 80mm Thermal Receipt

  let issueRows = '';
  issueItems.forEach(item => {
    issueRows += `
      <tr>
        <td>${item.billNo}</td>
        <td>${item.itemName}</td>
        <td>${item.weight.toFixed(3)}g</td>
        <td>${item.purity.toFixed(3)}g</td>
        <td class="amt-col">${item.amount.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
      </tr>
    `;
  });

  let receiptRows = '';
  receiptItems.forEach(item => {
    receiptRows += `
      <tr>
        <td>${item.billNo || '-'}</td>
        <td>${item.receiptType}</td>
        <td>${item.weight.toFixed(3)}g</td>
        <td>${item.less}g</td>
        <td>${item.purity.toFixed(3)}g</td>
        <td class="amt-col">${item.amount.toLocaleString('en-IN', {maximumFractionDigits:2})}</td>
      </tr>
    `;
  });

  const cgst = gstDetails?.cgstAmount || 0;
  const sgst = gstDetails?.sgstAmount || 0;
  const collectedAmount = paymentMode === 'Gold' ? goldConvertedAmount : (paymentDetails?.amount || 0);

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
        <style>${styles}</style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="center bold" style="margin-bottom: 5px;">SRI VAISHNAVI JEWELLERS</div>
        <div class="center">No 370, Big Bazaar Street</div>
        <div class="center">(Opp - B.G. Naidu Sweets)</div>
        <div class="center">Phone: 8248134521</div>
        
        <div class="divider"></div>
        <div class="center bold">${transactionType} BILL</div>
        <div class="divider"></div>

        ${row('Txn No:', _id.slice(-6).toUpperCase())}
        ${row('Date/Time:', `${dateStr} ${timeStr}`)}

        <div class="divider"></div>
        <div class="bold">CUSTOMER DETAILS</div>
        ${row('Name:', customerId?.customerName || 'N/A')}
        ${row('Phone:', customerId?.phoneNumber || 'N/A')}
        ${row('Address:', customerId?.address || 'N/A')}
        ${row('Old Bal:', `${Number(oldBalanceBefore).toFixed(3)}g`)}
        ${row('Advance:', `${Number(advanceBalanceBefore).toFixed(3)}g`)}

        <div class="divider"></div>
        <div class="center bold" style="padding: 5px; border: 1px dashed #000;">
          GOLD RATE TODAY: ₹${goldRate}
        </div>

        ${issueItems.length > 0 ? `
          <div class="divider"></div>
          <div class="bold">ISSUED PRODUCTS</div>
          <table>
            <thead>
              <tr><th>Bill No</th><th>Item</th><th>Wt(g)</th><th>Purity</th><th class="amt-col">Amt(₹)</th></tr>
            </thead>
            <tbody>${issueRows}</tbody>
          </table>
          <div class="divider"></div>
          ${row('Issue Total Wt:', `${issueTotalWeight.toFixed(3)}g`, 'bold')}
          ${row('Issue Total Amt:', issueTotalAmount.toLocaleString('en-IN', {maximumFractionDigits:2}), 'bold')}
        ` : ''}

        ${receiptItems.length > 0 ? `
          <div class="divider"></div>
          <div class="bold">RECEIVED ITEMS</div>
          <table>
            <thead>
              <tr><th>Bill No</th><th>Type</th><th>Wt(g)</th><th>Less</th><th>Purity</th><th class="amt-col">Amt(₹)</th></tr>
            </thead>
            <tbody>${receiptRows}</tbody>
          </table>
          <div class="divider"></div>
          ${row('Receipt Total Wt:', `${receiptTotalWeight.toFixed(3)}g`, 'bold')}
          ${row('Receipt Total Amt:', receiptTotalAmount.toLocaleString('en-IN', {maximumFractionDigits:2}), 'bold')}
        ` : ''}

        <div class="divider"></div>
        <div class="bold">PAYMENT DETAILS</div>
        ${row('Mode:', paymentMode)}
        ${paymentMode === 'Gold' ? `
          ${row('Gold Wt:', `${goldPaymentWeight}g (${goldPaymentPurity})`)}
        ` : ''}
        ${row('Collected Amt:', collectedAmount.toLocaleString('en-IN', {maximumFractionDigits:2}))}
        ${description ? row('Desc:', description) : ''}

        <div class="divider"></div>
        <div class="bold">PAYMENT SUMMARY</div>
        ${row('Subtotal:', (issueTotalAmount - receiptTotalAmount).toLocaleString('en-IN', {maximumFractionDigits:2}))}
        ${gstDetails?.isOn ? `
          ${row('CGST:', cgst.toLocaleString('en-IN', {maximumFractionDigits:2}))}
          ${row('SGST:', sgst.toLocaleString('en-IN', {maximumFractionDigits:2}))}
        ` : ''}
        ${row('FINAL AMOUNT:', `₹${finalAmount.toLocaleString('en-IN', {maximumFractionDigits:2})}`, 'bold')}
        ${row('PAID:', `- ₹${collectedAmount.toLocaleString('en-IN', {maximumFractionDigits:2})}`, 'bold')}
        ${row('BALANCE DUE:', `₹${Math.max(0, finalAmount - collectedAmount).toLocaleString('en-IN', {maximumFractionDigits:2})}`, 'bold')}

        <div class="divider"></div>
        <div class="bold">TRANSACTION SUMMARY</div>
        ${row('Converted Gram:', `${Number(convertedGram).toFixed(3)}g`)}
        ${row('New Old Balance:', `${Number(oldBalanceAfter).toFixed(3)}g`, 'bold')}
        ${row('New Advance:', `${Number(advanceBalanceAfter).toFixed(3)}g`, 'bold')}

        <div class="divider"></div>
        <div class="center" style="margin-top: 10px;">${tamilMsg}</div>
        <div class="center" style="margin-top: 10px;">Thank You For Visiting</div>
        <div class="center bold">Sri Vaishnavi Jewellers</div>
        <div class="center">Visit Again</div>
        </div>
      </body>
    </html>
  `;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────
// _printViaPDF: generates a correctly-sized PDF then opens the NATIVE print
// dialog (not share sheet). Share-to-print sends raw PDF binary to thermal
// printers which they interpret as ESC/POS noise → blank paper.
const _printViaPDF = async (html, height) => {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 227,   // 80mm in PDF points (80 × 72/25.4 ≈ 227)
    height,
    margins: { left: 0, top: 0, right: 0, bottom: 0 },
  });
  await Print.printAsync({ uri });
};

// _sharePDF: used only for WhatsApp sharing — opens the OS share sheet.
const _sharePDF = async (html, dialogTitle, height) => {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
    width: 227,
    height,
  });
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device');
  }
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    dialogTitle,
    UTI: 'com.adobe.pdf',
  });
};

// Heights are in PDF points (1pt = 1/72 inch). Each row ≈ 18pt, section
// headers/dividers ≈ 14pt each. Keep estimates tight — excess = blank paper.
const calculateTransactionHeight = (transaction) => {
  const issueCount = transaction.issueItems?.length || 0;
  const receiptCount = transaction.receiptItems?.length || 0;

  let h = 470; // fixed header/customer/payment/summary/footer content
  if (issueCount > 0) h += 42 + (issueCount * 20);
  if (receiptCount > 0) h += 42 + (receiptCount * 20);
  if (transaction.gstDetails?.isOn) h += 28;
  if (transaction.description) h += 24;

  return Math.min(Math.max(h, 560), 1100);
};

export const PrintService = {
  printThermal: async (transaction, customTamilMsg) => {
    if (!acquire()) throw new Error('A print action is already in progress.');
    try {
      const html = await generateHTML(transaction, true, customTamilMsg);
      const height = calculateTransactionHeight(transaction);
      await _printViaPDF(html, height);
    } finally {
      release();
    }
  },

  printA4: async (transaction, customTamilMsg) => {
    if (!acquire()) throw new Error('A print action is already in progress.');
    try {
      const html = await generateHTML(transaction, false, customTamilMsg);
      // For A4, we don't specify height to use default A4 length
      await _sharePDF(html, 'Print A4 Bill');
    } finally {
      release();
    }
  },

  shareWhatsApp: async (transaction, customTamilMsg) => {
    if (!acquire()) throw new Error('A share action is already in progress.');
    try {
      const html = await generateHTML(transaction, false, customTamilMsg);
      const height = calculateTransactionHeight(transaction);
      await _sharePDF(html, 'Share Bill via WhatsApp', height);
    } finally {
      release();
    }
  },
};

// ─── Settlement HTML generator ────────────────────────────────────────────────
const generateSettlementHTML = async (settlement, originalBillNumber) => {
  const settingsReq = await settingsAPI.getSettings();
  const { billSettings } = settingsReq.data.data;
  const tamilMsg = billSettings.tamilMessage;
  const footerMsg = billSettings.footerMessage;

  const dateStr = new Date(settlement.createdAt).toLocaleDateString('en-GB');
  const timeStr = new Date(settlement.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>
          @page { size: 80mm auto; margin: 0; }
          body { margin: 0; padding: 0; width: 80mm; background: #fff; }
          .receipt-container { width: 75mm; margin: 0 auto; padding: 0; padding-left: 2mm; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 600; color: #000 !important; text-align: left; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .divider { border-bottom: 1px dashed #000; margin: 4px 0; }
          .row { display: flex; justify-content: space-between; margin: 2px 0; }
          .footer { margin-top: 8px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="center bold" style="font-size:16px;">SRI VAISHNAVI JEWELLERS</div>
          <div class="center">No 370, Big Bazaar Street</div>
        <div class="center">(Opp - B.G. Naidu Sweets)</div>
        <div class="center">Phone: 8248134521</div>
        <div class="divider"></div>
        <div class="center bold" style="font-size:14px;">SETTLEMENT RECEIPT</div>
        <div class="divider"></div>
        <div class="row"><div>Receipt No:</div><div class="bold">${settlement.settlementBillNumber}</div></div>
        <div class="row"><div>Original Bill:</div><div class="bold">${originalBillNumber}</div></div>
        <div class="row"><div>Date/Time:</div><div>${dateStr} ${timeStr}</div></div>
        <div class="divider"></div>
        <div class="bold">SETTLEMENT DETAILS</div>
        <div class="row"><div>Payment Mode:</div><div>${settlement.paymentMode}</div></div>
        <div class="row"><div>Gold Rate:</div><div>₹${settlement.goldRateAtSettlement?.toLocaleString('en-IN') || '-'}</div></div>
        <div class="row bold"><div>Amount Paid:</div><div>₹${settlement.amountPaid.toLocaleString('en-IN')}</div></div>
        <div class="row bold"><div>Gram Settled:</div><div>${settlement.gramSettled.toFixed(3)}g</div></div>
        ${settlement.description ? `<div class="row"><div>Desc:</div><div>${settlement.description}</div></div>` : ''}
        <div class="divider"></div>
        <div class="bold">BALANCE SUMMARY</div>
        <div class="row"><div>Outstanding Before:</div><div>₹${settlement.outstandingBefore.toLocaleString('en-IN')}</div></div>
        <div class="row"><div>Amount Paid:</div><div>- ₹${settlement.amountPaid.toLocaleString('en-IN')}</div></div>
        <div class="row bold"><div>Outstanding After:</div><div>₹${settlement.outstandingAfter.toLocaleString('en-IN')}</div></div>
        <div class="row bold"><div>Status:</div><div>${settlement.outstandingAfter <= 0 ? 'PAID' : 'PARTIAL'}</div></div>
        <div class="footer">
          <p>${tamilMsg}</p>
          <p>${footerMsg}</p>
        </div>
        <div class="center bold">Sri Vaishnavi Jewellers</div>
        </div>
      </body>
    </html>
  `;
};

const calculateSettlementHeight = (settlement) => {
  let h = 220; // header + settlement details + balance summary + footer
  if (settlement.description) h += 18;
  return h + 25;
};

export const SettlementPrintService = {
  printReceipt: async (settlement, originalBillNumber) => {
    if (!acquire()) throw new Error('A print action is already in progress.');
    try {
      const html = await generateSettlementHTML(settlement, originalBillNumber);
      const height = calculateSettlementHeight(settlement);
      await _printViaPDF(html, height);
    } finally {
      release();
    }
  },

  shareWhatsApp: async (settlement, originalBillNumber) => {
    if (!acquire()) throw new Error('A share action is already in progress.');
    try {
      const html = await generateSettlementHTML(settlement, originalBillNumber);
      const height = calculateSettlementHeight(settlement);
      await _sharePDF(html, 'Share Settlement Receipt', height);
    } finally {
      release();
    }
  },
};

// ─── Line Stock HTML generator ────────────────────────────────────────────────
const generateLineStockHTML = (transaction) => {
  const dateStr = new Date(transaction.createdAt).toLocaleDateString('en-GB');
  const timeStr = new Date(transaction.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  let issueRows = '';
  (transaction.issuedProducts || []).forEach((item, index) => {
    issueRows += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.itemNumber + (item.barcode ? '<br/><span style="font-size:10px;">' + item.barcode + '</span>' : '')}</td>
        <td>${item.itemName}</td>
        <td>${item.category}</td>
        <td>${parseFloat(item.weight).toFixed(3)}g</td>
        <td>${item.purity}</td>
        <td>${item.count}</td>
      </tr>
    `;
  });

  const styles = `
    @page { size: 80mm auto; margin: 0; }
    body { margin: 0; padding: 0; width: 80mm; background: #fff; }
    .receipt-container { width: 75mm; margin: 0 auto; padding: 0; padding-left: 2mm; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 600; color: #000 !important; text-align: left; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 12px; font-weight: 600; color: #000; }
    th, td { text-align: left; padding: 2px; vertical-align: top; }
    th { border-bottom: 1px dashed #000; }
  `;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${styles}</style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="center bold" style="font-size:16px;">SRI VAISHNAVI JEWELLERS</div>
          <div class="center">No 370, Big Bazaar Street</div>
        <div class="center">(Opp - B.G. Naidu Sweets)</div>
        <div class="center">Phone: 8248134521</div>
        <div class="divider"></div>
        <div class="center bold" style="font-size:14px;">LINE STOCK ISSUE BILL</div>
        <div class="divider"></div>
        
        <div class="row"><div>Txn No:</div><div class="bold">${transaction.transactionNumber}</div></div>
        <div class="row"><div>Date/Time:</div><div>${dateStr} ${timeStr}</div></div>
        
        <div class="divider"></div>
        <div class="bold">LINE STOCKER DETAILS</div>
        <div class="row"><div>Name:</div><div>${transaction.customerId?.customerName || 'N/A'}</div></div>
        <div class="row"><div>Phone:</div><div>${transaction.customerId?.phoneNumber || 'N/A'}</div></div>
        <div class="row"><div>Address:</div><div>${transaction.customerId?.address || 'N/A'}</div></div>

        <div class="divider"></div>
        <div class="bold">ISSUE DETAILS</div>
        <div class="row"><div>Issue Date:</div><div>${new Date(transaction.issueDate).toLocaleDateString('en-GB')}</div></div>
        <div class="row"><div>Expected Return:</div><div class="bold">${new Date(transaction.expectedReturnDate).toLocaleDateString('en-GB')}</div></div>
        ${transaction.description ? `<div class="row" style="font-style: italic;"><div>Desc:</div><div style="text-align:right; max-width: 60%;">${transaction.description}</div></div>` : ''}

        <div class="divider"></div>
        <div class="bold">ISSUED PRODUCTS</div>
        <table>
          <thead>
            <tr><th>#</th><th>Code</th><th>Item</th><th>Cat</th><th>Wt(g)</th><th>Purity</th><th>Qty</th></tr>
          </thead>
          <tbody>${issueRows}</tbody>
        </table>
        <div class="divider"></div>
        
        <div class="row bold"><div>Total Items:</div><div>${transaction.totalItems}</div></div>
        <div class="row bold"><div>Total Gram:</div><div>${Number(transaction.totalGram).toFixed(3)}g</div></div>
        <div class="row"><div>Old Balance Before:</div><div>${Number(transaction.oldBalanceBefore).toFixed(3)}g</div></div>
        <div class="row bold"><div>Old Balance After:</div><div>${Number(transaction.oldBalanceAfter).toFixed(3)}g</div></div>

        <div class="divider"></div>
        <div class="center">Thank You</div>
        <div class="center bold">Sri Vaishnavi Jewellers</div>
        </div>
      </body>
    </html>
  `;
};

const calculateLineStockHeight = (transaction) => {
  let h = 240; // header + stocker + issue details + totals + footer
  if (transaction.issuedProducts?.length > 0) {
    h += 25 + (transaction.issuedProducts.length * 18);
  }
  if (transaction.description) h += 18;
  return h + 25;
};

export const LineStockPrintService = {
  printBill: async (transaction) => {
    if (!acquire()) throw new Error('A print action is already in progress.');
    try {
      const html = generateLineStockHTML(transaction);
      const height = calculateLineStockHeight(transaction);
      await _printViaPDF(html, height);
    } finally {
      release();
    }
  },

  shareWhatsApp: async (transaction) => {
    if (!acquire()) throw new Error('A share action is already in progress.');
    try {
      const html = generateLineStockHTML(transaction);
      const height = calculateLineStockHeight(transaction);
      await _sharePDF(html, 'Share Line Stock Bill', height);
    } finally {
      release();
    }
  },
};

// ─── Line Stock Settlement HTML generator ─────────────────────────────────────
const generateLineStockSettlementHTML = (settlement) => {
  const dateStr = new Date(settlement.createdAt).toLocaleDateString('en-GB');
  const timeStr = new Date(settlement.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  
  let soldRows = '';
  (settlement.soldItems || []).forEach((item, index) => {
    soldRows += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.itemNumber}</td>
        <td>${item.itemName}</td>
        <td>${parseFloat(item.weight).toFixed(3)}g</td>
        <td>${item.purity}</td>
        <td>${item.amount ? `Rs.${item.amount}` : '-'}</td>
      </tr>
    `;
  });

  let returnedRows = '';
  (settlement.returnedItems || []).forEach((item, index) => {
    returnedRows += `
      <tr>
        <td>${index + 1}</td>
        <td>${item.itemNumber}</td>
        <td>${item.itemName}</td>
        <td>${parseFloat(item.weight).toFixed(3)}g</td>
        <td>${item.purity}</td>
      </tr>
    `;
  });

  const styles = `
    @page { size: 80mm auto; margin: 0; }
    body { margin: 0; padding: 0; width: 80mm; background: #fff; }
    .receipt-container { width: 75mm; margin: 0 auto; padding: 0; padding-left: 2mm; box-sizing: border-box; font-family: 'Courier New', Courier, monospace; font-size: 12px; font-weight: 600; color: #000 !important; text-align: left; }
    .center { text-align: center; }
    .bold { font-weight: bold; }
    .divider { border-bottom: 1px dashed #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; margin: 5px 0; font-size: 12px; font-weight: 600; color: #000; }
    th, td { text-align: left; padding: 2px; vertical-align: top; }
    th { border-bottom: 1px dashed #000; }
  `;

  return `
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <style>${styles}</style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="center bold" style="font-size:16px;">SRI VAISHNAVI JEWELLERS</div>
          <div class="center">No 370, Big Bazaar Street</div>
        <div class="center">(Opp - B.G. Naidu Sweets)</div>
        <div class="center">Phone: 8248134521</div>
        <div class="divider"></div>
        <div class="center bold" style="font-size:14px;">LINE STOCK SETTLEMENT</div>
        <div class="divider"></div>
        
        <div class="row"><div>Settlement:</div><div class="bold">${settlement.settlementNumber}</div></div>
        <div class="row"><div>Issue Txn:</div><div>${settlement.lineStockTransactionId?.transactionNumber || ''}</div></div>
        <div class="row"><div>Date/Time:</div><div>${dateStr} ${timeStr}</div></div>
        
        <div class="divider"></div>
        <div class="bold">LINE STOCKER DETAILS</div>
        <div class="row"><div>Name:</div><div>${settlement.customerId?.customerName || 'N/A'}</div></div>
        <div class="row"><div>Phone:</div><div>${settlement.customerId?.phoneNumber || 'N/A'}</div></div>

        ${settlement.soldItems?.length > 0 ? `
        <div class="divider"></div>
        <div class="bold">SOLD PRODUCTS</div>
        <table>
          <thead>
            <tr><th>#</th><th>Code</th><th>Item</th><th>Wt(g)</th><th>Purity</th><th>Amt</th></tr>
          </thead>
          <tbody>${soldRows}</tbody>
        </table>
        ` : ''}

        ${settlement.returnedItems?.length > 0 ? `
        <div class="divider"></div>
        <div class="bold">RETURNED PRODUCTS</div>
        <table>
          <thead>
            <tr><th>#</th><th>Code</th><th>Item</th><th>Wt(g)</th><th>Purity</th></tr>
          </thead>
          <tbody>${returnedRows}</tbody>
        </table>
        ` : ''}

        <div class="divider"></div>
        <div class="bold">PAYMENTS</div>
        <div class="row"><div>Cash:</div><div>Rs.${settlement.paymentDetails?.cash || 0}</div></div>
        <div class="row"><div>Online:</div><div>Rs.${settlement.paymentDetails?.online || 0}</div></div>
        <div class="row"><div>Card:</div><div>Rs.${settlement.paymentDetails?.card || 0}</div></div>
        <div class="row"><div>Gold:</div><div>${Number(settlement.paymentDetails?.gold || 0).toFixed(3)}g</div></div>

        <div class="divider"></div>
        
        <div class="row"><div>Previous Balance:</div><div>${Number(settlement.previousBalance).toFixed(3)}g</div></div>
        <div class="row bold" style="color:red;"><div>Total Sold Deduct:</div><div>-${settlement.soldItems?.reduce((s,i)=>s+i.weight,0).toFixed(3)}g</div></div>
        <div class="row bold" style="color:red;"><div>Returned Deduct:</div><div>-${settlement.returnedItems?.reduce((s,i)=>s+i.weight,0).toFixed(3)}g</div></div>
        <div class="divider"></div>
        <div class="row bold" style="color:green;"><div>Cash Payments:</div><div>Rs.${(settlement.paymentDetails?.cash || 0) + (settlement.paymentDetails?.online || 0) + (settlement.paymentDetails?.card || 0)}</div></div>
        <div class="divider"></div>
        <div class="row bold"><div>Final Balance:</div><div>${Number(settlement.finalBalance).toFixed(3)}g</div></div>
        <div class="row"><div>Advance Balance:</div><div>${Number(settlement.advanceBalance).toFixed(3)}g</div></div>

        <div class="divider"></div>
        <div class="center" style="font-size:10px; margin-top:5px; font-weight:bold;">
          நீங்கள் வாங்கும் ஒவ்வொரு கிராம் தங்கமும், உங்கள் எதிர்காலத்தின் ஒளிமயமான சேமிப்பு.
        </div>
        <div class="center" style="margin-top:10px;">Thank You</div>
        <div class="center bold">Sri Vaishnavi Jewellers</div>
        </div>
      </body>
    </html>
  `;
};

const calculateLineStockSettlementHeight = (settlement) => {
  let h = 260; // header + stocker + payments + balance + footer
  if (settlement.soldItems?.length > 0) {
    h += 25 + (settlement.soldItems.length * 18);
  }
  if (settlement.returnedItems?.length > 0) {
    h += 25 + (settlement.returnedItems.length * 18);
  }
  return h + 25;
};

export const LineStockSettlementPrintService = {
  printBill: async (settlement) => {
    if (!acquire()) throw new Error('A print action is already in progress.');
    try {
      const html = generateLineStockSettlementHTML(settlement);
      const height = calculateLineStockSettlementHeight(settlement);
      await _printViaPDF(html, height);
    } finally {
      release();
    }
  },

  shareWhatsApp: async (settlement) => {
    if (!acquire()) throw new Error('A share action is already in progress.');
    try {
      const html = generateLineStockSettlementHTML(settlement);
      const height = calculateLineStockSettlementHeight(settlement);
      await _sharePDF(html, 'Share Settlement Bill', height);
    } finally {
      release();
    }
  },
};
