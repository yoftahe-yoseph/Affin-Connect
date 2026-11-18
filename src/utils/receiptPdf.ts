import { jsPDF } from 'jspdf';
import type { Order, Shop } from '../types';
import {
  buildFinancialReceiptData,
  formatETB,
  type FinancialReceiptData,
} from './marketplaceLogic';

function renderReceiptLinesText(receipt: FinancialReceiptData): string {
  const statusLine =
    receipt.bannerTone === 'paid'
      ? 'Payment Successful'
      : receipt.bannerTone === 'refunded'
        ? 'Payment Refunded'
        : 'Order Summary (Payment Pending)';

  const lines: string[] = [
    `Affin Connect · Hawassa`,
    statusLine,
    `Receipt No: ${receipt.receiptNumber}`,
    `Order Ref: ${receipt.orderRef}`,
    `Date & Time: ${receipt.issuedAtDisplay}`,
    `Merchant: ${receipt.merchantName} (${receipt.merchantLocation})`,
    '---',
    ...receipt.items.map(
      (item) =>
        `${item.quantity}x ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ''} - ${formatETB(item.lineTotal)}`
    ),
    '---',
    `Subtotal: ${formatETB(receipt.subtotal)}`,
  ];

  if (receipt.promoDiscountAmount > 0) {
    lines.push(
      `Discount${receipt.promoCode ? ` (${receipt.promoCode})` : ''}: -${formatETB(receipt.promoDiscountAmount)}`
    );
  }
  if (receipt.loyaltyDiscountAmount > 0) {
    lines.push(
      `Loyalty Points (${receipt.pointsRedeemed} pts): -${formatETB(receipt.loyaltyDiscountAmount)}`
    );
  }

  lines.push(
    `Delivery Fee: ${receipt.deliveryFee === 0 ? 'Free' : formatETB(receipt.deliveryFee)}`,
    `Total Amount: ${formatETB(receipt.totalAmount)}`,
    `Payment Method: ${receipt.paymentMethodLabel}${receipt.paymentReference ? ` (${receipt.paymentReference})` : ''}`,
    `Thank you for shopping with Affin Connect!`
  );

  return lines.join('\n');
}

export function createReceiptPdfDocument(
  order: Order,
  shop?: Pick<Shop, 'name' | 'neighborhood' | 'address' | 'city'>
): { doc: jsPDF; fileName: string; receipt: FinancialReceiptData } {
  const receipt = buildFinancialReceiptData(order, shop);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  // Top emerald accent bar
  doc.setFillColor(0, 214, 143);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Header brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(3, 23, 25);
  doc.text('Affin Connect', margin, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(82, 102, 100);
  doc.text('Hawassa · Buy Local · Grow Together', margin, y + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(3, 23, 25);
  doc.text('OFFICIAL RECEIPT', pageWidth - margin, y, { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(82, 102, 100);
  doc.text(receipt.receiptNumber, pageWidth - margin, y + 5.5, { align: 'right' });

  y += 13;

  // Truthful status banner
  if (receipt.bannerTone === 'paid') {
    doc.setFillColor(0, 214, 143);
    doc.roundedRect(margin, y, contentWidth, 10, 2.5, 2.5, 'F');
    doc.setTextColor(3, 23, 25);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Payment Successful', pageWidth / 2, y + 6.5, { align: 'center' });
  } else if (receipt.bannerTone === 'refunded') {
    doc.setFillColor(255, 228, 230);
    doc.roundedRect(margin, y, contentWidth, 10, 2.5, 2.5, 'F');
    doc.setTextColor(190, 18, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Payment Refunded', pageWidth / 2, y + 6.5, { align: 'center' });
  } else {
    doc.setFillColor(254, 243, 199);
    doc.roundedRect(margin, y, contentWidth, 10, 2.5, 2.5, 'F');
    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('Order Summary · Payment Pending', pageWidth / 2, y + 6.5, { align: 'center' });
  }

  y += 17;

  // Metadata rows
  const drawMetaRow = (label: string, value: string, mono = false) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 114);
    doc.text(label, margin, y);

    doc.setFont(mono ? 'courier' : 'helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 6.2;
  };

  drawMetaRow('Receipt No:', receipt.receiptNumber, true);
  drawMetaRow('Order Ref:', receipt.orderRef, true);
  drawMetaRow('Date & Time:', receipt.issuedAtDisplay);
  drawMetaRow('Customer:', receipt.customerName);

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Merchant section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 114);
  doc.text('MERCHANT DETAILS', margin, y);
  y += 5.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(receipt.merchantName, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(82, 102, 100);
  doc.text(receipt.merchantLocation, margin, y);

  y += 7;
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Items header
  const qtyColX = pageWidth - margin - 42;
  const priceColX = pageWidth - margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 114);
  doc.text('Items', margin, y);
  doc.text('Qty', qtyColX, y, { align: 'right' });
  doc.text('Price', priceColX, y, { align: 'right' });
  y += 4;
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // Items rows
  for (const item of receipt.items) {
    if (y > 245) {
      doc.addPage();
      y = 20;
    }
    const label = item.variantLabel ? `${item.name} (${item.variantLabel})` : item.name;
    const wrapped = doc.splitTextToSize(label, contentWidth - 52) as string[];
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(wrapped, margin, y);

    doc.setFont('helvetica', 'normal');
    doc.text(String(item.quantity), qtyColX, y, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(formatETB(item.lineTotal), priceColX, y, { align: 'right' });

    y += Math.max(6.5, wrapped.length * 4.8 + 1.5);
  }

  y += 2;
  doc.line(margin, y, pageWidth - margin, y);
  y += 7;

  // Totals breakdown
  const drawTotalRow = (label: string, value: string, color: [number, number, number] = [51, 65, 85]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(82, 102, 100);
    doc.text(label, margin, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(value, pageWidth - margin, y, { align: 'right' });
    y += 6.5;
  };

  drawTotalRow('Subtotal', formatETB(receipt.subtotal));

  if (receipt.promoDiscountAmount > 0) {
    drawTotalRow(
      `Discount${receipt.promoCode ? ` (${receipt.promoCode})` : ''}`,
      `-${formatETB(receipt.promoDiscountAmount)}`,
      [4, 120, 87]
    );
  }
  if (receipt.loyaltyDiscountAmount > 0) {
    drawTotalRow(
      `Loyalty Points (${receipt.pointsRedeemed} pts)`,
      `-${formatETB(receipt.loyaltyDiscountAmount)}`,
      [4, 120, 87]
    );
  }

  drawTotalRow(
    'Delivery Fee',
    receipt.deliveryFee === 0 ? 'Free' : formatETB(receipt.deliveryFee)
  );

  y += 1.5;
  doc.setFillColor(232, 249, 242);
  doc.roundedRect(margin, y - 4, contentWidth, 12, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(3, 23, 25);
  doc.text('Total Amount', margin + 4, y + 3.5);
  doc.setTextColor(4, 120, 87);
  doc.text(formatETB(receipt.totalAmount), pageWidth - margin - 4, y + 3.5, { align: 'right' });
  y += 15;

  // Payment Method line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(82, 102, 100);
  doc.text('Payment Method:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  const methodDisplay = receipt.paymentReference
    ? `${receipt.paymentMethodLabel} (${receipt.paymentReference})`
    : receipt.paymentMethodLabel;
  doc.text(methodDisplay, pageWidth - margin, y, { align: 'right' });

  y += 14;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(4, 120, 87);
  doc.text('Thank you for shopping with Affin Connect!', pageWidth / 2, y, { align: 'center' });

  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFillColor(0, 200, 215);
  doc.rect(0, pageHeight - 4, pageWidth, 4, 'F');

  const safeRef = receipt.orderRef.replace(/[^A-Z0-9]/g, '') || 'ORDER';
  return {
    doc,
    fileName: `AffinConnect-Receipt-${safeRef}.pdf`,
    receipt,
  };
}

export function createReceiptPdfBlob(
  order: Order,
  shop?: Pick<Shop, 'name' | 'neighborhood' | 'address' | 'city'>
): { blob: Blob; fileName: string; receipt: FinancialReceiptData } {
  const { doc, fileName, receipt } = createReceiptPdfDocument(order, shop);
  return {
    blob: doc.output('blob'),
    fileName,
    receipt,
  };
}

export function downloadReceiptPdf(
  order: Order,
  shop?: Pick<Shop, 'name' | 'neighborhood' | 'address' | 'city'>
): string {
  const { blob, fileName } = createReceiptPdfBlob(order, shop);
  if (typeof document !== 'undefined' && typeof URL !== 'undefined') {
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  }
  return fileName;
}

export async function shareReceiptDocument(
  order: Order,
  shop?: Pick<Shop, 'name' | 'neighborhood' | 'address' | 'city'>
): Promise<'shared' | 'copied' | 'downloaded'> {
  const { blob, fileName, receipt } = createReceiptPdfBlob(order, shop);
  const summaryText = renderReceiptLinesText(receipt);

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file =
        typeof File !== 'undefined'
          ? new File([blob], fileName, { type: 'application/pdf' })
          : null;
      if (
        file &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: `Affin Connect Receipt ${receipt.orderRef}`,
          text: `Receipt ${receipt.receiptNumber} · ${formatETB(receipt.totalAmount)}`,
          files: [file],
        });
        return 'shared';
      }
      await navigator.share({
        title: `Affin Connect Receipt ${receipt.orderRef}`,
        text: summaryText,
      });
      return 'shared';
    } catch {
      // User dismissed share or share rejected; fall through cleanly
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(summaryText);
      return 'copied';
    } catch {
      // Fallback to direct PDF download
    }
  }

  downloadReceiptPdf(order, shop);
  return 'downloaded';
}
