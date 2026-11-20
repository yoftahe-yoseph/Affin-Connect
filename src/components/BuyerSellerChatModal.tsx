import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  MessageSquare,
  Package,
  Send,
  ShieldAlert,
  ShieldCheck,
  Store,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { ResilientImage } from './SharedUI';
import { formatETB } from '../utils/marketplaceLogic';
import type { ChatSupervisionStatus, TradeChatThread } from '../types';

function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function SupervisionStatusTag({ status }: { status: ChatSupervisionStatus }) {
  const { t } = useMarketplace();
  if (status === 'none') return null;

  if (status === 'requested') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#FEF3C7] dark:bg-[#78350F]/40 border border-[#F59E0B]/40 px-2 py-0.5 text-[11px] font-bold text-[#92400E] dark:text-[#FCD34D]">
        <ShieldAlert size={12} />
        {t('supervisionBadgeRequested')}
      </span>
    );
  }
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#D1FAE5] dark:bg-[#064E3B]/50 border border-[#10B981]/40 px-2 py-0.5 text-[11px] font-bold text-[#065F46] dark:text-[#34D399]">
        <ShieldCheck size={12} />
        {t('supervisionBadgeActive')}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F5F5F4] dark:bg-[#232D28] border border-[#E7E5E4] dark:border-[#2A3630] px-2 py-0.5 text-[11px] font-semibold text-[#57534E] dark:text-[#A8B5AE]">
      <CheckCircle2 size={12} />
      {t('supervisionBadgeResolved')}
    </span>
  );
}

export const BuyerSellerChatModal: React.FC = () => {
  const {
    t,
    firebaseUser,
    userProfile,
    activeRoleView,
    shopsById,
    tradeChats,
    tradeChatModalOpen,
    activeTradeChatThreadId,
    setActiveTradeChatThreadId,
    activeTradeChatThread,
    tradeChatMessages,
    closeTradeChatModal,
    sendTradeChatMessage,
    requestAdminSupervision,
  } = useMarketplace();

  const [inboxFilter, setInboxFilter] = useState<'all' | 'orders' | 'supervised'>('all');
  const [draftBody, setDraftBody] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [showSupervisionForm, setShowSupervisionForm] = useState(false);
  const [supervisionReason, setSupervisionReason] = useState('');
  const [escalating, setEscalating] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setChatError(null);
    setShowSupervisionForm(false);
    setSupervisionReason('');
  }, [activeTradeChatThreadId, tradeChatModalOpen]);

  useEffect(() => {
    if (tradeChatModalOpen && activeTradeChatThread) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [tradeChatModalOpen, activeTradeChatThread, tradeChatMessages.length]);

  const filteredThreads = useMemo(() => {
    return tradeChats.filter((th) => {
      if (inboxFilter === 'orders') return th.threadType === 'order';
      if (inboxFilter === 'supervised') return th.supervisionStatus !== 'none';
      return true;
    });
  }, [tradeChats, inboxFilter]);

  if (!tradeChatModalOpen) return null;

  const currentUid = firebaseUser?.uid || userProfile?.uid || '';

  const resolveIsSellerSide = (thread: TradeChatThread): boolean => {
    if (currentUid && currentUid === thread.sellerUid) return true;
    if (currentUid && currentUid === thread.buyerUid) return false;
    return activeRoleView === 'seller';
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTradeChatThread || sending) return;
    setChatError(null);
    setSending(true);
    try {
      const roleHint = resolveIsSellerSide(activeTradeChatThread) ? 'seller' : 'buyer';
      await sendTradeChatMessage(activeTradeChatThread.threadId, draftBody, roleHint);
      setDraftBody('');
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Unable to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleEscalateSupervision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTradeChatThread || escalating) return;
    setChatError(null);
    setEscalating(true);
    try {
      await requestAdminSupervision(activeTradeChatThread.threadId, supervisionReason);
      setShowSupervisionForm(false);
      setSupervisionReason('');
    } catch (err) {
      setChatError(
        err instanceof Error ? err.message : 'Unable to submit admin supervision request.'
      );
    } finally {
      setEscalating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('tradeChatInboxTitle')}
    >
      <div className="w-full sm:max-w-lg h-[90dvh] sm:h-[82dvh] max-h-[760px] bg-[#F3F6F4] dark:bg-[#141A17] text-[#0E2421] dark:text-[#F3F5F4] rounded-t-3xl sm:rounded-3xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-[#FCFDFC] dark:bg-[#1C2420] border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {activeTradeChatThread ? (
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => setActiveTradeChatThreadId(null)}
                  className="min-w-[40px] min-h-[40px] -ml-1 rounded-xl flex items-center justify-center hover:bg-[#EBF1EE] dark:hover:bg-[#232D28] text-[#0F4C44] dark:text-[#F3F5F4] transition-colors shrink-0"
                  aria-label={t('tradeChatInboxTitle')}
                >
                  <ArrowLeft size={20} />
                </button>
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#E5F2EE] dark:bg-[#064E3B]/40 border border-[#D2E0DC] dark:border-[#2A3630] text-[#0F4C44] dark:text-[#10B981] flex items-center justify-center shrink-0">
                  {shopsById[activeTradeChatThread.shopId]?.logoUrl ? (
                    <ResilientImage
                      src={shopsById[activeTradeChatThread.shopId].logoUrl}
                      alt={activeTradeChatThread.shopName}
                      fallbackTitle={activeTradeChatThread.shopName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Store size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm font-extrabold text-[#0F4C44] dark:text-[#F3F5F4] truncate">
                      {activeTradeChatThread.orderCode
                        ? t('tradeChatOrderBadge', { code: activeTradeChatThread.orderCode })
                        : activeTradeChatThread.shopName}
                    </h2>
                    {typeof activeTradeChatThread.orderTotalEtb === 'number' && (
                      <span className="text-xs font-bold tabular-nums text-[#047857] dark:text-[#10B981]">
                        {formatETB(activeTradeChatThread.orderTotalEtb)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#46635E] dark:text-[#A8B5AE] truncate">
                    {activeTradeChatThread.shopName} · {activeTradeChatThread.buyerName}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl bg-[#E5F2EE] dark:bg-[#064E3B]/40 text-[#0F4C44] dark:text-[#10B981] flex items-center justify-center shrink-0">
                  <MessageSquare size={20} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-extrabold text-[#0F4C44] dark:text-[#F3F5F4] truncate">{t('tradeChatInboxTitle')}</h2>
                  <p className="text-xs text-[#46635E] dark:text-[#A8B5AE] truncate">
                    {t('tradeChatInboxSubtitle')}
                  </p>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={closeTradeChatModal}
            className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center hover:bg-[#EBF1EE] dark:hover:bg-[#232D28] text-[#46635E] dark:text-[#A8B5AE] transition-colors shrink-0"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Inbox List Mode */}
        {!activeTradeChatThread ? (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-4 py-2.5 bg-[#FCFDFC]/90 dark:bg-[#1C2420]/70 border-b border-[#D2E0DC] dark:border-[#2A3630] flex items-center gap-2 overflow-x-auto">
              {(
                [
                  { id: 'all', label: t('adminUsersFilterAll') },
                  { id: 'orders', label: t('orders') },
                  { id: 'supervised', label: t('adminSupervisionTab') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setInboxFilter(tab.id)}
                  className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    inboxFilter === tab.id
                      ? 'bg-[#0F4C44] text-[#FCFDFC]'
                      : 'bg-[#F3F6F4] dark:bg-[#232D28] text-[#46635E] dark:text-[#A8B5AE] border border-[#D2E0DC] dark:border-transparent hover:bg-[#EBF1EE] dark:hover:bg-[#2A3630]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filteredThreads.length === 0 ? (
                <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center space-y-2 mt-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#E5F2EE] dark:bg-[#064E3B]/40 text-[#0F4C44] dark:text-[#10B981] flex items-center justify-center mx-auto">
                    <MessageSquare size={22} />
                  </div>
                  <p className="text-sm font-bold text-[#0F4C44] dark:text-[#F3F5F4]">{t('tradeChatNoThreads')}</p>
                  <p className="text-xs text-[#46635E] dark:text-[#A8B5AE]">
                    {t('tradeChatStartFromOrderHint')}
                  </p>
                </div>
              ) : (
                filteredThreads.map((thread) => (
                  <button
                    key={thread.threadId}
                    type="button"
                    onClick={() => setActiveTradeChatThreadId(thread.threadId)}
                    className="w-full text-left bg-[#FCFDFC] dark:bg-[#1C2420] hover:border-[#0F4C44] dark:hover:border-[#10B981] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5 transition-colors flex items-start gap-3 min-h-[72px]"
                  >
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#E5F2EE] dark:bg-[#064E3B]/40 border border-[#D2E0DC] dark:border-[#2A3630] text-[#0F4C44] dark:text-[#10B981] flex items-center justify-center shrink-0 mt-0.5">
                      {shopsById[thread.shopId]?.logoUrl ? (
                        <ResilientImage
                          src={shopsById[thread.shopId].logoUrl}
                          alt={thread.shopName}
                          fallbackTitle={thread.shopName}
                          className="w-full h-full object-cover"
                        />
                      ) : thread.threadType === 'order' ? (
                        <Package size={18} />
                      ) : (
                        <Store size={18} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-extrabold text-[#0E2421] dark:text-[#F3F5F4] truncate">
                          {thread.orderCode
                            ? `${t('tradeChatOrderBadge', { code: thread.orderCode })} · ${thread.shopName}`
                            : thread.shopName}
                        </span>
                        <span className="text-[11px] text-[#5E7B76] dark:text-[#9CA3AF] tabular-nums shrink-0">
                          {formatShortTime(thread.lastMessageAt || thread.updatedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[#46635E] dark:text-[#A8B5AE] truncate">
                        {thread.lastMessage || t('tradeChatEmptyMessages')}
                      </p>
                      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                        <span className="text-[11px] font-semibold text-[#5E7B76] dark:text-[#A8B5AE]">
                          {thread.buyerName} ↔ {thread.shopName}
                        </span>
                        <SupervisionStatusTag status={thread.supervisionStatus} />
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Active Conversation Thread Mode */
          <div className="flex-1 flex flex-col min-h-0">
            {/* Supervision Controls Bar */}
            <div className="px-4 py-2.5 bg-[#FFFBEB] dark:bg-[#1E1B12] border-b border-[#F59E0B]/30 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {activeTradeChatThread.supervisionStatus === 'none' ? (
                  <>
                    <div className="flex items-center gap-2 text-xs text-[#78350F] dark:text-[#FDE68A]">
                      <ShieldAlert size={15} className="shrink-0 text-[#D97706]" />
                      <span className="font-semibold">Escrow & Mediation Support</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowSupervisionForm((v) => !v)}
                      className="min-h-[40px] px-3 rounded-xl bg-[#D97706] hover:bg-[#B45309] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <ShieldAlert size={14} />
                      {t('requestSupervisionBtn')}
                    </button>
                  </>
                ) : (
                  <div className="w-full flex items-center justify-between gap-2 flex-wrap">
                    <SupervisionStatusTag status={activeTradeChatThread.supervisionStatus} />
                    {activeTradeChatThread.supervisionStatus === 'resolved' && (
                      <button
                        type="button"
                        onClick={() => setShowSupervisionForm((v) => !v)}
                        className="min-h-[36px] px-3 rounded-xl border border-[#D97706]/50 text-[#92400E] dark:text-[#FCD34D] text-xs font-bold hover:bg-[#FEF3C7]/60 dark:hover:bg-[#78350F]/30"
                      >
                        {t('requestSupervisionBtn')}
                      </button>
                    )}
                    {activeTradeChatThread.assignedAdminName && (
                      <span className="text-[11px] font-semibold text-[#065F46] dark:text-[#34D399]">
                        {activeTradeChatThread.assignedAdminName}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {activeTradeChatThread.supervisionReason &&
                activeTradeChatThread.supervisionStatus !== 'none' && (
                  <p className="text-xs text-[#78350F] dark:text-[#FDE68A] bg-[#FCFDFC]/85 dark:bg-[#141A17]/60 rounded-xl px-3 py-1.5 border border-[#F59E0B]/30">
                    “{activeTradeChatThread.supervisionReason}”
                  </p>
                )}

              {showSupervisionForm && (
                <form
                  onSubmit={handleEscalateSupervision}
                  className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#F59E0B]/40 p-3 space-y-2.5"
                >
                  <p className="text-xs font-extrabold text-[#0E2421] dark:text-[#F3F5F4]">
                    {t('supervisionModalTitle')}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      t('supervisionReasonPreset1'),
                      t('supervisionReasonPreset2'),
                      t('supervisionReasonPreset3'),
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSupervisionReason(preset)}
                        className="min-h-[36px] px-2.5 rounded-lg bg-[#F3F6F4] dark:bg-[#232D28] border border-[#D2E0DC] dark:border-[#2A3630] text-[11px] font-semibold hover:border-[#D97706] text-left"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <textarea
                    rows={2}
                    value={supervisionReason}
                    onChange={(e) => setSupervisionReason(e.target.value)}
                    placeholder={t('supervisionReasonPlaceholder')}
                    maxLength={300}
                    className="w-full rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#D97706]"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowSupervisionForm(false)}
                      className="min-h-[40px] px-3 rounded-xl text-xs font-bold text-[#46635E] dark:text-[#A8B5AE] hover:bg-[#EBF1EE] dark:hover:bg-[#232D28]"
                    >
                      {t('cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={escalating}
                      className="min-h-[40px] px-4 rounded-xl bg-[#D97706] hover:bg-[#B45309] disabled:opacity-60 text-white text-xs font-bold inline-flex items-center gap-1.5"
                    >
                      <ShieldAlert size={14} />
                      {t('supervisionSubmitBtn')}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {tradeChatMessages.length === 0 ? (
                <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] p-5 text-center space-y-1.5 mt-4">
                  <p className="text-xs font-semibold text-[#46635E] dark:text-[#A8B5AE]">
                    {t('tradeChatEmptyMessages')}
                  </p>
                </div>
              ) : (
                tradeChatMessages.map((msg) => {
                  const isOwn =
                    currentUid
                      ? msg.senderUid === currentUid && msg.senderRole !== 'system'
                      : msg.senderRole === (activeRoleView === 'seller' ? 'seller' : 'buyer');

                  if (msg.senderRole === 'system') {
                    return (
                      <div key={msg.messageId} className="flex justify-center">
                        <div className="max-w-[92%] rounded-xl bg-[#FEF3C7]/70 dark:bg-[#78350F]/30 border border-[#F59E0B]/40 px-3.5 py-2 text-center space-y-0.5">
                          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#92400E] dark:text-[#FCD34D]">
                            <AlertTriangle size={12} />
                            <span>{msg.senderName}</span>
                          </div>
                          <p className="text-xs text-[#451A03] dark:text-[#FEF3C7] leading-relaxed">
                            {msg.body}
                          </p>
                          <p className="text-[10px] text-[#92400E]/80 dark:text-[#FCD34D]/70 tabular-nums">
                            {formatShortTime(msg.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (msg.senderRole === 'admin') {
                    return (
                      <div key={msg.messageId} className="flex justify-center">
                        <div className="w-full max-w-[92%] rounded-2xl bg-[#ECFDF5] dark:bg-[#064E3B]/45 border border-[#10B981]/50 px-4 py-3 space-y-1 shadow-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#047857] dark:text-[#34D399]">
                              <ShieldCheck size={14} />
                              {t('supervisionMediatorLabel')} · {msg.senderName}
                            </span>
                            <span className="text-[10px] text-[#065F46]/80 dark:text-[#6EE7B7]/80 tabular-nums">
                              {formatShortTime(msg.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm text-[#1C1917] dark:text-[#F3F5F4] leading-relaxed whitespace-pre-wrap">
                            {msg.body}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.messageId}
                      className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}
                    >
                      <span className="text-[11px] font-semibold text-[#78716C] dark:text-[#A8B5AE] mb-1 px-1">
                        {msg.senderName} ·{' '}
                        {msg.senderRole === 'seller' ? t('sellerRoleLabel') : t('customerRoleLabel')}
                      </span>
                      <div
                        className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                          isOwn
                            ? 'bg-gradient-to-r from-[#0F4C44] to-[#047857] text-[#FCFDFC] rounded-br-md shadow-[0_2px_8px_-2px_rgba(15,76,68,0.25)] dark:shadow-none'
                            : 'bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-[#0E2421] dark:text-[#F3F5F4] rounded-bl-md shadow-[0_2px_8px_-3px_rgba(15,76,68,0.08)] dark:shadow-none'
                        }`}
                      >
                        <p>{msg.body}</p>
                        <p
                          className={`text-[10px] mt-1 tabular-nums text-right ${
                            isOwn ? 'text-emerald-100/90' : 'text-[#5E7B76] dark:text-[#A8B5AE]'
                          }`}
                        >
                          {formatShortTime(msg.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {chatError && (
              <div className="px-4 py-2 bg-[#FEF2F2] dark:bg-[#450A0A]/50 border-t border-[#FECACA] dark:border-[#7F1D1D] text-xs font-semibold text-[#B91C1C] dark:text-[#FCA5A5]">
                {chatError}
              </div>
            )}

            {/* Message Input */}
            <form
              onSubmit={handleSend}
              className="p-3 bg-[#FCFDFC] dark:bg-[#1C2420] border-t border-[#D2E0DC] dark:border-[#2A3630] flex items-center gap-2 shrink-0"
            >
              <input
                type="text"
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                placeholder={t('tradeChatInputPlaceholder')}
                maxLength={1000}
                className="flex-1 min-h-[44px] rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] px-3.5 text-sm text-[#0E2421] dark:text-[#F3F5F4] placeholder:text-[#5E7B76] focus:outline-none focus:ring-2 focus:ring-[#0F4C44]"
              />
              <button
                type="submit"
                disabled={sending || !draftBody.trim()}
                className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 disabled:opacity-50 text-[#FCFDFC] text-sm font-bold inline-flex items-center gap-1.5 transition-all shrink-0 shadow-[0_2px_8px_-2px_rgba(15,76,68,0.28)] dark:shadow-none"
              >
                <Send size={16} />
                <span className="hidden sm:inline">{t('tradeChatSendBtn')}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
