import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Download,
  RotateCcw,
  Share2,
  Store,
} from 'lucide-react';
import { BRAND_ASSETS } from '../data/seedData';
import { useMarketplace } from '../context/MarketplaceContext';
import type { Order, Shop } from '../types';
import { buildFinancialReceiptData, formatETB } from '../utils/marketplaceLogic';
import { downloadReceiptPdf, shareReceiptDocument } from '../utils/receiptPdf';
import { ResilientImage } from './SharedUI';

interface OrderReceiptModalProps {
  order: Order;
  shop?: Shop;
  onClose: () => void;
}

export const OrderReceiptModal: React.FC<OrderReceiptModalProps> = ({
  order,
  shop,
  onClose,
}) => {
  const { t } = useMarketplace();
  const [feedback, setFeedback] = useState<string | null>(null);
  const receipt = buildFinancialReceiptData(order, shop);

  const handleDownloadPdf = () => {
    downloadReceiptPdf(order, shop);
    setFeedback(t('receiptDownloadedFeedback'));
    setTimeout(() => setFeedback(null), 2600);
  };

  const handleShare = async () => {
    const outcome = await shareReceiptDocument(order, shop);
    if (outcome === 'shared') {
      setFeedback(t('receiptSharedFeedback'));
    } else if (outcome === 'copied') {
      setFeedback(t('receiptCopiedFeedback'));
    } else {
      setFeedback(t('receiptDownloadedFeedback'));
    }
    setTimeout(() => setFeedback(null), 2600);
  };

  const renderMethodBadge = () => {
    switch (receipt.paymentMethod) {
      case 'telebirr':
      case 'telebirr_sandbox':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
            <span className="px-1.5 py-0.5 rounded bg-[#0284C7] text-white text-[10px] font-extrabold">
              TB
            </span>
            <span>{receipt.paymentMethodLabel}</span>
          </span>
        );
      case 'cbe_birr':
      case 'cbe_birr_sandbox':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
            <span className="px-1.5 py-0.5 rounded bg-[#6D28D9] text-white text-[10px] font-extrabold">
              CBE
            </span>
            <span>{receipt.paymentMethodLabel}</span>
          </span>
        );
      case 'chapa':
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-900">
            <span className="px-1.5 py-0.5 rounded bg-[#047857] text-white text-[10px] font-extrabold">
              CHAPA
            </span>
            <span>{receipt.paymentMethodLabel}</span>
          </span>
        );
      default:
        return <span className="font-bold text-slate-900">{receipt.paymentMethodLabel}</span>;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-receipt-modal-title"
      data-testid="order-receipt-modal"
      className="fixed inset-0 z-50 bg-[#F3F6F4] dark:bg-[#031719] flex flex-col max-w-md mx-auto"
    >
      {/* Top Bar */}
      <header className="px-3 py-2.5 flex items-center justify-between border-b border-[#D2E0DC] dark:border-[#14443F] bg-[#FCFDFC]/95 dark:bg-[#031719]/95 shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none shrink-0">
        <button
          type="button"
          onClick={onClose}
          aria-label={t('close')}
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-[#F5FAFA] hover:bg-[#EBF1EE] dark:hover:bg-[#092825] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1
          id="order-receipt-modal-title"
          className="text-sm font-display font-bold text-[#0F4C44] dark:text-[#F5FAFA]"
        >
          {t('receiptTitle')}
        </h1>
        <button
          type="button"
          onClick={handleShare}
          aria-label={t('shareReceiptBtn')}
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-[#F5FAFA] hover:bg-[#EBF1EE] dark:hover:bg-[#092825] transition-colors"
        >
          <Share2 className="w-4 h-4" />
        </button>
      </header>

      {/* Scrollable Receipt Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {feedback && (
          <div className="px-3 py-2 rounded-xl bg-[#E5F2EE] dark:bg-[#00D68F]/15 border border-[#0F4C44]/30 dark:border-[#00D68F]/40 text-[#0F4C44] dark:text-[#00D68F] text-xs font-semibold text-center">
            {feedback}
          </div>
        )}

        <article className="rounded-2xl bg-[#FCFDFC] text-slate-900 shadow-[0_8px_24px_-8px_rgba(15,76,68,0.18)] dark:shadow-2xl overflow-hidden border border-[#D2E0DC]">
          <div className="p-4 space-y-3.5">
            {/* Brand Header */}
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <img
                src={BRAND_ASSETS.logo}
                alt="Affin Connect"
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-xl object-cover border border-emerald-500/25 shrink-0"
              />
              <div>
                <div className="text-base font-display font-extrabold tracking-tight text-slate-900 leading-none">
                  Affin <span className="text-[#00A870]">Connect</span>
                </div>
                <div className="text-[10px] text-slate-500 font-medium mt-0.5">
                  {t('checkoutTagline')}
                </div>
              </div>
            </div>

            {/* Truthful Status Banner */}
            {receipt.bannerTone === 'paid' ? (
              <div
                data-testid="receipt-status-banner"
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] text-[#031719] flex items-center justify-center gap-2 text-xs font-extrabold shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t('receiptStatusSuccessful')}</span>
              </div>
            ) : receipt.bannerTone === 'refunded' ? (
              <div
                data-testid="receipt-status-banner"
                className="w-full py-2 px-3 rounded-xl bg-rose-100 border border-rose-200 text-rose-800 flex items-center justify-center gap-2 text-xs font-bold"
              >
                <RotateCcw className="w-4 h-4 shrink-0" />
                <span>{t('receiptStatusRefunded')}</span>
              </div>
            ) : (
              <div
                data-testid="receipt-status-banner"
                className="w-full py-2 px-3 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center gap-2 text-xs font-bold"
              >
                <Clock className="w-4 h-4 shrink-0" />
                <span>{t('receiptStatusPending')}</span>
              </div>
            )}

            {/* Receipt Metadata */}
            <div className="space-y-1.5 text-xs pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">{t('receiptNoLabel')}</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {receipt.receiptNumber}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">{t('orderRefShortLabel')}</span>
                <span className="font-mono font-bold text-slate-900 tabular-nums">
                  {receipt.orderRef}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500">{t('dateTimeLabel')}</span>
                <span className="font-semibold text-slate-800 tabular-nums text-right">
                  {receipt.issuedAtDisplay}
                </span>
              </div>
            </div>

            {/* Merchant Details */}
            <div className="pt-2.5 border-t border-slate-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <Store className="w-3.5 h-3.5 text-[#047857] shrink-0" />
                <span>{t('merchantDetailsTitle')}</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <Store className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 truncate">{receipt.merchantName}</div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {receipt.merchantLocation}
                  </div>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="pt-2.5 border-t border-slate-200 space-y-2">
              <div className="grid grid-cols-[1fr_auto_auto] gap-2 text-[11px] font-bold text-slate-500">
                <span>{t('receiptItemsCol')}</span>
                <span className="text-right w-10">{t('receiptQtyCol')}</span>
                <span className="text-right min-w-[74px]">{t('receiptPriceCol')}</span>
              </div>
              <div className="space-y-2">
                {receipt.items.map((item, idx) => (
                  <div
                    key={`${item.name}-${idx}`}
                    className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                        <ResilientImage
                          src={item.imageUrl || BRAND_ASSETS.coffee}
                          alt={item.name}
                          fallbackTitle={item.name}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 truncate">{item.name}</div>
                        {item.variantLabel && (
                          <div className="text-[10px] text-slate-500 truncate">
                            {item.variantLabel}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-right w-10 font-medium text-slate-700 tabular-nums">
                      {item.quantity}
                    </span>
                    <span className="text-right min-w-[74px] font-bold text-slate-900 tabular-nums">
                      {formatETB(item.lineTotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="pt-2.5 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>{t('subtotal')}</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {formatETB(receipt.subtotal)}
                </span>
              </div>
              {receipt.promoDiscountAmount > 0 && (
                <div className="flex justify-between text-[#047857] font-semibold">
                  <span>
                    {t('discountLabel')}
                    {receipt.promoCode ? ` (${receipt.promoCode})` : ''}
                  </span>
                  <span className="tabular-nums">-{formatETB(receipt.promoDiscountAmount)}</span>
                </div>
              )}
              {receipt.loyaltyDiscountAmount > 0 && (
                <div className="flex justify-between text-[#047857] font-semibold">
                  <span>{t('loyaltyDiscountLine', { points: receipt.pointsRedeemed })}</span>
                  <span className="tabular-nums">-{formatETB(receipt.loyaltyDiscountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>{t('deliveryFee')}</span>
                <span className="font-bold text-slate-900 tabular-nums">
                  {receipt.deliveryFee === 0 ? t('free') : formatETB(receipt.deliveryFee)}
                </span>
              </div>

              <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900">
                  {t('receiptTotalAmountLabel')}
                </span>
                <span className="text-base font-display font-extrabold text-[#047857] tabular-nums">
                  {formatETB(receipt.totalAmount)}
                </span>
              </div>
            </div>

            {/* Payment Method & Ref */}
            <div className="pt-1 flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-600 font-medium">{t('paymentMethod')}:</span>
              <div className="text-right">
                {renderMethodBadge()}
                {receipt.paymentReference && (
                  <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                    {receipt.paymentReference}
                  </div>
                )}
              </div>
            </div>

            <p className="text-center text-[11px] font-bold italic text-[#047857] pt-1">
              {t('receiptThankYou')}
            </p>
          </div>

          <div className="h-2 w-full bg-gradient-to-r from-[#00D68F] to-[#00C8D7]" />
        </article>
      </div>

      {/* Bottom Sticky Action Bar */}
      <footer className="px-4 py-3 bg-[#FCFDFC]/95 dark:bg-[#031719]/95 border-t border-[#D2E0DC] dark:border-[#14443F] grid grid-cols-2 gap-2.5 shrink-0">
        <button
          type="button"
          onClick={handleShare}
          className="min-h-[46px] px-3 rounded-xl bg-[#F3F6F4] dark:bg-[#092825] border border-[#D2E0DC] dark:border-[#14443F] hover:border-[#0F4C44]/50 dark:hover:border-[#00D68F]/50 text-[#0E2421] dark:text-[#F5FAFA] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Share2 className="w-4 h-4 text-[#0F4C44] dark:text-[#00D68F]" />
          <span>{t('shareReceiptBtn')}</span>
        </button>

        <button
          type="button"
          data-testid="receipt-download-pdf-btn"
          onClick={handleDownloadPdf}
          className="min-h-[46px] px-3 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 text-[#FCFDFC] dark:text-[#031719] text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-[#0F4C44]/15 dark:shadow-[#00D68F]/20 transition-all"
        >
          <Download className="w-4 h-4" />
          <span>{t('downloadPdfBtn')}</span>
        </button>
      </footer>
    </div>
  );
};
