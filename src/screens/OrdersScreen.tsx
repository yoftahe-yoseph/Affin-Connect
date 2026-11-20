import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  FileText,
  MessageSquare,
  Package,
  RotateCcw,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState, OrderStatusBadge, ResilientImage } from '../components/SharedUI';
import { OrderReceiptModal } from '../components/OrderReceiptModal';
import {
  canTransitionOrderStatus,
  formatETB,
  getItemReturnRequest,
  getNeighborhoodDeliveryEstimate,
  getTailwindWidthClass,
  getUserProductReview,
  isElectronicPaymentMethod,
  isOrderEligibleForReturn,
  MAX_RETURN_PHOTO_DATA_URL_LENGTH,
  RETURN_REASON_OPTIONS,
  validateReturnRequestInput,
} from '../utils/marketplaceLogic';
import { downloadReceiptPdf } from '../utils/receiptPdf';
import { getLocalizedNeighborhood } from '../constants/translations';
import type {
  Order,
  OrderItemSnapshot,
  OrderStatus,
  ReturnRequest,
  ReturnRequestReason,
  ReturnRequestStatus,
  ReturnRequestType,
} from '../types';

import {
  compressImageSourceToDataUrl,
  estimateDataUrlByteSize,
  formatImageByteSize,
  processUploadedPhotoFile,
} from '../utils/imageUpload';

function getOrderMilestoneIndex(status: OrderStatus): number {
  switch (status) {
    case 'pending':
      return 0;
    case 'accepted':
    case 'preparing':
      return 1;
    case 'out_for_delivery':
    case 'ready_for_pickup':
      return 2;
    case 'delivered':
      return 3;
    default:
      return -1;
  }
}

export const OrdersScreen: React.FC<{
  selectedOrderId?: string;
  initialTab?: 'active' | 'history';
}> = ({ selectedOrderId, initialTab }) => {
  const { navigate, orders, reviews, returnRequests, firebaseUser, updateOrderStatus, t } =
    useMarketplace();
  const currentUid = firebaseUser?.uid ?? 'guest-local';
  const [activeOrderId, setActiveOrderId] = useState<string | null>(selectedOrderId ?? null);
  const [tab, setTab] = useState<'active' | 'history'>(initialTab ?? 'active');

  useEffect(() => {
    setActiveOrderId(selectedOrderId ?? null);
  }, [selectedOrderId]);

  useEffect(() => {
    if (initialTab) {
      setTab(initialTab);
    }
  }, [initialTab]);

  const activeOrder = orders.find((o) => o.orderId === activeOrderId);

  if (activeOrder) {
    return (
      <OrderDetailView
        order={activeOrder}
        onBack={() => setActiveOrderId(null)}
        onCancel={() => updateOrderStatus(activeOrder.orderId, 'canceled')}
        onReviewProduct={(productId) => navigate({ name: 'product', productId })}
        getExistingRating={(productId) =>
          getUserProductReview(reviews, productId, currentUid)?.rating ?? null
        }
      />
    );
  }

  const activeOrders = orders.filter(
    (o) => !['delivered', 'rejected', 'canceled'].includes(o.orderStatus)
  );
  const historyOrders = orders.filter((o) =>
    ['delivered', 'rejected', 'canceled'].includes(o.orderStatus)
  );
  const shownOrders = tab === 'active' ? activeOrders : historyOrders;

  return (
    <div className="flex flex-col min-h-full bg-[#F3F6F4] dark:bg-transparent pb-6">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-4 pt-3 pb-2 space-y-3">
        <h1 className="text-base font-display font-bold text-[#0F4C44] dark:text-stone-100">{t('orders')}</h1>
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] rounded-xl">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'active'
                ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
            }`}
          >
            {t('activeCount', { count: activeOrders.length })}
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'history'
                ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
            }`}
          >
            {t('historyCount', { count: historyOrders.length })}
          </button>
        </div>
      </header>

      <div className="p-4 space-y-3">
        {shownOrders.length === 0 ? (
          <EmptyState
            icon={<Package className="w-6 h-6" />}
            title={tab === 'active' ? t('noActiveOrders') : t('noOrderHistory')}
            description={t('ordersEmptyDesc')}
            actionLabel={t('browseMarketplace')}
            onAction={() => navigate({ name: 'home' })}
          />
        ) : (
          shownOrders.map((order) => {
            const orderReturnCount = returnRequests.filter(
              (r) => r.orderId === order.orderId
            ).length;
            return (
              <button
                key={order.orderId}
                type="button"
                onClick={() => setActiveOrderId(order.orderId)}
                className="w-full bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none hover:shadow-md p-4 text-left space-y-2.5 hover:border-[#0F4C44]/40 dark:hover:border-[#10B981]/40 transition-all"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono font-bold text-[#0E2421] dark:text-stone-100">
                    #{order.orderId.slice(-6).toUpperCase()}
                  </span>
                  <OrderStatusBadge status={order.orderStatus} />
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-[#0F4C44] dark:text-[#10B981]">
                  <Store className="w-3.5 h-3.5 shrink-0" />
                  <span>{order.shopName}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-[#46635E] dark:text-stone-400 pt-2 border-t border-[#D2E0DC] dark:border-[#2A3630]">
                  <span>
                    {order.items.reduce((sum, i) => sum + i.quantity, 0)} items ·{' '}
                    {order.fulfillmentMethod === 'delivery' ? 'Delivery' : 'Shop Pickup'}
                    {orderReturnCount > 0 ? ` · ${orderReturnCount} ${t('requestReturnBtn')}` : ''}
                  </span>
                  <span className="font-bold text-[#0F4C44] dark:text-stone-100 tabular-nums">
                    {formatETB(order.totalAmount)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const RETURN_STATUS_LABEL_KEYS: Record<ReturnRequestStatus, string> = {
  requested: 'returnStatusRequested',
  approved: 'returnStatusApproved',
  rejected: 'returnStatusRejected',
  completed: 'returnStatusCompleted',
};

const OrderDetailView: React.FC<{
  order: Order;
  onBack: () => void;
  onCancel: () => void;
  onReviewProduct: (productId: string) => void;
  getExistingRating: (productId: string) => number | null;
}> = ({ order, onBack, onCancel, onReviewProduct, getExistingRating }) => {
  const {
    navigate,
    shopsById,
    reorderFromOrder,
    returnRequests,
    submitReturnRequest,
    verifyOrderPayment,
    openOrderChat,
    tradeChats,
    language,
    t,
  } = useMarketplace();
  const [receiptCopied, setReceiptCopied] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);
  const [returnTargetItem, setReturnTargetItem] = useState<OrderItemSnapshot | null>(null);
  const orderCode = order.orderId.slice(-6).toUpperCase();
  const linkedThread = tradeChats.find((th) => th.orderId === order.orderId);
  const linkedShop = shopsById[order.shopId];

  const milestoneSteps = [
    { key: 'placed', label: t('trackerStepPlaced') },
    { key: 'confirmed', label: t('trackerStepConfirmed') },
    {
      key: 'dispatch',
      label:
        order.fulfillmentMethod === 'delivery'
          ? t('trackerStepOutForDelivery')
          : t('trackerStepReadyForPickup'),
    },
    { key: 'delivered', label: t('trackerStepDelivered') },
  ];
  const currentMilestoneIdx = getOrderMilestoneIndex(order.orderStatus);
  const canCancel = canTransitionOrderStatus(order.orderStatus, 'canceled', 'customer').allowed;
  const isPurchaseEligible = isOrderEligibleForReturn(order);
  const isDelivered = order.orderStatus === 'delivered';
  const etaLabel =
    order.deliveryEtaLabel ||
    (order.fulfillmentMethod === 'delivery'
      ? getNeighborhoodDeliveryEstimate(order.neighborhood).label
      : t('pickupEtaLabel'));

  const firstReturnableItem = isPurchaseEligible
    ? order.items.find(
        (item) =>
          !getItemReturnRequest(
            returnRequests,
            order.orderId,
            item.productId,
            item.variantLabel
          )
      ) ?? null
    : null;

  const handleCopyReceipt = async () => {
    const lines = [
      `Hawasa Gebeya Receipt #${order.orderId.slice(-6).toUpperCase()}`,
      `Shop: ${order.shopName}`,
      `Date: ${new Date(order.createdAt).toLocaleString()}`,
      `Status: ${order.orderStatus.replace(/_/g, ' ')}`,
      '---',
      ...order.items.map(
        (i) =>
          `${i.quantity}x ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ''} - ${formatETB(
            i.price * i.quantity
          )}`
      ),
      '---',
      `Subtotal: ${formatETB(order.subtotal)}`,
      ...(order.promoDiscountAmount
        ? [`Promo (${order.promoCode ?? 'Promo'}): -${formatETB(order.promoDiscountAmount)}`]
        : order.discountAmount && !order.pointsDiscountAmount
          ? [`Discount (${order.promoCode ?? 'Promo'}): -${formatETB(order.discountAmount)}`]
          : []),
      ...(order.pointsDiscountAmount
        ? [`Loyalty Points (${order.pointsRedeemed ?? 0} pts): -${formatETB(order.pointsDiscountAmount)}`]
        : []),
      `Delivery: ${order.deliveryFee === 0 ? 'Free' : formatETB(order.deliveryFee)}`,
      `Total: ${formatETB(order.totalAmount)}`,
      ...(order.pointsEarned ? [`Rewards Earned: +${order.pointsEarned} pts`] : []),
    ];
    try {
      await navigator.clipboard?.writeText(lines.join('\n'));
    } catch {
      // Clipboard may be restricted in non-HTTPS or headless environments
    }
    setReceiptCopied(true);
    setTimeout(() => setReceiptCopied(false), 2000);
  };

  const handleReorder = () => {
    const res = reorderFromOrder(order);
    if (res.addedCount > 0) {
      navigate({ name: 'cart' });
    }
  };

  return (
    <div className="min-h-full bg-[#F3F6F4] dark:bg-transparent pb-8">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420] backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to orders"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-mono font-bold text-[#0F4C44] dark:text-stone-100">
          Order #{order.orderId.slice(-6).toUpperCase()}
        </span>
        <div className="w-11" />
      </header>

      <div className="p-4 space-y-4">
        {/* Live Order Tracking Milestone Stepper */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">
                {t('orderStatusTimeline')}
              </h2>
              <div className="text-[11px] text-[#047857] dark:text-[#10B981] font-medium mt-0.5">
                {t('deliveryEtaPrefix')}
                {order.neighborhood
                  ? ` (${getLocalizedNeighborhood(order.neighborhood, language)})`
                  : ''}
                : <span className="font-bold tabular-nums">{etaLabel}</span>
              </div>
            </div>
            <OrderStatusBadge status={order.orderStatus} />
          </div>

          {order.orderStatus === 'rejected' || order.orderStatus === 'canceled' ? (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">
                  {order.orderStatus === 'rejected' ? t('statusRejected') : t('statusCanceled')}
                </div>
                {order.rejectionReason && <p className="mt-0.5">{order.rejectionReason}</p>}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 pt-1" data-testid="order-milestone-tracker">
              <div className="w-full h-1.5 rounded-full bg-[#E7E5E4] dark:bg-[#2A3630] overflow-hidden">
                <div
                  className={`h-full bg-[#047857] dark:bg-[#10B981] rounded-full transition-all duration-300 ${getTailwindWidthClass(
                    Math.max(
                      12,
                      Math.round(((Math.max(0, currentMilestoneIdx) + 1) / milestoneSteps.length) * 100)
                    )
                  )}`}
                />
              </div>

              <div className="space-y-2.5 pt-1">
                {milestoneSteps.map((step, idx) => {
                  const completed = currentMilestoneIdx >= idx;
                  const isCurrent = currentMilestoneIdx === idx;
                  return (
                    <div key={step.key} className="flex items-center gap-3 text-xs">
                      {completed ? (
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            isCurrent
                              ? 'text-[#047857] dark:text-[#10B981]'
                              : 'text-[#047857]/75 dark:text-[#10B981]/75'
                          }`}
                        />
                      ) : (
                        <Clock className="w-4 h-4 text-stone-300 dark:text-stone-600 shrink-0" />
                      )}
                      <span
                        className={
                          completed
                            ? 'font-semibold text-stone-900 dark:text-stone-100'
                            : 'text-stone-400 dark:text-stone-500'
                        }
                      >
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {order.deliveryPin &&
            !['delivered', 'canceled', 'rejected'].includes(order.orderStatus) && (
              <div
                data-testid="order-delivery-pin"
                className="p-3 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-[#92400E] dark:text-[#F59E0B]">
                    {t('deliveryPinTitle')}
                  </div>
                  <p className="text-[11px] text-amber-900/80 dark:text-amber-300/90 mt-0.5 leading-snug">
                    {t('deliveryPinShareHint')}
                  </p>
                </div>
                <div className="px-3 py-1.5 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#FDE68A] dark:border-[#F59E0B]/40 font-mono text-base font-extrabold tracking-widest text-[#0E2421] dark:text-[#F59E0B] tabular-nums shrink-0">
                  {order.deliveryPin}
                </div>
              </div>
            )}
        </section>

        {/* Items Snapshot */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
          <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">
            {t('itemsFromShop', { shop: order.shopName })}
          </h2>
          <div className="divide-y divide-[#D2E0DC]/75 dark:divide-[#2A3630]">
            {order.items.map((item, idx) => {
              const existingRating = getExistingRating(item.productId);
              const itemReturn = getItemReturnRequest(
                returnRequests,
                order.orderId,
                item.productId,
                item.variantLabel
              );
              const reasonOption = itemReturn
                ? RETURN_REASON_OPTIONS.find((r) => r.value === itemReturn.reason)
                : null;

              return (
                <div
                  key={`${item.productId}-${item.variantLabel ?? idx}`}
                  className="py-2.5 space-y-2.5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] shrink-0">
                      <ResilientImage src={item.imageUrl} alt={item.name} fallbackTitle={item.name} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-[#0E2421] dark:text-stone-100 truncate">{item.name}</div>
                      {item.variantLabel && (
                        <div className="text-[11px] font-medium text-[#047857] dark:text-[#10B981]">
                          {item.variantLabel}
                        </div>
                      )}
                      <div className="text-[11px] text-[#46635E] dark:text-stone-400 tabular-nums">
                        Qty {item.quantity} × {formatETB(item.price)}
                      </div>
                    </div>
                    <div className="text-xs font-bold text-[#0F4C44] dark:text-stone-100 tabular-nums">
                      {formatETB(item.price * item.quantity)}
                    </div>
                  </div>

                  {itemReturn && (
                    <div className="p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] flex items-center justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-[#0E2421] dark:text-stone-100">
                          {itemReturn.requestType === 'exchange'
                            ? t('exchangeRequestedLabel')
                            : t('returnRequestedLabel')}{' '}
                          · {t(RETURN_STATUS_LABEL_KEYS[itemReturn.status])}
                        </div>
                        <div className="text-[11px] text-[#46635E] dark:text-stone-300 truncate mt-0.5">
                          {reasonOption ? t(reasonOption.labelKey) : itemReturn.reason}
                        </div>
                      </div>
                      {itemReturn.photoDataUrl && (
                        <img
                          src={itemReturn.photoDataUrl}
                          alt={t('returnPhotoAttached')}
                          className="w-10 h-10 rounded-lg object-cover border border-[#D2E0DC] dark:border-[#2A3630] shrink-0"
                        />
                      )}
                    </div>
                  )}

                  {isPurchaseEligible && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {!itemReturn && (
                        <button
                          type="button"
                          onClick={() => setReturnTargetItem(item)}
                          aria-label={`${t('requestReturnBtn')} - ${item.name}`}
                          className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#1C2420] hover:bg-[#FFFBEB] dark:hover:bg-[#F59E0B]/10 hover:border-[#FDE68A] dark:hover:border-[#F59E0B]/40 text-[11px] font-semibold text-[#0E2421] dark:text-stone-200 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
                          <span>{t('requestReturnBtn')}</span>
                        </button>
                      )}
                      {isDelivered && (
                        <button
                          type="button"
                          onClick={() => onReviewProduct(item.productId)}
                          className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#E5F2EE] dark:bg-[#141A17] hover:bg-[#D5EBE4] dark:hover:bg-[#10B981]/15 hover:border-[#0F4C44]/30 dark:hover:border-[#10B981]/40 text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] flex items-center gap-1.5 transition-colors whitespace-nowrap"
                        >
                          <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B] shrink-0" />
                          <span>
                            {existingRating != null
                              ? t('ratedEditBtn', { rating: existingRating })
                              : t('rateProductAndShopBtn')}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="pt-3 border-t border-[#E7E5E4] dark:border-[#2A3630] space-y-1 text-xs">
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>{t('subtotal')}</span>
              <span className="tabular-nums">{formatETB(order.subtotal)}</span>
            </div>
            {(order.promoDiscountAmount ?? (order.pointsDiscountAmount ? 0 : order.discountAmount ?? 0)) > 0 && (
              <div className="flex justify-between text-[#C2410C] dark:text-[#FB923C] font-medium">
                <span>
                  {t('discountLabel')}
                  {order.promoCode ? ` (${order.promoCode})` : ''}
                </span>
                <span className="tabular-nums">
                  -{formatETB(order.promoDiscountAmount ?? order.discountAmount ?? 0)}
                </span>
              </div>
            )}
            {order.pointsDiscountAmount != null && order.pointsDiscountAmount > 0 && (
              <div className="flex justify-between text-[#047857] dark:text-[#10B981] font-medium">
                <span>{t('loyaltyDiscountLine', { points: order.pointsRedeemed ?? 0 })}</span>
                <span className="tabular-nums">-{formatETB(order.pointsDiscountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-stone-600 dark:text-stone-400">
              <span>{t('deliveryFee')}</span>
              <span className="tabular-nums">
                {order.deliveryFee === 0 ? t('free') : formatETB(order.deliveryFee)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-stone-900 dark:text-stone-100 pt-1">
              <span>{t('total')}</span>
              <span className="tabular-nums text-[#047857] dark:text-[#10B981]">{formatETB(order.totalAmount)}</span>
            </div>
            {isPurchaseEligible && order.pointsEarned != null && order.pointsEarned > 0 && (
              <div className="flex justify-between text-[11px] font-semibold text-[#D97706] dark:text-[#F59E0B] pt-1">
                <span>{t('loyaltyEarnedLine')}</span>
                <span className="tabular-nums">+{t('loyaltyPointsShort', { points: order.pointsEarned })}</span>
              </div>
            )}
            {!isPurchaseEligible && order.pointsEarned != null && order.pointsEarned > 0 && (
              <div className="flex justify-between text-[11px] text-stone-500 dark:text-stone-400 pt-1">
                <span>{t('loyaltyTxReversed')}</span>
                <span className="tabular-nums">-{t('loyaltyPointsShort', { points: order.pointsEarned })}</span>
              </div>
            )}
          </div>
        </section>

        {/* Easy Returns Guarantee Card */}
        {isPurchaseEligible && (
          <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/15 text-[#D97706] dark:text-[#F59E0B] flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100">{t('easyReturnsTitle')}</div>
                <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                  {t('easyReturnsSubtitle')}
                </p>
              </div>
            </div>
            {firstReturnableItem && (
              <button
                type="button"
                onClick={() => setReturnTargetItem(firstReturnableItem)}
                className="min-h-[44px] px-3.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] hover:bg-[#FFFBEB] dark:hover:bg-[#F59E0B]/10 text-xs font-semibold text-[#0E2421] dark:text-stone-200 shrink-0 whitespace-nowrap transition-colors"
              >
                {t('requestReturnBtn')}
              </button>
            )}
          </section>
        )}

        {/* Fulfillment & Payment */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">{t('fulfillmentLabel')}</span>
            <span className="font-semibold capitalize text-stone-900 dark:text-stone-100">{order.fulfillmentMethod}</span>
          </div>
          {order.deliveryAddress && (
            <div className="flex justify-between gap-4">
              <span className="text-stone-500 dark:text-stone-400 shrink-0">{t('locationLabel')}</span>
              <span className="font-medium text-right text-stone-800 dark:text-stone-200">{order.deliveryAddress}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">{t('paymentMethod')}</span>
            <span className="font-medium capitalize text-stone-900 dark:text-stone-100">{order.paymentMethod.replace(/_/g, ' ')}</span>
          </div>
          {order.paymentReference && (
            <div className="flex justify-between">
              <span className="text-stone-500 dark:text-stone-400">{t('paymentReferenceLabel')}</span>
              <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                {order.paymentReference}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-stone-500 dark:text-stone-400">{t('paymentStatusLabel')}</span>
            <span
              className={`font-semibold capitalize ${
                order.paymentStatus === 'paid'
                  ? 'text-[#047857] dark:text-[#10B981]'
                  : order.paymentStatus === 'refunded'
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-[#D97706] dark:text-[#F59E0B]'
              }`}
            >
              {order.paymentStatus}
            </span>
          </div>
          {order.paymentStatus === 'pending' && isElectronicPaymentMethod(order.paymentMethod) && (
            <div className="pt-1.5 space-y-1.5">
              <button
                type="button"
                disabled={verifyingPayment}
                onClick={async () => {
                  setVerifyingPayment(true);
                  setVerifyNotice(null);
                  try {
                    const res = await verifyOrderPayment(order.orderId);
                    setVerifyNotice(
                      res.verifiedPaid
                        ? t('paymentVerifiedNowMsg')
                        : res.message || t('paymentStillPendingMsg')
                    );
                  } finally {
                    setVerifyingPayment(false);
                  }
                }}
                className="w-full min-h-[38px] px-3 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#047857]/30 dark:border-[#10B981]/35 text-[11px] font-bold text-[#047857] dark:text-[#10B981] hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                {verifyingPayment ? t('checkingPaymentStatus') : t('checkPaymentStatusBtn')}
              </button>
              {verifyNotice && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  {verifyNotice}
                </p>
              )}
            </div>
          )}
          {order.orderStatus !== 'canceled' && order.orderStatus !== 'rejected' && (
            <div className="pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630] flex items-center gap-2 text-[11px] font-semibold text-[#047857] dark:text-[#10B981]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                {order.orderStatus === 'delivered'
                  ? t('escrowReleasedOrderStatus')
                  : t('escrowActiveOrderStatus')}
              </span>
            </div>
          )}
        </section>

        {/* Buyer-Seller Order Chat Button */}
        <button
          type="button"
          onClick={() => openOrderChat(order)}
          className="w-full min-h-[46px] px-4 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/45 border border-[#047857]/30 dark:border-[#10B981]/40 hover:bg-[#D1FAE5] dark:hover:bg-[#064E3B]/65 text-[#047857] dark:text-[#34D399] text-xs font-extrabold flex items-center justify-between gap-2 transition-colors"
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 shrink-0" />
            <span>
              {t('tradeChatMessageSellerBtn')} · #{orderCode}
            </span>
          </span>
          {linkedThread && linkedThread.supervisionStatus !== 'none' && (
            <span className="px-2 py-0.5 rounded-lg bg-[#FEF3C7] dark:bg-[#78350F]/50 text-[#92400E] dark:text-[#FCD34D] text-[10px] font-bold">
              {linkedThread.supervisionStatus === 'active'
                ? t('supervisionBadgeActive')
                : linkedThread.supervisionStatus === 'resolved'
                ? t('supervisionBadgeResolved')
                : t('supervisionBadgeRequested')}
            </span>
          )}
        </button>

        {/* Receipt Actions: View Official Receipt + Download PDF */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            data-testid="order-view-receipt-btn"
            onClick={() => setReceiptModalOpen(true)}
            className="min-h-[44px] px-3 rounded-xl border border-[#047857]/35 dark:border-[#10B981]/40 bg-[#ECFDF5] dark:bg-[#10B981]/15 hover:opacity-90 text-[#047857] dark:text-[#10B981] text-xs font-bold flex items-center justify-center gap-1.5 transition-opacity"
          >
            <FileText className="w-3.5 h-3.5 shrink-0" />
            <span>{t('viewReceiptBtn')}</span>
          </button>

          <button
            type="button"
            data-testid="order-download-pdf-btn"
            onClick={() => downloadReceiptPdf(order, linkedShop)}
            className="min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-[#00D68F] to-[#00C8D7] hover:brightness-105 text-[#031719] text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5 shrink-0" />
            <span>{t('downloadPdfBtn')}</span>
          </button>
        </div>

        {/* Quick Actions: Reorder + Copy Receipt */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleReorder}
            className="min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('reorderItems')}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyReceipt}
            className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] text-[#0E2421] dark:text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
          >
            {receiptCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                <span className="text-[#047857] dark:text-[#10B981]">{t('receiptCopied')}</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>{t('copyReceipt')}</span>
              </>
            )}
          </button>
        </div>

        {canCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="w-full min-h-[44px] rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          >
            {t('cancelOrder')}
          </button>
        )}
      </div>

      {receiptModalOpen && (
        <OrderReceiptModal
          order={order}
          shop={linkedShop}
          onClose={() => setReceiptModalOpen(false)}
        />
      )}

      {returnTargetItem && (
        <EasyReturnModal
          order={order}
          item={returnTargetItem}
          onClose={() => setReturnTargetItem(null)}
          onSubmit={async (payload): Promise<ReturnRequest> => {
            const created = await submitReturnRequest({
              orderId: order.orderId,
              productId: returnTargetItem.productId,
              variantLabel: returnTargetItem.variantLabel,
              ...payload,
            });
            setReturnTargetItem(null);
            return created;
          }}
        />
      )}
    </div>
  );
};

const EasyReturnModal: React.FC<{
  order: Order;
  item: OrderItemSnapshot;
  onClose: () => void;
  onSubmit: (payload: {
    requestType: ReturnRequestType;
    reason: ReturnRequestReason;
    details: string;
    photoDataUrl?: string;
  }) => Promise<ReturnRequest>;
}> = ({ order, item, onClose, onSubmit }) => {
  const { t } = useMarketplace();
  const [requestType, setRequestType] = useState<ReturnRequestType>('return');
  const [reason, setReason] = useState<ReturnRequestReason>('damaged_item');
  const [details, setDetails] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  const handleOpenCamera = async () => {
    setCameraError(null);
    setSubmitError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError(t('returnCameraUnavailable'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch {
      setCameraError(t('returnCameraUnavailable'));
    }
  };

  const handleCaptureCameraFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;
      const captured = compressImageSourceToDataUrl(video, width, height);
      setPhotoDataUrl(captured);
      setSubmitError(null);
      stopCameraStream();
    } catch {
      setCameraError(t('returnCameraUnavailable'));
      stopCameraStream();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);
    setSubmitError(null);
    try {
      const processed = await processUploadedPhotoFile(file);
      setPhotoDataUrl(processed);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not load photo.');
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errs = validateReturnRequestInput({
      requestType,
      reason,
      details,
      photoDataUrl,
    });
    const firstErrKey = Object.values(errs)[0];
    if (firstErrKey) {
      setSubmitError(t(firstErrKey));
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        requestType,
        reason,
        details: details.trim(),
        photoDataUrl,
      });
      stopCameraStream();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not submit return request.');
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="easy-return-modal-title"
      className="fixed inset-0 z-50 bg-stone-950/50 dark:bg-black/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
    >
      <div className="w-full max-w-md bg-[#FCFDFC] dark:bg-[#1C2420] rounded-t-3xl sm:rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] p-4 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="easy-return-modal-title"
            className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100"
          >
            {t('returnModalTitle')}
          </h2>
          <button
            type="button"
            onClick={() => {
              stopCameraStream();
              onClose();
            }}
            aria-label="Close"
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#46635E] dark:text-stone-400 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Order Item Snapshot */}
        <div className="p-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden bg-[#E5EEEC] dark:bg-[#1C2420] shrink-0">
            <ResilientImage src={item.imageUrl} alt={item.name} fallbackTitle={item.name} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100 truncate">{item.name}</div>
            <div className="text-[11px] text-[#46635E] dark:text-stone-400 truncate mt-0.5 tabular-nums">
              {order.shopName} · #{order.orderId.slice(-6).toUpperCase()}
              {item.variantLabel ? ` · ${item.variantLabel}` : ''}
            </div>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-3.5">
          {/* Request Type Selector */}
          <div className="space-y-1.5">
            <span className="block text-[11px] font-semibold text-[#0E2421] dark:text-stone-300">
              {t('returnTypeLabel')}
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] rounded-xl">
              <button
                type="button"
                onClick={() => setRequestType('return')}
                className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  requestType === 'return'
                    ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                    : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
                }`}
              >
                {t('returnTypeRefund')}
              </button>
              <button
                type="button"
                onClick={() => setRequestType('exchange')}
                className={`min-h-[44px] px-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  requestType === 'exchange'
                    ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-xs'
                    : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
                }`}
              >
                {t('returnTypeExchange')}
              </button>
            </div>
          </div>

          {/* Reason Selector */}
          <div className="space-y-1.5">
            <label
              htmlFor="return-reason-select"
              className="block text-[11px] font-semibold text-[#0E2421] dark:text-stone-300"
            >
              {t('returnReasonLabel')}
            </label>
            <select
              id="return-reason-select"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReturnRequestReason)}
              className="w-full min-h-[44px] px-3 py-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
            >
              {RETURN_REASON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100">
                  {t(opt.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Camera & Photo Upload for Proof of Damage */}
          <div className="space-y-2">
            <div>
              <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                {t('returnPhotoLabel')}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">{t('returnPhotoHint')}</p>
            </div>

            {cameraOpen ? (
              <div className="space-y-2">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-48 object-cover rounded-xl bg-stone-900 border border-[#E7E5E4] dark:border-[#2A3630]"
                />
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureCameraFrame}
                    className="min-h-[44px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Camera className="w-4 h-4 shrink-0" />
                    <span>{t('returnCapturePhoto')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={stopCameraStream}
                    className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-xs font-semibold text-[#0E2421] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] transition-colors"
                  >
                    {t('returnCancelCamera')}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleOpenCamera}
                  className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] hover:bg-[#E5F2EE] dark:hover:bg-[#10B981]/10 text-xs font-semibold text-[#0E2421] dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Camera className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                  <span>{t('returnTakePhotoCamera')}</span>
                </button>

                <label className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] hover:bg-[#E5F2EE] dark:hover:bg-[#1C2420] text-xs font-semibold text-[#0E2421] dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap">
                  <Upload className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                  <span>{t('returnUploadPhoto')}</span>
                  <input
                    id="return-photo-input"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>
            )}

            {cameraError && (
              <p className="text-[11px] text-[#92400E] dark:text-[#F59E0B] bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 rounded-xl px-3 py-2">
                {cameraError}
              </p>
            )}

            {photoDataUrl && (
              <div className="p-2.5 rounded-xl border border-[#0F4C44]/30 dark:border-[#10B981]/30 bg-[#E5F2EE]/60 dark:bg-[#10B981]/10 space-y-2">
                <img
                  src={photoDataUrl}
                  alt={t('returnPhotoAttached')}
                  className="w-full max-h-40 object-cover rounded-lg border border-[#D2E0DC] dark:border-[#2A3630]"
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>{t('returnPhotoAttached')}</span>
                    </span>
                    <div className="text-[10px] text-[#46635E] dark:text-stone-400 tabular-nums mt-0.5">
                      {t('imageSizeLimitHint', {
                        size: formatImageByteSize(estimateDataUrlByteSize(photoDataUrl)),
                      })}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl(undefined)}
                    className="min-h-[44px] px-2.5 rounded-lg text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('returnRemovePhoto')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Issue Details */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label
                htmlFor="return-details-input"
                className="text-[11px] font-semibold text-[#0E2421] dark:text-stone-300"
              >
                {t('returnDetailsLabel')}
              </label>
              <span className="text-[11px] text-[#5E7B76] dark:text-stone-500 tabular-nums">
                {details.trim().length}/600
              </span>
            </div>
            <textarea
              id="return-details-input"
              rows={3}
              maxLength={600}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder={t('returnDetailsPlaceholder')}
              className="w-full p-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981] resize-none"
            />
          </div>

          {submitError && (
            <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">{submitError}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:bg-stone-300 dark:disabled:bg-[#2A3630] dark:disabled:text-stone-500 text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold transition-all"
          >
            {t('returnSubmitBtn')}
          </button>
        </form>
      </div>
    </div>
  );
};
