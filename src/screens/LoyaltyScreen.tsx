import React from 'react';
import { ArrowLeft, ArrowRight, Award, ChevronRight, ShoppingBag } from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { EmptyState } from '../components/SharedUI';
import { formatETB, getLoyaltyTier, LOYALTY_ETB_PER_POINT_REDEEMED } from '../utils/marketplaceLogic';
import type { LoyaltyTransactionType } from '../types';

export const LoyaltyScreen: React.FC = () => {
  const {
    goBack,
    navigate,
    cart,
    loyaltyBalance,
    lifetimeLoyaltyPoints,
    totalRedeemedLoyaltyPoints,
    loyaltyTransactions,
    t,
  } = useMarketplace();

  const tierInfo = getLoyaltyTier(lifetimeLoyaltyPoints);
  const tierLabel =
    tierInfo.tier === 'vip'
      ? t('loyaltyTierVip')
      : tierInfo.tier === 'regular'
        ? t('loyaltyTierRegular')
        : t('loyaltyTierStarter');

  const tierBaseline = tierInfo.tier === 'regular' ? 150 : 0;
  const tierProgressPct =
    tierInfo.nextTierPoints === null
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            Math.round(
              ((lifetimeLoyaltyPoints - tierBaseline) /
                Math.max(1, tierInfo.nextTierPoints - tierBaseline)) *
                100
            )
          )
        );
  const remainingToNext =
    tierInfo.nextTierPoints === null
      ? 0
      : Math.max(0, tierInfo.nextTierPoints - lifetimeLoyaltyPoints);

  const getTransactionLabel = (type: LoyaltyTransactionType): string => {
    switch (type) {
      case 'earned':
        return t('loyaltyTxEarned');
      case 'redeemed':
        return t('loyaltyTxRedeemed');
      case 'refunded':
        return t('loyaltyTxRefunded');
      case 'reversed':
        return t('loyaltyTxReversed');
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-8">
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-700 dark:text-stone-200 hover:bg-[#FAF8F5] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-sm font-display font-bold text-stone-900 dark:text-stone-100 truncate">
          {t('loyaltyTitle')}
        </h1>
        <div className="w-11" />
      </header>

      <div className="p-4 space-y-4">
        {/* Points Balance Card */}
        <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#D97706] dark:text-[#F59E0B]">
                <Award className="w-4 h-4 shrink-0" />
                <span>{tierLabel}</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-2">
                <span className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                  {loyaltyBalance.toLocaleString('en-US')}
                </span>
                <span className="text-xs font-semibold text-stone-500 dark:text-stone-400">
                  {t('loyaltyAvailableBalance')}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-300 mt-1">
                {t('loyaltyWorthEtb', {
                  amount: formatETB(loyaltyBalance * LOYALTY_ETB_PER_POINT_REDEEMED),
                })}
              </p>
            </div>
          </div>

          {/* Tier Progress */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-stone-600 dark:text-stone-300">
              <span>
                {tierInfo.nextTierPoints === null
                  ? t('loyaltyTopTierHint')
                  : t('loyaltyNextTierHint', { remaining: remainingToNext })}
              </span>
              <span className="tabular-nums font-semibold text-[#047857] dark:text-[#10B981]">
                {tierProgressPct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-[#E7E5E4] dark:bg-[#2A3630] overflow-hidden">
              <div
                className="h-full bg-[#047857] dark:bg-[#10B981] rounded-full transition-all duration-300"
                style={{ width: `${tierProgressPct}%` }}
              />
            </div>
          </div>

          {/* Lifetime & Redeemed Metrics */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#E7E5E4] dark:border-[#2A3630]">
            <div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">{t('loyaltyLifetimeEarned')}</div>
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                {t('loyaltyPointsShort', { points: lifetimeLoyaltyPoints })}
              </div>
            </div>
            <div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400">{t('loyaltyTotalRedeemed')}</div>
              <div className="text-sm font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                {t('loyaltyPointsShort', { points: totalRedeemedLoyaltyPoints })}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate(cart.length > 0 ? { name: 'cart' } : { name: 'home' })}
            className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{cart.length > 0 ? t('viewCart') : t('loyaltyShopNow')}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </section>

        {/* Program Rules */}
        <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-2">
          <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">{t('loyaltyHowItWorks')}</h2>
          <div className="space-y-1.5 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
            <p>1. {t('loyaltyRuleEarn')}</p>
            <p>2. {t('loyaltyRuleRedeem')}</p>
          </div>
        </section>

        {/* Points Activity Ledger */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">{t('loyaltyHistoryTitle')}</h2>
            <span className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
              {loyaltyTransactions.length}
            </span>
          </div>

          {loyaltyTransactions.length === 0 ? (
            <EmptyState
              icon={<Award className="w-6 h-6" />}
              title={t('loyaltyNoActivity')}
              description={t('loyaltyNoActivityDesc')}
              actionLabel={t('loyaltyShopNow')}
              onAction={() => navigate({ name: 'home' })}
            />
          ) : (
            <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm divide-y divide-[#E7E5E4]/80 dark:divide-[#2A3630] overflow-hidden">
              {loyaltyTransactions.map((tx) => {
                const isCredit = tx.points > 0;
                const formattedPoints = `${isCredit ? '+' : ''}${tx.points}`;
                return (
                  <button
                    key={tx.transactionId}
                    type="button"
                    onClick={() => navigate({ name: 'orders', selectedOrderId: tx.orderId })}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left hover:bg-[#FAF8F5] dark:hover:bg-[#141A17] transition-colors min-h-[56px]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {getTransactionLabel(tx.type)}
                      </div>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 flex flex-wrap items-center gap-1.5">
                        <span className="truncate max-w-[140px]">{tx.shopName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">#{tx.orderId.slice(-6).toUpperCase()}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(tx.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          isCredit ? 'text-[#047857] dark:text-[#10B981]' : 'text-stone-900 dark:text-stone-200'
                        }`}
                      >
                        {t('loyaltyPointsShort', { points: formattedPoints })}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
