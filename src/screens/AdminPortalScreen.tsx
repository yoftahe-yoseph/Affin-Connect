import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Ban,
  Check,
  CheckCircle2,
  ClipboardList,
  Coffee,
  Crown,
  DollarSign,
  Eye,
  FileCheck2,
  Flag,
  FolderPlus,
  Loader2,
  Lock,
  Mail,
  MessageSquare,
  MessageSquareWarning,
  Package,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Star,
  Store,
  Trash2,
  Unlock,
  UserCheck,
  UserPlus,
  Users,
  UserX,
  X,
  XCircle,
} from 'lucide-react';
import { useMarketplace, type AdminTabId } from '../context/MarketplaceContext';
import {
  filterAdminUsers,
  formatETB,
  isSuperAdminEmail,
  planCoffeeProductMigration,
  type AdminUserRoleFilter,
} from '../utils/marketplaceLogic';
import type {
  AccountStatus,
  AdminAuditTargetType,
  OrderStatus,
  PaymentStatus,
  ReturnRequestStatus,
  UserProfile,
  UserRole,
} from '../types';

type PendingEnforcementAction =
  | {
      kind: 'suspend_shop' | 'delete_shop';
      title: string;
      subtitle: string;
      confirmLabel: string;
      tone: 'danger' | 'warn';
      requiresReason: boolean;
      placeholder: string;
      onConfirm: (reason: string) => Promise<void>;
    }
  | {
      kind: 'flag_product' | 'archive_product' | 'freeze_stock' | 'delete_product';
      title: string;
      subtitle: string;
      confirmLabel: string;
      tone: 'danger' | 'warn';
      requiresReason: boolean;
      placeholder: string;
      onConfirm: (reason: string) => Promise<void>;
    }
  | {
      kind: 'order_action';
      title: string;
      subtitle: string;
      confirmLabel: string;
      tone: 'danger' | 'primary';
      requiresReason: boolean;
      placeholder: string;
      onConfirm: (reason: string) => Promise<void>;
    }
  | {
      kind: 'resolve_return';
      title: string;
      subtitle: string;
      confirmLabel: string;
      tone: 'danger' | 'primary';
      requiresReason: boolean;
      placeholder: string;
      onConfirm: (reason: string) => Promise<void>;
    }
  | {
      kind: 'user_action';
      title: string;
      subtitle: string;
      confirmLabel: string;
      tone: 'danger' | 'warn' | 'primary';
      requiresReason: boolean;
      placeholder: string;
      onConfirm: (reason: string) => Promise<void>;
    }
  | {
      kind: 'delete_review';
      title: string;
      subtitle: string;
      confirmLabel: string;
      tone: 'danger';
      requiresReason: boolean;
      placeholder: string;
      onConfirm: (reason: string) => Promise<void>;
    };

export const AdminPortalScreen: React.FC<{
  tab?: AdminTabId;
}> = ({ tab = 'overview' }) => {
  const {
    isCloudAdmin,
    firebaseUser,
    shops,
    products,
    categories,
    reviews,
    adminUsers,
    adminOrders,
    adminReturnRequests,
    adminAuditLogs,
    merchantVerifications,
    governanceConfig,
    moderateShopGovernance,
    deleteShopAsAdmin,
    adminReviewMerchantVerification,
    moderateProductGovernance,
    deleteProductAsAdmin,
    runCoffeeMigrationAsAdmin,
    adminForceOrderAction,
    adminResolveReturnRequest,
    adminUpdateUserAccount,
    adminGrantRoleByEmail,
    adminDeleteReview,
    updateGovernanceConfig,
    saveCategory,
    tradeChats,
    adminSupervisedThreadId,
    setAdminSupervisedThreadId,
    adminSupervisedMessages,
    supervisionAttentionCount,
    adminJoinChatMediation,
    adminSendMediatorMessage,
    adminResolveChatSupervision,
    t,
  } = useMarketplace();

  const [activeTab, setActiveTab] = useState<AdminTabId>(tab);
  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  // Filters & search state
  const [shopSearch, setShopSearch] = useState('');
  const [shopStatusFilter, setShopStatusFilter] = useState<'all' | 'pending' | 'approved' | 'suspended'>('all');

  const [verificationSearch, setVerificationSearch] = useState('');
  const [verificationFilter, setVerificationFilter] = useState<
    'all' | 'pending_review' | 'approved' | 'rejected'
  >('pending_review');
  const [inspectingDocUrl, setInspectingDocUrl] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
  } | null>(null);

  const [productSearch, setProductSearch] = useState('');
  const [productStatusFilter, setProductStatusFilter] = useState<'all' | 'active' | 'pending_review' | 'archived'>('all');
  const [coffeeSyncRunning, setCoffeeSyncRunning] = useState(false);
  const [coffeeSyncSummary, setCoffeeSyncSummary] = useState<string | null>(null);

  const [ordersSubTab, setOrdersSubTab] = useState<'orders' | 'returns'>('orders');
  const [orderStatusFilter, setOrderStatusFilter] = useState<'all' | OrderStatus>('all');
  const [returnStatusFilter, setReturnStatusFilter] = useState<'all' | ReturnRequestStatus>('all');

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<AdminUserRoleFilter>('all');
  const [grantEmail, setGrantEmail] = useState('');
  const [grantRoleTarget, setGrantRoleTarget] = useState<UserRole>('admin');
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantFeedback, setGrantFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [updatingUserUid, setUpdatingUserUid] = useState<string | null>(null);
  const [reviewSearch, setReviewSearch] = useState('');
  const [auditTypeFilter, setAuditTypeFilter] = useState<'all' | AdminAuditTargetType>('all');
  const [supervisionFilter, setSupervisionFilter] = useState<
    'attention' | 'requested' | 'active' | 'resolved' | 'all'
  >('attention');
  const [supervisionSearch, setSupervisionSearch] = useState('');
  const [mediatorReply, setMediatorReply] = useState('');
  const [resolutionNoteInput, setResolutionNoteInput] = useState('');
  const [mediatingSubmitting, setMediatingSubmitting] = useState(false);
  const [mediationError, setMediationError] = useState<string | null>(null);

  // Category creation form
  const [newCatName, setNewCatName] = useState('');
  const [newCatAm, setNewCatAm] = useState('');
  const [newCatOm, setNewCatOm] = useState('');
  const [newCatSid, setNewCatSid] = useState('');

  // Governance Policy Form
  const [feeInput, setFeeInput] = useState(String(governanceConfig.deliveryFeeEtb));
  const [thresholdInput, setThresholdInput] = useState(String(governanceConfig.freeDeliveryThresholdEtb));
  const [maxOrderInput, setMaxOrderInput] = useState(String(governanceConfig.maxOrderAmountEtb));
  const [orderingPaused, setOrderingPaused] = useState(governanceConfig.orderingPaused);
  const [strictVerification, setStrictVerification] = useState(governanceConfig.strictShopVerification);
  const [maintenanceBanner, setMaintenanceBanner] = useState(governanceConfig.maintenanceBanner ?? '');
  const [policyReason, setPolicyReason] = useState('');
  const [policySaved, setPolicySaved] = useState(false);

  useEffect(() => {
    setFeeInput(String(governanceConfig.deliveryFeeEtb));
    setThresholdInput(String(governanceConfig.freeDeliveryThresholdEtb));
    setMaxOrderInput(String(governanceConfig.maxOrderAmountEtb));
    setOrderingPaused(governanceConfig.orderingPaused);
    setStrictVerification(governanceConfig.strictShopVerification);
    setMaintenanceBanner(governanceConfig.maintenanceBanner ?? '');
  }, [governanceConfig]);

  // Enforcement Modal State
  const [pendingAction, setPendingAction] = useState<PendingEnforcementAction | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const notifyAction = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 2600);
  };

  const openEnforcementModal = (action: PendingEnforcementAction) => {
    setPendingAction(action);
    setActionReason('');
    setActionError(null);
  };

  const handleConfirmEnforcement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingAction) return;
    const trimmed = actionReason.trim();
    if (pendingAction.requiresReason && trimmed.length < 4) {
      setActionError('Please enter an administrative reason (at least 4 characters).');
      return;
    }
    setActionSubmitting(true);
    setActionError(null);
    try {
      await pendingAction.onConfirm(trimmed);
      setPendingAction(null);
      setActionReason('');
      notifyAction('Governance action recorded.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to complete admin action.');
    } finally {
      setActionSubmitting(false);
    }
  };

  // Overview KPIs
  const pendingShopsCount = shops.filter((s) => s.status === 'pending').length;
  const suspendedShopsCount = shops.filter((s) => s.status === 'suspended').length;
  const pendingVerificationsCount = merchantVerifications.filter(
    (v) => v.status === 'pending_review'
  ).length;
  const flaggedProductsCount = products.filter((p) => p.status === 'pending_review').length;
  const openReturnsCount = adminReturnRequests.filter(
    (r) => r.status === 'requested' || r.status === 'approved'
  ).length;
  const activeOrdersCount = adminOrders.filter(
    (o) => o.orderStatus !== 'delivered' && o.orderStatus !== 'canceled' && o.orderStatus !== 'rejected'
  ).length;
  const suspendedUsersCount = adminUsers.filter((u) => u.accountStatus === 'suspended').length;
  const totalGmv = adminOrders
    .filter((o) => o.orderStatus !== 'canceled' && o.orderStatus !== 'rejected')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const filteredShops = useMemo(() => {
    const q = shopSearch.trim().toLowerCase();
    return shops.filter((s) => {
      if (shopStatusFilter !== 'all' && s.status !== shopStatusFilter) return false;
      if (q && !`${s.name} ${s.neighborhood} ${s.phoneNumber}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [shops, shopSearch, shopStatusFilter]);

  const filteredVerifications = useMemo(() => {
    const q = verificationSearch.trim().toLowerCase();
    return merchantVerifications.filter((v) => {
      if (verificationFilter !== 'all' && v.status !== verificationFilter) return false;
      if (
        q &&
        !`${v.shopName} ${v.businessLegalName} ${v.licenseNumber} ${v.tinNumber ?? ''} ${v.issuingAuthority}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [merchantVerifications, verificationSearch, verificationFilter]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => {
      if (productStatusFilter !== 'all' && p.status !== productStatusFilter) return false;
      if (q && !`${p.name} ${p.shopName} ${p.category}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, productSearch, productStatusFilter]);

  const coffeeMigrationPreview = useMemo(
    () => planCoffeeProductMigration(products),
    [products]
  );

  const filteredOrders = useMemo(() => {
    return adminOrders.filter((o) => {
      if (orderStatusFilter !== 'all' && o.orderStatus !== orderStatusFilter) return false;
      return true;
    });
  }, [adminOrders, orderStatusFilter]);

  const filteredReturns = useMemo(() => {
    return adminReturnRequests.filter((r) => {
      if (returnStatusFilter !== 'all' && r.status !== returnStatusFilter) return false;
      return true;
    });
  }, [adminReturnRequests, returnStatusFilter]);

  const filteredUsers = useMemo(
    () => filterAdminUsers(adminUsers, userSearch, userRoleFilter),
    [adminUsers, userSearch, userRoleFilter]
  );

  const userRoleCounts = useMemo(() => {
    return {
      all: adminUsers.length,
      admin: adminUsers.filter((u) => u.role === 'admin').length,
      seller: adminUsers.filter((u) => u.role === 'seller').length,
      customer: adminUsers.filter((u) => u.role === 'customer').length,
    };
  }, [adminUsers]);

  const handleGrantRoleByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setGrantFeedback(null);
    setGrantSubmitting(true);
    try {
      const res = await adminGrantRoleByEmail({
        email: grantEmail,
        role: grantRoleTarget,
      });
      if (!res.ok) {
        setGrantFeedback({ type: 'err', text: res.error || t('adminGrantEmailNotFound') });
        return;
      }
      const msg = t('adminRoleUpdatedToast', {
        name: res.user?.displayName || res.user?.email || grantEmail.trim(),
        role: grantRoleTarget,
      });
      setGrantFeedback({ type: 'ok', text: msg });
      setGrantEmail('');
      notifyAction(msg);
    } catch (err) {
      setGrantFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to update user role.',
      });
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleQuickRoleSwitch = async (usr: UserProfile, nextRole: UserRole) => {
    if (usr.role === nextRole) return;
    const isSelf = firebaseUser?.uid === usr.uid;
    if (isSelf && nextRole !== 'admin') {
      notifyAction(t('adminCannotDemoteSelf'));
      return;
    }
    if (isSuperAdminEmail(usr.email) && nextRole !== 'admin') {
      notifyAction(t('adminCannotDemoteOwner'));
      return;
    }
    setUpdatingUserUid(usr.uid);
    try {
      await adminUpdateUserAccount({
        uid: usr.uid,
        role: nextRole,
        reason: `Role updated from ${usr.role} to ${nextRole} via Users & Role Access manager`,
      });
      notifyAction(
        t('adminRoleUpdatedToast', {
          name: usr.displayName || usr.email || usr.uid,
          role: nextRole,
        })
      );
    } catch (err) {
      notifyAction(err instanceof Error ? err.message : 'Could not update role.');
    } finally {
      setUpdatingUserUid(null);
    }
  };

  const handleQuickStatusToggle = async (usr: UserProfile) => {
    const isSelf = firebaseUser?.uid === usr.uid;
    if (isSelf || isSuperAdminEmail(usr.email)) return;
    const nextStatus: AccountStatus = usr.accountStatus === 'suspended' ? 'active' : 'suspended';
    setUpdatingUserUid(usr.uid);
    try {
      await adminUpdateUserAccount({
        uid: usr.uid,
        accountStatus: nextStatus,
        reason:
          nextStatus === 'suspended'
            ? 'Account suspended via Users & Role Access manager'
            : 'Account reinstated via Users & Role Access manager',
      });
      notifyAction(`${usr.displayName || usr.email || usr.uid} → ${nextStatus}`);
    } catch (err) {
      notifyAction(err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setUpdatingUserUid(null);
    }
  };

  const filteredReviews = useMemo(() => {
    const q = reviewSearch.trim().toLowerCase();
    return reviews.filter((r) => {
      if (q && !`${r.customerName} ${r.comment} ${r.productId}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reviews, reviewSearch]);

  const filteredAuditLogs = useMemo(() => {
    return adminAuditLogs.filter((log) => {
      if (auditTypeFilter !== 'all' && log.targetType !== auditTypeFilter) return false;
      return true;
    });
  }, [adminAuditLogs, auditTypeFilter]);

  const filteredSupervisionChats = useMemo(() => {
    const q = supervisionSearch.trim().toLowerCase();
    return tradeChats.filter((th) => {
      if (supervisionFilter === 'attention') {
        if (th.supervisionStatus !== 'requested' && th.supervisionStatus !== 'active') {
          return false;
        }
      } else if (supervisionFilter !== 'all' && th.supervisionStatus !== supervisionFilter) {
        return false;
      }
      if (q) {
        const hay = `${th.orderCode ?? ''} ${th.orderId ?? ''} ${th.shopName} ${th.buyerName} ${
          th.supervisionReason ?? ''
        } ${th.lastMessage}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tradeChats, supervisionFilter, supervisionSearch]);

  const selectedSupervisedThread = useMemo(
    () =>
      tradeChats.find((th) => th.threadId === adminSupervisedThreadId) ??
      filteredSupervisionChats[0] ??
      null,
    [tradeChats, adminSupervisedThreadId, filteredSupervisionChats]
  );

  useEffect(() => {
    if (activeTab === 'supervision' && selectedSupervisedThread) {
      if (adminSupervisedThreadId !== selectedSupervisedThread.threadId) {
        setAdminSupervisedThreadId(selectedSupervisedThread.threadId);
      }
    }
  }, [activeTab, selectedSupervisedThread, adminSupervisedThreadId, setAdminSupervisedThreadId]);

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const slug = newCatName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    await saveCategory({
      slug,
      name: newCatName.trim(),
      nameAm: newCatAm.trim() || newCatName.trim(),
      nameOm: newCatOm.trim() || newCatName.trim(),
      nameSid: newCatSid.trim() || newCatName.trim(),
      iconName: 'Package',
      displayOrder: categories.length + 1,
      isActive: true,
    });
    setNewCatName('');
    setNewCatAm('');
    setNewCatOm('');
    setNewCatSid('');
    notifyAction('Category saved.');
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedFee = Math.max(0, Math.round(Number(feeInput) || 0));
    const parsedThreshold = Math.max(0, Math.round(Number(thresholdInput) || 0));
    const parsedMaxOrder = Math.max(100, Math.round(Number(maxOrderInput) || 100));

    await updateGovernanceConfig(
      {
        deliveryFeeEtb: parsedFee,
        freeDeliveryThresholdEtb: parsedThreshold,
        maxOrderAmountEtb: parsedMaxOrder,
        orderingPaused,
        strictShopVerification: strictVerification,
        maintenanceBanner: maintenanceBanner.trim(),
      },
      policyReason.trim() || 'Updated marketplace governance policy'
    );
    setPolicyReason('');
    setPolicySaved(true);
    notifyAction('Governance policy updated.');
    setTimeout(() => setPolicySaved(false), 2000);
  };

  const tabs: { id: AdminTabId; label: string; count?: number }[] = [
    { id: 'overview', label: t('adminGovernanceOverview') },
    { id: 'shops', label: t('shopLabel'), count: pendingShopsCount > 0 ? pendingShopsCount : undefined },
    {
      id: 'verifications',
      label: t('docVerifyAdminTab'),
      count: pendingVerificationsCount > 0 ? pendingVerificationsCount : undefined,
    },
    { id: 'products', label: t('productsManagement'), count: flaggedProductsCount > 0 ? flaggedProductsCount : undefined },
    { id: 'orders', label: t('adminOrdersTab'), count: openReturnsCount > 0 ? openReturnsCount : undefined },
    {
      id: 'supervision',
      label: t('adminSupervisionTab'),
      count: supervisionAttentionCount > 0 ? supervisionAttentionCount : undefined,
    },
    { id: 'users', label: t('adminUsersAccessTab'), count: adminUsers.length > 0 ? adminUsers.length : undefined },
    { id: 'reviews', label: t('adminReviewsTab') },
    { id: 'categories', label: t('categories') },
    { id: 'config', label: t('adminPolicyTab') },
    { id: 'audit', label: t('adminAuditTab') },
  ];

  return (
    <div className="pb-10">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 backdrop-blur-md dark:bg-[#1C2420] border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-5 h-5 text-[#0F4C44] dark:text-[#F59E0B] shrink-0" />
            <div className="min-w-0">
              <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100 truncate">
                {t('adminTitle')}
              </h1>
              <div className="text-[10px] text-[#46635E] dark:text-stone-400 truncate">
                {isCloudAdmin ? 'Cloud Governance Active' : 'Local Governance Preview'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shrink-0 transition-colors ${
              governanceConfig.orderingPaused
                ? 'bg-rose-600 text-white'
                : 'bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/20 dark:border-transparent text-[#0F4C44] dark:text-[#10B981]'
            }`}
          >
            {governanceConfig.orderingPaused ? 'Ordering Paused' : 'Market Live'}
          </button>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] rounded-xl text-[11px] font-semibold">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                activeTab === item.id
                  ? 'bg-[#0F4C44] dark:bg-[#10B981]/15 text-[#FCFDFC] dark:text-[#10B981] shadow-[0_2px_8px_-3px_rgba(15,76,68,0.28)] dark:shadow-xs'
                  : 'text-[#46635E] dark:text-stone-400 hover:text-[#0E2421] dark:hover:text-stone-100'
              }`}
            >
              <span>{item.label}</span>
              {item.count != null && item.count > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-[#D97706] dark:bg-[#F59E0B] text-white dark:text-[#141A17] text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {feedbackToast && (
          <div className="p-3 rounded-xl bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{feedbackToast}</span>
          </div>
        )}

        {!isCloudAdmin && (
          <div className="p-3 rounded-2xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 text-[11px] text-[#92400E] dark:text-[#FCD34D] flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
            <span>
              {firebaseUser
                ? 'Signed-in account does not hold cloud admin privileges. Changes apply locally.'
                : 'Preview mode active. Sign in with the admin account to enforce changes across live Firestore rules.'}
            </span>
          </div>
        )}

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Gross Volume</div>
                <div className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                  {formatETB(totalGmv)}
                </div>
                <div className="text-[11px] text-[#047857] dark:text-[#10B981] tabular-nums mt-1">
                  {activeOrdersCount} active orders
                </div>
              </div>

              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Merchants</div>
                <div className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                  {shops.length} shops
                </div>
                <div className="text-[11px] text-[#D97706] dark:text-[#F59E0B] tabular-nums mt-1">
                  {pendingShopsCount} pending · {suspendedShopsCount} suspended
                </div>
              </div>

              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Returns & Disputes</div>
                <div className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                  {openReturnsCount} open
                </div>
                <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums mt-1">
                  {adminReturnRequests.length} total claims
                </div>
              </div>

              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Accounts & Risk</div>
                <div className="text-base font-bold text-stone-900 dark:text-stone-100 tabular-nums mt-0.5">
                  {adminUsers.length} users
                </div>
                <div className="text-[11px] text-rose-700 dark:text-rose-400 tabular-nums mt-1">
                  {suspendedUsersCount} suspended · {flaggedProductsCount} flagged items
                </div>
              </div>
            </div>

            {/* Emergency Kill-Switch Shortcut */}
            <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Emergency Marketplace Control
                  </h2>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Immediately pause all new customer checkouts across Hawassa or enforce strict shop verification.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void updateGovernanceConfig(
                      { orderingPaused: !governanceConfig.orderingPaused },
                      governanceConfig.orderingPaused
                        ? 'Resumed marketplace checkout'
                        : 'Emergency pause activated from overview'
                    ).then(() => notifyAction(governanceConfig.orderingPaused ? 'Ordering resumed.' : 'Ordering paused.'))
                  }
                  className={`min-h-[44px] px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    governanceConfig.orderingPaused
                      ? 'bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410]'
                      : 'bg-rose-600 hover:bg-rose-700 text-white'
                  }`}
                >
                  {governanceConfig.orderingPaused ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{governanceConfig.orderingPaused ? 'Resume Checkout' : 'Pause Ordering'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void updateGovernanceConfig(
                      { strictShopVerification: !governanceConfig.strictShopVerification },
                      'Toggled strict shop verification'
                    ).then(() => notifyAction('Verification policy updated.'))
                  }
                  className="min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-xs font-semibold text-stone-800 dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                  <span>{governanceConfig.strictShopVerification ? 'Strict Verify: ON' : 'Strict Verify: OFF'}</span>
                </button>
              </div>
            </section>

            {/* Priority Governance Queues */}
            <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none divide-y divide-[#D2E0DC]/70 dark:divide-[#2A3630]">
              <div className="px-4 py-3 text-xs font-bold text-stone-900 dark:text-stone-100">
                Governance Queues
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerificationFilter('pending_review');
                  setActiveTab('verifications');
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                  <FileCheck2 className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                  <span>Pending Business License Verifications</span>
                </span>
                <span className="font-bold tabular-nums text-stone-900 dark:text-stone-100">
                  {pendingVerificationsCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShopStatusFilter('pending');
                  setActiveTab('shops');
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                  <Store className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
                  <span>Pending Merchant Applications</span>
                </span>
                <span className="font-bold tabular-nums text-stone-900 dark:text-stone-100">{pendingShopsCount}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setProductStatusFilter('pending_review');
                  setActiveTab('products');
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                  <Flag className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
                  <span>Products Flagged for Review</span>
                </span>
                <span className="font-bold tabular-nums text-stone-900 dark:text-stone-100">{flaggedProductsCount}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrdersSubTab('returns');
                  setReturnStatusFilter('requested');
                  setActiveTab('orders');
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                  <RefreshCw className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  <span>Open Return & Exchange Disputes</span>
                </span>
                <span className="font-bold tabular-nums text-stone-900 dark:text-stone-100">{openReturnsCount}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSupervisionFilter('attention');
                  setActiveTab('supervision');
                }}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                  <MessageSquare className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B]" />
                  <span>{t('adminSupervisionConsoleTitle')}</span>
                </span>
                <span className="font-bold tabular-nums text-stone-900 dark:text-stone-100">
                  {supervisionAttentionCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className="w-full px-4 py-3 flex items-center justify-between text-xs hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                <span className="flex items-center gap-2 text-stone-700 dark:text-stone-200 font-medium">
                  <ClipboardList className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                  <span>Immutable Audit Trail Entries</span>
                </span>
                <span className="font-bold tabular-nums text-stone-900 dark:text-stone-100">{adminAuditLogs.length}</span>
              </button>
            </section>
          </div>
        )}

        {/* TAB 2: SHOPS GOVERNANCE */}
        {activeTab === 'shops' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
                placeholder="Search shops by name, neighborhood, or phone..."
                className="w-full min-h-[40px] pl-8 pr-3 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['all', 'pending', 'approved', 'suspended'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setShopStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 border transition-colors ${
                    shopStatusFilter === st
                      ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                      : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {filteredShops.map((shop) => (
              <div
                key={shop.shopId}
                className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {shop.name}
                      </span>
                      {shop.featured && (
                        <Star className="w-3.5 h-3.5 fill-[#D97706] text-[#D97706] dark:fill-[#F59E0B] dark:text-[#F59E0B] shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                      {shop.neighborhood} · {shop.phoneNumber} · {shop.rating.toFixed(1)}★
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold capitalize shrink-0 ${
                      shop.status === 'approved'
                        ? 'text-[#047857] dark:text-[#10B981]'
                        : shop.status === 'pending'
                        ? 'text-[#D97706] dark:text-[#F59E0B]'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {shop.status}
                  </span>
                </div>

                {shop.status === 'suspended' && shop.suspensionReason && (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200">
                    <span className="font-semibold">Suspension reason:</span> {shop.suspensionReason}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {shop.status !== 'approved' && (
                    <button
                      type="button"
                      onClick={() =>
                        void moderateShopGovernance({
                          shopId: shop.shopId,
                          status: 'approved',
                          reason: 'Verified by marketplace admin',
                        }).then(() => notifyAction(`${shop.name} approved.`))
                      }
                      className="min-h-[40px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void moderateShopGovernance({
                        shopId: shop.shopId,
                        featured: !shop.featured,
                        reason: shop.featured ? 'Removed featured badge' : 'Promoted as featured merchant',
                      }).then(() => notifyAction(shop.featured ? 'Unfeatured shop.' : 'Featured shop.'))
                    }
                    className="min-h-[40px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-stone-700 dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Star className="w-3.5 h-3.5 text-[#D97706] dark:text-[#F59E0B]" />
                    <span>{shop.featured ? 'Unfeature' : 'Feature'}</span>
                  </button>
                  {shop.status !== 'suspended' && (
                    <button
                      type="button"
                      onClick={() =>
                        openEnforcementModal({
                          kind: 'suspend_shop',
                          title: `Suspend ${shop.name}`,
                          subtitle:
                            'Suspending hides all listings from customers, blocks new orders, and prevents seller edits.',
                          confirmLabel: 'Suspend Shop',
                          tone: 'warn',
                          requiresReason: true,
                          placeholder: 'e.g. Unfulfilled orders or counterfeit inventory report',
                          onConfirm: (reason) =>
                            moderateShopGovernance({
                              shopId: shop.shopId,
                              status: 'suspended',
                              reason,
                            }),
                        })
                      }
                      className="min-h-[40px] px-3 rounded-xl border border-[#FDE68A] dark:border-[#F59E0B]/30 text-[#B45309] dark:text-[#F59E0B] hover:bg-[#FFFBEB] dark:hover:bg-[#F59E0B]/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>Suspend</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      openEnforcementModal({
                        kind: 'delete_shop',
                        title: `Permanently Delete ${shop.name}`,
                        subtitle:
                          'This permanently deletes the merchant profile from Firestore. Enter an audit reason.',
                        confirmLabel: 'Delete Shop',
                        tone: 'danger',
                        requiresReason: true,
                        placeholder: 'e.g. Duplicate merchant registration or permanent closure',
                        onConfirm: (reason) => deleteShopAsAdmin(shop.shopId, reason),
                      })
                    }
                    className="min-h-[40px] px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 2B: BUSINESS LICENSE DOCUMENT VERIFICATION */}
        {activeTab === 'verifications' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={verificationSearch}
                onChange={(e) => setVerificationSearch(e.target.value)}
                placeholder="Search by shop, legal name, license no., or TIN..."
                className="w-full min-h-[40px] pl-8 pr-3 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['pending_review', 'approved', 'rejected', 'all'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setVerificationFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 border transition-colors ${
                    verificationFilter === st
                      ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                      : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {filteredVerifications.length === 0 ? (
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center space-y-1.5">
                <FileCheck2 className="w-6 h-6 text-stone-400 mx-auto" />
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  No matching document submissions
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  Merchants submit business licenses from Seller Portal → Verification for manual review here.
                </p>
              </div>
            ) : (
              filteredVerifications.map((ver) => (
                <div
                  key={ver.verificationId}
                  className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {ver.shopName}
                      </div>
                      <div className="text-[11px] text-stone-600 dark:text-stone-300 truncate mt-0.5">
                        {ver.businessLegalName}
                      </div>
                    </div>
                    <span
                      className={`text-[11px] font-bold capitalize shrink-0 ${
                        ver.status === 'approved'
                          ? 'text-[#047857] dark:text-[#10B981]'
                          : ver.status === 'rejected'
                          ? 'text-rose-700 dark:text-rose-400'
                          : 'text-[#D97706] dark:text-[#F59E0B]'
                      }`}
                    >
                      {ver.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC]/60 dark:border-[#2A3630] text-[11px]">
                    <div>
                      <div className="text-stone-500 dark:text-stone-400">License No.</div>
                      <div className="font-mono font-bold text-stone-900 dark:text-stone-100 truncate">
                        {ver.licenseNumber}
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-500 dark:text-stone-400">TIN Number</div>
                      <div className="font-mono font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {ver.tinNumber || '—'}
                      </div>
                    </div>
                    <div className="col-span-2">
                      <div className="text-stone-500 dark:text-stone-400">Issuing Authority</div>
                      <div className="font-medium text-stone-800 dark:text-stone-200">
                        {ver.issuingAuthority}
                      </div>
                    </div>
                    <div className="col-span-2 flex items-center justify-between text-[10px] text-stone-500 dark:text-stone-400 tabular-nums pt-1 border-t border-[#D2E0DC] dark:border-[#2A3630]">
                      <span>Submitted {new Date(ver.submittedAt).toLocaleDateString()}</span>
                      <span>{ver.expiryDate ? `Expires ${ver.expiryDate}` : 'No expiry noted'}</span>
                    </div>
                  </div>

                  {/* Business License Preview Thumbnail */}
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        setInspectingDocUrl({
                          title: `${ver.shopName} · ${ver.licenseNumber}`,
                          subtitle: `${ver.businessLegalName} — ${ver.issuingAuthority}`,
                          imageUrl: ver.licenseImageDataUrl,
                        })
                      }
                      className="w-full rounded-xl overflow-hidden border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] group relative"
                    >
                      <img
                        src={ver.licenseImageDataUrl}
                        alt={`Business license for ${ver.shopName}`}
                        className="w-full h-36 object-cover"
                      />
                      <span className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-[#141A17]/85 text-white text-[10px] font-semibold inline-flex items-center gap-1">
                        <Eye className="w-3 h-3" />
                        <span>Inspect Full License</span>
                      </span>
                    </button>
                  </div>

                  {ver.reviewNote && (
                    <div className="p-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-[11px] text-stone-700 dark:text-stone-300">
                      <span className="font-semibold">Review note:</span> {ver.reviewNote}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    {ver.status !== 'approved' && (
                      <button
                        type="button"
                        onClick={() =>
                          void adminReviewMerchantVerification({
                            verificationId: ver.verificationId,
                            decision: 'approved',
                            reviewNote: 'Business license manually verified and approved',
                          }).then(() => notifyAction(`${ver.shopName} license approved.`))
                        }
                        className="min-h-[44px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>Approve License</span>
                      </button>
                    )}

                    {ver.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() =>
                          openEnforcementModal({
                            kind: 'suspend_shop',
                            title: `Reject License for ${ver.shopName}`,
                            subtitle:
                              'Prevents the merchant from listing products and notifies them to upload corrected documents.',
                            confirmLabel: 'Reject License',
                            tone: 'danger',
                            requiresReason: true,
                            placeholder:
                              'e.g. Expired trade license, unreadable stamp, or mismatched business name',
                            onConfirm: (reason) =>
                              adminReviewMerchantVerification({
                                verificationId: ver.verificationId,
                                decision: 'rejected',
                                reviewNote: reason,
                              }),
                          })
                        }
                        className="min-h-[44px] px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold flex items-center justify-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4 shrink-0" />
                        <span>Reject License</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: PRODUCT MODERATION */}
        {activeTab === 'products' && (
          <div className="space-y-3">
            {/* Idempotent Coffee Categorization Backfill Card */}
            <div className="rounded-2xl border border-[#C68B59]/40 bg-[#4B2E24]/15 dark:bg-[#4B2E24]/30 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Coffee className="w-4 h-4 text-[#C68B59] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-[#F8F4EE] truncate">
                      Coffee Traders Auto-Categorization Sync
                    </div>
                    <div className="text-[11px] text-stone-600 dark:text-[#D5C3B3] tabular-nums">
                      {coffeeMigrationPreview.alreadyCategorized} in Coffee Traders · {coffeeMigrationPreview.eligible} ready to sync · {coffeeMigrationPreview.ambiguous} ambiguous skipped
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={coffeeSyncRunning}
                  onClick={async () => {
                    setCoffeeSyncRunning(true);
                    setCoffeeSyncSummary(null);
                    try {
                      const result = await runCoffeeMigrationAsAdmin(false);
                      setCoffeeSyncSummary(
                        result.updated > 0
                          ? `Synced ${result.updated} coffee product${result.updated === 1 ? '' : 's'} to Coffee Traders (${result.alreadyCategorized} already categorized).`
                          : `Catalog already up to date (${result.alreadyCategorized} in Coffee Traders, 0 changes needed).`
                      );
                    } catch (err) {
                      setCoffeeSyncSummary(
                        err instanceof Error ? err.message : 'Unable to sync coffee catalog.'
                      );
                    } finally {
                      setCoffeeSyncRunning(false);
                    }
                  }}
                  className="min-h-[36px] px-3 rounded-xl bg-[#4B2E24] hover:bg-[#3A221A] disabled:opacity-60 text-[#F8F4EE] border border-[#C68B59]/50 text-[11px] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors"
                >
                  {coffeeSyncRunning ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  <span>{coffeeSyncRunning ? 'Syncing...' : 'Sync Catalog'}</span>
                </button>
              </div>
              {coffeeSyncSummary && (
                <div className="text-[11px] font-medium text-[#047857] dark:text-[#10B981]">
                  {coffeeSyncSummary}
                </div>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products, shops, or categories..."
                className="w-full min-h-[40px] pl-8 pr-3 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(['all', 'active', 'pending_review', 'archived'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setProductStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 border transition-colors ${
                    productStatusFilter === st
                      ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                      : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            {filteredProducts.map((p) => (
              <div
                key={p.productId}
                className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{p.name}</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                      {p.shopName} · {formatETB(p.price)} · Stock {p.stock}
                    </div>
                  </div>
                  <span
                    className={`text-[11px] font-bold capitalize shrink-0 ${
                      p.status === 'active'
                        ? 'text-[#047857] dark:text-[#10B981]'
                        : p.status === 'pending_review'
                        ? 'text-[#D97706] dark:text-[#F59E0B]'
                        : 'text-rose-700 dark:text-rose-400'
                    }`}
                  >
                    {p.status.replace('_', ' ')}
                  </span>
                </div>

                {p.moderationReason && (
                  <div className="p-2 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                    Moderation note: {p.moderationReason}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {p.status !== 'active' && (
                    <button
                      type="button"
                      onClick={() =>
                        void moderateProductGovernance({
                          productId: p.productId,
                          status: 'active',
                          isAvailable: p.stock > 0,
                          reason: 'Cleared moderation check',
                        }).then(() => notifyAction(`${p.name} restored.`))
                      }
                      className="min-h-[38px] px-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Approve / Restore</span>
                    </button>
                  )}
                  {p.status !== 'pending_review' && (
                    <button
                      type="button"
                      onClick={() =>
                        openEnforcementModal({
                          kind: 'flag_product',
                          title: `Flag "${p.name}" for Review`,
                          subtitle: 'Removes item from active listings pending compliance verification.',
                          confirmLabel: 'Flag Product',
                          tone: 'warn',
                          requiresReason: true,
                          placeholder: 'e.g. Price gouging or unclear product origin',
                          onConfirm: (reason) =>
                            moderateProductGovernance({
                              productId: p.productId,
                              status: 'pending_review',
                              reason,
                            }),
                        })
                      }
                      className="min-h-[38px] px-2.5 rounded-xl border border-[#FDE68A] dark:border-[#F59E0B]/30 text-[#B45309] dark:text-[#F59E0B] hover:bg-[#FFFBEB] dark:hover:bg-[#F59E0B]/10 text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Flag className="w-3.5 h-3.5" />
                      <span>Flag Review</span>
                    </button>
                  )}
                  {p.stock > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        openEnforcementModal({
                          kind: 'freeze_stock',
                          title: `Freeze Stock on "${p.name}"`,
                          subtitle: 'Immediately sets available stock to 0 and marks unavailable.',
                          confirmLabel: 'Freeze Stock',
                          tone: 'warn',
                          requiresReason: true,
                          placeholder: 'e.g. Inventory recall or unfulfilled order shortage',
                          onConfirm: (reason) =>
                            moderateProductGovernance({
                              productId: p.productId,
                              stock: 0,
                              isAvailable: false,
                              reason,
                            }),
                        })
                      }
                      className="min-h-[38px] px-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-stone-700 dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Package className="w-3.5 h-3.5" />
                      <span>Freeze Stock</span>
                    </button>
                  )}
                  {p.status !== 'archived' && (
                    <button
                      type="button"
                      onClick={() =>
                        openEnforcementModal({
                          kind: 'archive_product',
                          title: `Takedown "${p.name}"`,
                          subtitle: 'Archives listing from the Hawasa Gebeya catalog.',
                          confirmLabel: 'Takedown Listing',
                          tone: 'warn',
                          requiresReason: true,
                          placeholder: 'e.g. Prohibited item or repeated customer complaints',
                          onConfirm: (reason) =>
                            moderateProductGovernance({
                              productId: p.productId,
                              status: 'archived',
                              isAvailable: false,
                              reason,
                            }),
                        })
                      }
                      className="min-h-[38px] px-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-stone-700 dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Takedown</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      openEnforcementModal({
                        kind: 'delete_product',
                        title: `Delete "${p.name}"`,
                        subtitle: 'Permanently removes this product document from Firestore.',
                        confirmLabel: 'Delete Product',
                        tone: 'danger',
                        requiresReason: true,
                        placeholder: 'e.g. Spam listing or policy violation',
                        onConfirm: (reason) => deleteProductAsAdmin(p.productId, reason),
                      })
                    }
                    className="min-h-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-[11px] font-semibold flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB 4: ORDERS & RETURN DISPUTES */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setOrdersSubTab('orders')}
                className={`py-2 rounded-lg transition-colors ${
                  ordersSubTab === 'orders'
                    ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                All Orders ({adminOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setOrdersSubTab('returns')}
                className={`py-2 rounded-lg transition-colors ${
                  ordersSubTab === 'returns'
                    ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400'
                }`}
              >
                Return Disputes ({adminReturnRequests.length})
              </button>
            </div>

            {ordersSubTab === 'orders' ? (
              <>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(
                    ['all', 'pending', 'accepted', 'preparing', 'out_for_delivery', 'delivered', 'canceled', 'rejected'] as const
                  ).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatusFilter(st)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 border transition-colors ${
                        orderStatusFilter === st
                          ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                          : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                      }`}
                    >
                      {st.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>

                {filteredOrders.length === 0 ? (
                  <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                    No matching orders found.
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <div
                      key={order.orderId}
                      className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                            #{order.orderId.slice(-6).toUpperCase()} · {order.shopName}
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                            {order.customerName} ({order.customerPhone}) · {formatETB(order.totalAmount)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[11px] font-bold capitalize text-stone-800 dark:text-stone-200">
                            {order.orderStatus.replace(/_/g, ' ')}
                          </div>
                          <div className="text-[10px] text-stone-500 dark:text-stone-400 capitalize">
                            pay: {order.paymentStatus}
                          </div>
                        </div>
                      </div>

                      {order.adminNote && (
                        <div className="p-2 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                          Admin note: {order.adminNote}
                        </div>
                      )}

                      {order.orderStatus !== 'canceled' && order.orderStatus !== 'rejected' && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {order.orderStatus !== 'delivered' && (
                            <button
                              type="button"
                              onClick={() =>
                                openEnforcementModal({
                                  kind: 'order_action',
                                  title: `Force Complete #${order.orderId.slice(-6).toUpperCase()}`,
                                  subtitle: 'Marks this order as Delivered and payment Paid.',
                                  confirmLabel: 'Mark Delivered & Paid',
                                  tone: 'primary',
                                  requiresReason: true,
                                  placeholder: 'e.g. Verified delivery completion with courier',
                                  onConfirm: (reason) =>
                                    adminForceOrderAction({
                                      orderId: order.orderId,
                                      orderStatus: 'delivered',
                                      paymentStatus: 'paid',
                                      reason,
                                    }),
                                })
                              }
                              className="min-h-[38px] px-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Force Deliver</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              openEnforcementModal({
                                kind: 'order_action',
                                title: `Force Cancel & Refund #${order.orderId.slice(-6).toUpperCase()}`,
                                subtitle:
                                  'Cancels order, marks payment refunded, reverses earned loyalty points, and notifies customer.',
                                confirmLabel: 'Cancel & Refund',
                                tone: 'danger',
                                requiresReason: true,
                                placeholder: 'e.g. Merchant unresponsive for 48 hours; full refund issued',
                                onConfirm: (reason) =>
                                  adminForceOrderAction({
                                    orderId: order.orderId,
                                    orderStatus: 'canceled',
                                    paymentStatus: 'refunded',
                                    reason,
                                  }),
                              })
                            }
                            className="min-h-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-[11px] font-semibold flex items-center justify-center gap-1"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            <span>Force Refund</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {(['all', 'requested', 'approved', 'rejected', 'completed'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setReturnStatusFilter(st)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 border transition-colors ${
                        returnStatusFilter === st
                          ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                          : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                {filteredReturns.length === 0 ? (
                  <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                    No matching return or exchange requests.
                  </div>
                ) : (
                  filteredReturns.map((req) => (
                    <div
                      key={req.returnId}
                      className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                            {req.productName} ({req.requestType})
                          </div>
                          <div className="text-[11px] text-stone-500 dark:text-stone-400 tabular-nums">
                            #{req.orderId.slice(-6).toUpperCase()} · {req.customerName} → {req.shopName}
                          </div>
                        </div>
                        <span className="text-[11px] font-bold capitalize text-[#D97706] dark:text-[#F59E0B] shrink-0">
                          {req.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-stone-600 dark:text-stone-300">
                        <span className="font-semibold capitalize">{req.reason.replace(/_/g, ' ')}:</span>{' '}
                        {req.details}
                      </div>

                      {req.photoDataUrl && (
                        <img
                          src={req.photoDataUrl}
                          alt="Damage proof"
                          className="w-24 h-20 object-cover rounded-xl border border-[#D2E0DC] dark:border-[#2A3630]"
                        />
                      )}

                      {req.resolutionNote && (
                        <div className="p-2 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-[11px] text-stone-700 dark:text-stone-300">
                          Resolution: {req.resolutionNote}
                        </div>
                      )}

                      {(req.status === 'requested' || req.status === 'approved') && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {req.status === 'requested' && (
                            <button
                              type="button"
                              onClick={() =>
                                openEnforcementModal({
                                  kind: 'resolve_return',
                                  title: 'Approve Return / Exchange',
                                  subtitle: `Approve ${req.requestType} for ${req.productName} and notify ${req.customerName}.`,
                                  confirmLabel: 'Approve Request',
                                  tone: 'primary',
                                  requiresReason: true,
                                  placeholder: 'e.g. Damage photo verified; pickup courier assigned',
                                  onConfirm: (reason) =>
                                    adminResolveReturnRequest({
                                      returnId: req.returnId,
                                      status: 'approved',
                                      resolutionNote: reason,
                                    }),
                                })
                              }
                              className="min-h-[38px] px-2.5 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-[11px] font-semibold transition-colors"
                            >
                              Approve Claim
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              openEnforcementModal({
                                kind: 'resolve_return',
                                title: 'Mark Return Completed',
                                subtitle: 'Closes this dispute as resolved/refunded.',
                                confirmLabel: 'Complete Dispute',
                                tone: 'primary',
                                requiresReason: true,
                                placeholder: 'e.g. Replacement delivered / refund confirmed',
                                onConfirm: (reason) =>
                                  adminResolveReturnRequest({
                                    returnId: req.returnId,
                                    status: 'completed',
                                    resolutionNote: reason,
                                  }),
                              })
                            }
                            className="min-h-[38px] px-2.5 rounded-xl border border-[#A7F3D0] dark:border-[#10B981]/30 text-[#047857] dark:text-[#10B981] hover:bg-[#ECFDF5] dark:hover:bg-[#10B981]/10 text-[11px] font-semibold transition-colors"
                          >
                            Mark Completed
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openEnforcementModal({
                                kind: 'resolve_return',
                                title: 'Reject Return Dispute',
                                subtitle: `Decline ${req.requestType} request with explanation to the buyer.`,
                                confirmLabel: 'Reject Claim',
                                tone: 'danger',
                                requiresReason: true,
                                placeholder: 'e.g. Outside return window or insufficient proof',
                                onConfirm: (reason) =>
                                  adminResolveReturnRequest({
                                    returnId: req.returnId,
                                    status: 'rejected',
                                    resolutionNote: reason,
                                  }),
                              })
                            }
                            className="min-h-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-[11px] font-semibold"
                          >
                            Reject Claim
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 4B: MARKETPLACE ADMIN SUPERVISION CONSOLE */}
        {activeTab === 'supervision' && (
          <div className="space-y-3">
            <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-extrabold text-stone-900 dark:text-stone-100">
                    {t('adminSupervisionConsoleTitle')}
                  </h2>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                    {t('adminSupervisionConsoleDesc')}
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#92400E] dark:text-[#FCD34D] text-[11px] font-bold tabular-nums shrink-0">
                  {supervisionAttentionCount} active
                </span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={supervisionSearch}
                  onChange={(e) => setSupervisionSearch(e.target.value)}
                  placeholder="Search Order #, shop, buyer, or escalation reason..."
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#047857]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'attention', label: t('adminSupervisionFilterAttention') },
                    { id: 'requested', label: t('adminSupervisionFilterRequested') },
                    { id: 'active', label: t('adminSupervisionFilterActive') },
                    { id: 'resolved', label: t('adminSupervisionFilterResolved') },
                    { id: 'all', label: t('adminSupervisionFilterAll') },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setSupervisionFilter(pill.id)}
                    className={`min-h-[36px] px-3 rounded-xl text-[11px] font-bold whitespace-nowrap shrink-0 border transition-colors ${
                      supervisionFilter === pill.id
                        ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                        : 'bg-[#F3F6F4] dark:bg-[#141A17] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredSupervisionChats.length === 0 ? (
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                {t('adminSupervisionEmpty')}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Supervised Thread List */}
                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {filteredSupervisionChats.map((th) => {
                    const isSelected = selectedSupervisedThread?.threadId === th.threadId;
                    return (
                      <button
                        key={th.threadId}
                        type="button"
                        onClick={() => {
                          setAdminSupervisedThreadId(th.threadId);
                          setMediationError(null);
                        }}
                        className={`w-full text-left p-3.5 rounded-2xl border transition-colors space-y-1.5 ${
                          isSelected
                            ? 'bg-[#ECFDF5]/60 dark:bg-[#064E3B]/30 border-[#047857] dark:border-[#10B981]'
                            : 'bg-[#FCFDFC] dark:bg-[#1C2420] border-[#D2E0DC] dark:border-[#2A3630] hover:border-[#047857]/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-stone-900 dark:text-stone-100 truncate">
                            {th.orderCode ? `Order #${th.orderCode} · ` : ''}
                            {th.shopName}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold shrink-0 ${
                              th.supervisionStatus === 'requested'
                                ? 'bg-[#FEF3C7] dark:bg-[#78350F]/40 text-[#92400E] dark:text-[#FCD34D]'
                                : th.supervisionStatus === 'active'
                                ? 'bg-[#D1FAE5] dark:bg-[#064E3B]/60 text-[#065F46] dark:text-[#34D399]'
                                : th.supervisionStatus === 'resolved'
                                ? 'bg-stone-100 dark:bg-[#232D28] text-stone-600 dark:text-stone-300'
                                : 'bg-stone-100 dark:bg-[#232D28] text-stone-500'
                            }`}
                          >
                            {th.supervisionStatus.toUpperCase()}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-600 dark:text-stone-300 truncate">
                          {th.buyerName} ↔ {th.shopName}
                          {th.supervisionReason ? ` · “${th.supervisionReason}”` : ''}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                          {th.lastMessage}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Transcript & Mediator Actions Panel */}
                {selectedSupervisedThread && (
                  <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none overflow-hidden">
                    <div className="p-4 border-b border-[#D2E0DC] dark:border-[#2A3630] space-y-2.5 bg-[#F3F6F4] dark:bg-[#141A17]">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-xs font-extrabold text-stone-900 dark:text-stone-100">
                            {selectedSupervisedThread.orderCode
                              ? `Order #${selectedSupervisedThread.orderCode}`
                              : selectedSupervisedThread.shopName}{' '}
                            · Live Transcript
                          </h3>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400">
                            Buyer: {selectedSupervisedThread.buyerName} · Seller:{' '}
                            {selectedSupervisedThread.shopName}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {selectedSupervisedThread.supervisionStatus !== 'active' && (
                            <button
                              type="button"
                              disabled={mediatingSubmitting}
                              onClick={async () => {
                                setMediatingSubmitting(true);
                                setMediationError(null);
                                try {
                                  await adminJoinChatMediation(selectedSupervisedThread.threadId);
                                  notifyAction('Joined chat as Marketplace Mediator.');
                                } catch (err) {
                                  setMediationError(
                                    err instanceof Error ? err.message : 'Could not join thread.'
                                  );
                                } finally {
                                  setMediatingSubmitting(false);
                                }
                              }}
                              className="min-h-[38px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] text-white text-[11px] font-bold inline-flex items-center gap-1.5"
                            >
                              <ShieldCheck size={14} />
                              {t('adminJoinMediationBtn')}
                            </button>
                          )}
                          {selectedSupervisedThread.supervisionStatus !== 'resolved' && (
                            <button
                              type="button"
                              disabled={mediatingSubmitting}
                              onClick={async () => {
                                setMediatingSubmitting(true);
                                setMediationError(null);
                                try {
                                  await adminResolveChatSupervision(
                                    selectedSupervisedThread.threadId,
                                    resolutionNoteInput
                                  );
                                  setResolutionNoteInput('');
                                  notifyAction('Chat supervision marked resolved.');
                                } catch (err) {
                                  setMediationError(
                                    err instanceof Error ? err.message : 'Could not resolve thread.'
                                  );
                                } finally {
                                  setMediatingSubmitting(false);
                                }
                              }}
                              className="min-h-[38px] px-3 rounded-xl border border-[#D97706] text-[#92400E] dark:text-[#FCD34D] hover:bg-[#FEF3C7]/60 dark:hover:bg-[#78350F]/30 text-[11px] font-bold inline-flex items-center gap-1.5"
                            >
                              <CheckCircle2 size={14} />
                              {t('adminMarkResolvedBtn')}
                            </button>
                          )}
                        </div>
                      </div>

                      {selectedSupervisedThread.supervisionReason && (
                        <div className="text-[11px] text-[#92400E] dark:text-[#FCD34D] bg-[#FEF3C7]/70 dark:bg-[#78350F]/30 border border-[#F59E0B]/30 rounded-xl px-3 py-1.5">
                          Escalation Reason: {selectedSupervisedThread.supervisionReason}
                        </div>
                      )}

                      {selectedSupervisedThread.supervisionStatus !== 'resolved' && (
                        <input
                          type="text"
                          value={resolutionNoteInput}
                          onChange={(e) => setResolutionNoteInput(e.target.value)}
                          placeholder="Optional resolution summary when marking resolved..."
                          maxLength={300}
                          className="w-full min-h-[38px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] text-[11px] text-stone-900 dark:text-stone-100"
                        />
                      )}
                    </div>

                    {/* Message Transcript Feed */}
                    <div className="p-4 space-y-2.5 max-h-72 overflow-y-auto bg-[#F3F6F4]/50 dark:bg-[#141A17]/50">
                      {adminSupervisedMessages.length === 0 ? (
                        <p className="text-xs text-stone-500 dark:text-stone-400 text-center py-4">
                          No messages in this thread yet.
                        </p>
                      ) : (
                        adminSupervisedMessages.map((msg) => (
                          <div
                            key={msg.messageId}
                            className={`rounded-xl p-2.5 text-xs space-y-0.5 ${
                              msg.senderRole === 'admin'
                                ? 'bg-[#ECFDF5] dark:bg-[#064E3B]/45 border border-[#10B981]/50'
                                : msg.senderRole === 'system'
                                ? 'bg-[#FEF3C7]/70 dark:bg-[#78350F]/30 border border-[#F59E0B]/40'
                                : 'bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[10px] font-bold">
                              <span
                                className={
                                  msg.senderRole === 'admin'
                                    ? 'text-[#047857] dark:text-[#34D399]'
                                    : msg.senderRole === 'system'
                                    ? 'text-[#92400E] dark:text-[#FCD34D]'
                                    : 'text-stone-600 dark:text-stone-300'
                                }
                              >
                                {msg.senderName} ({msg.senderRole.toUpperCase()})
                              </span>
                              <span className="text-stone-400 tabular-nums">
                                {new Date(msg.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            </div>
                            <p className="text-xs text-stone-900 dark:text-stone-100 whitespace-pre-wrap">
                              {msg.body}
                            </p>
                          </div>
                        ))
                      )}
                    </div>

                    {mediationError && (
                      <div className="px-4 py-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold">
                        {mediationError}
                      </div>
                    )}

                    {/* Official Admin Mediator Composer */}
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!mediatorReply.trim() || mediatingSubmitting) return;
                        setMediatingSubmitting(true);
                        setMediationError(null);
                        try {
                          await adminSendMediatorMessage(
                            selectedSupervisedThread.threadId,
                            mediatorReply
                          );
                          setMediatorReply('');
                          notifyAction('Official mediator message sent.');
                        } catch (err) {
                          setMediationError(
                            err instanceof Error ? err.message : 'Unable to send mediator message.'
                          );
                        } finally {
                          setMediatingSubmitting(false);
                        }
                      }}
                      className="p-3 border-t border-[#D2E0DC] dark:border-[#2A3630] flex items-center gap-2 bg-[#FCFDFC] dark:bg-[#1C2420]"
                    >
                      <input
                        type="text"
                        value={mediatorReply}
                        onChange={(e) => setMediatorReply(e.target.value)}
                        placeholder={t('adminMediatorInputPlaceholder')}
                        maxLength={1000}
                        className="flex-1 min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#047857]"
                      />
                      <button
                        type="submit"
                        disabled={mediatingSubmitting || !mediatorReply.trim()}
                        className="min-h-[42px] px-3.5 rounded-xl bg-[#047857] hover:bg-[#065F46] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
                      >
                        <Send size={14} />
                        <span>{t('adminSendMediatorBtn')}</span>
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: USERS & ROLE ACCESS MANAGEMENT */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {/* Grant / Change Role by Email Quick Form */}
            <form
              onSubmit={handleGrantRoleByEmail}
              className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] flex items-center justify-center shrink-0">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {t('grantAdminByEmailTitle')}
                  </h2>
                </div>
                <span className="px-2 py-0.5 rounded-md bg-[#FFFBEB] dark:bg-[#2A2418] border border-[#FDE68A] dark:border-[#78350F] text-[10px] font-semibold text-[#B45309] dark:text-[#FBBF24] shrink-0">
                  Firestore /users
                </span>
              </div>

              <div className="relative">
                <Mail className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  value={grantEmail}
                  onChange={(e) => {
                    setGrantEmail(e.target.value);
                    if (grantFeedback) setGrantFeedback(null);
                  }}
                  placeholder={t('grantAdminByEmailPlaceholder')}
                  className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  aria-label="Target role for email lookup"
                  value={grantRoleTarget}
                  onChange={(e) => setGrantRoleTarget(e.target.value as UserRole)}
                  className="min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs font-semibold text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                >
                  <option value="admin">{t('adminRoleAdminBtn')}</option>
                  <option value="seller">{t('adminRoleSellerBtn')}</option>
                  <option value="customer">{t('adminRoleCustomerBtn')}</option>
                </select>
                <button
                  type="submit"
                  disabled={grantSubmitting || !grantEmail.trim()}
                  className="flex-1 min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#047857] via-[#059669] to-[#0D9488] hover:from-[#065F46] hover:to-[#047857] text-white text-xs font-semibold shadow-sm disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all"
                >
                  {grantSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {grantRoleTarget === 'admin'
                      ? t('grantAdminBtn')
                      : grantRoleTarget === 'seller'
                        ? t('adminRoleSellerBtn')
                        : t('revokeAdminBtn')}
                  </span>
                </button>
              </div>

              {grantFeedback && (
                <div
                  className={`px-3 py-2 rounded-xl text-[11px] font-medium border ${
                    grantFeedback.type === 'ok'
                      ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 border-[#A7F3D0] dark:border-[#10B981]/30 text-[#047857] dark:text-[#10B981]'
                      : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                  }`}
                >
                  {grantFeedback.text}
                </div>
              )}
            </form>

            {/* Search & Role Filter Pills */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name, email, phone, or UID..."
                  className="w-full min-h-[40px] pl-8 pr-3 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {(
                  [
                    { id: 'all', label: `${t('adminUsersFilterAll')} (${userRoleCounts.all})` },
                    { id: 'admin', label: `${t('adminUsersFilterAdmins')} (${userRoleCounts.admin})` },
                    { id: 'seller', label: `${t('adminUsersFilterSellers')} (${userRoleCounts.seller})` },
                    { id: 'customer', label: `${t('adminUsersFilterCustomers')} (${userRoleCounts.customer})` },
                  ] as const
                ).map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setUserRoleFilter(pill.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                      userRoleFilter === pill.id
                        ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                        : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630] hover:bg-[#EBF1EE] dark:hover:bg-[#242E29]'
                    }`}
                  >
                    {pill.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                No matching user profiles found.
              </div>
            ) : (
              filteredUsers.map((usr) => {
                const isSelf = firebaseUser?.uid === usr.uid;
                const isOwnerAdmin = isSuperAdminEmail(usr.email);
                const isUpdating = updatingUserUid === usr.uid;
                return (
                  <div
                    key={usr.uid}
                    className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                            {usr.displayName} {isSelf ? '(You)' : ''}
                          </span>
                          {isOwnerAdmin && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFFBEB] dark:bg-[#2A2418] border border-[#FDE68A] dark:border-[#78350F] text-[10px] font-bold text-[#B45309] dark:text-[#FBBF24]">
                              <Crown className="w-2.5 h-2.5" />
                              <span>{t('adminSuperAdminBadge')}</span>
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                          {usr.email || usr.uid}
                          {usr.phoneNumber ? ` · ${usr.phoneNumber}` : ''}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-stone-400 dark:text-stone-500 tabular-nums">
                          {usr.neighborhood && <span>{usr.neighborhood}</span>}
                          <span>{(usr.loyaltyPoints ?? 0).toLocaleString()} pts</span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            usr.role === 'admin'
                              ? 'bg-[#FFF7ED] dark:bg-[#F59E0B]/15 text-[#C2410C] dark:text-[#FBBF24] border border-[#FDBA74]/50 dark:border-[#F59E0B]/30'
                              : usr.role === 'seller'
                                ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] border border-[#A7F3D0] dark:border-[#10B981]/30'
                                : 'bg-stone-100 dark:bg-[#141A17] text-stone-600 dark:text-stone-300 border border-[#D2E0DC] dark:border-[#2A3630]'
                          }`}
                        >
                          {usr.role}
                        </span>
                        <span
                          className={`text-[10px] font-bold capitalize ${
                            usr.accountStatus === 'active'
                              ? 'text-[#047857] dark:text-[#10B981]'
                              : usr.accountStatus === 'suspended'
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-[#D97706] dark:text-[#F59E0B]'
                          }`}
                        >
                          {usr.accountStatus}
                        </span>
                      </div>
                    </div>

                    {/* Direct One-Click Role Buttons + Active/Suspended Status Toggle */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#D2E0DC]/60 dark:border-[#2A3630]">
                      <div
                        className="inline-flex items-center p-1 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] gap-1"
                        role="group"
                        aria-label={`Change role for ${usr.displayName}`}
                      >
                        {(
                          [
                            { id: 'customer', label: t('adminRoleCustomerBtn') },
                            { id: 'seller', label: t('adminRoleSellerBtn') },
                            { id: 'admin', label: t('adminRoleAdminBtn') },
                          ] as const
                        ).map((roleBtn) => {
                          const isActiveRole = usr.role === roleBtn.id;
                          const isDisabled =
                            isUpdating ||
                            ((isSelf || isOwnerAdmin) && roleBtn.id !== 'admin');
                          return (
                            <button
                              key={roleBtn.id}
                              type="button"
                              disabled={isDisabled || isActiveRole}
                              onClick={() => void handleQuickRoleSwitch(usr, roleBtn.id)}
                              className={`min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-all disabled:cursor-not-allowed ${
                                isActiveRole
                                  ? roleBtn.id === 'admin'
                                    ? 'bg-[#D97706] dark:bg-[#F59E0B] text-white dark:text-[#141A17] shadow-xs'
                                    : 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] shadow-xs'
                                  : 'text-stone-600 dark:text-stone-300 hover:bg-white dark:hover:bg-[#1C2420] disabled:opacity-40'
                              }`}
                            >
                              {roleBtn.label}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={isUpdating || isSelf || isOwnerAdmin}
                        onClick={() => void handleQuickStatusToggle(usr)}
                        className={`min-h-[34px] px-3 rounded-xl text-[11px] font-semibold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-40 ${
                          usr.accountStatus === 'suspended'
                            ? 'bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410]'
                            : 'border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50'
                        }`}
                      >
                        {isUpdating ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : usr.accountStatus === 'suspended' ? (
                          <UserCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                        <span>{usr.accountStatus === 'suspended' ? 'Active (Reinstate)' : 'Suspend'}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* TAB 6: REVIEW MODERATION */}
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={reviewSearch}
                onChange={(e) => setReviewSearch(e.target.value)}
                placeholder="Search reviews by customer or comment..."
                className="w-full min-h-[40px] pl-8 pr-3 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>

            {filteredReviews.map((rev) => (
              <div
                key={rev.reviewId}
                className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {rev.customerName} · <span className="text-[#D97706] dark:text-[#F59E0B]">{rev.rating}★</span>
                    </div>
                    <div className="text-[10px] text-stone-400 dark:text-stone-500">
                      Product: {rev.productId} · {new Date(rev.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      openEnforcementModal({
                        kind: 'delete_review',
                        title: `Remove Review by ${rev.customerName}`,
                        subtitle: 'Permanently deletes this review for spam, abuse, or policy violation.',
                        confirmLabel: 'Remove Review',
                        tone: 'danger',
                        requiresReason: true,
                        placeholder: 'e.g. Profanity, spam link, or off-topic content',
                        onConfirm: (reason) => adminDeleteReview(rev.reviewId, reason),
                      })
                    }
                    className="min-h-[36px] px-2.5 rounded-lg border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-[11px] font-semibold flex items-center gap-1 shrink-0"
                  >
                    <MessageSquareWarning className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                </div>
                <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB 7: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="space-y-3">
            <form
              onSubmit={handleAddCategory}
              className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5"
            >
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
                <span>Add Marketplace Category</span>
              </h2>
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Category Name (English)"
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newCatAm}
                  onChange={(e) => setNewCatAm(e.target.value)}
                  placeholder="Amharic Name"
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
                <input
                  type="text"
                  value={newCatOm}
                  onChange={(e) => setNewCatOm(e.target.value)}
                  placeholder="Afaan Oromo Name"
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
                <input
                  type="text"
                  value={newCatSid}
                  onChange={(e) => setNewCatSid(e.target.value)}
                  placeholder="Sidamu Afoo Name"
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>
              <button
                type="submit"
                className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1 shadow-sm transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>Create Category</span>
              </button>
            </form>

            <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none divide-y divide-[#D2E0DC]/70 dark:divide-[#2A3630]">
              {categories.map((cat) => (
                <div key={cat.slug} className="p-3.5 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">{cat.name}</div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400">
                      {cat.nameAm} · {cat.nameOm}
                      {cat.nameSid ? ` · ${cat.nameSid}` : ''}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void saveCategory({ ...cat, isActive: !cat.isActive }).then(() =>
                        notifyAction(`${cat.name} ${cat.isActive ? 'disabled' : 'enabled'}.`)
                      )
                    }
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      cat.isActive
                        ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981]'
                        : 'bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-stone-500 dark:text-stone-400'
                    }`}
                  >
                    {cat.isActive ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 8: GLOBAL GOVERNANCE POLICY */}
        {activeTab === 'config' && (
          <form
            onSubmit={handleSaveConfig}
            className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#047857] dark:text-[#10B981]" />
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                Marketplace Governance Policy
              </h2>
            </div>

            <div className="space-y-2.5">
              <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Pause All Customer Ordering
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Emergency kill-switch that blocks checkout across all Hawassa shops.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={orderingPaused}
                  onChange={(e) => setOrderingPaused(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-rose-600"
                />
              </label>

              <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] cursor-pointer">
                <div>
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    Strict Shop Verification
                  </div>
                  <div className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    Only approved merchants appear in search/home and can accept orders.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={strictVerification}
                  onChange={(e) => setStrictVerification(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#047857]"
                />
              </label>
            </div>

            <div>
              <label htmlFor="admin-banner-input" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Maintenance / Notice Banner (shown when paused)
              </label>
              <input
                id="admin-banner-input"
                type="text"
                maxLength={300}
                value={maintenanceBanner}
                onChange={(e) => setMaintenanceBanner(e.target.value)}
                placeholder="e.g. Scheduled payment maintenance until 18:00 EAT."
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="admin-fee-input" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Standard Hawassa Delivery Fee (ETB)
                </label>
                <input
                  id="admin-fee-input"
                  type="number"
                  min={0}
                  max={50000}
                  value={feeInput}
                  onChange={(e) => setFeeInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>

              <div>
                <label htmlFor="admin-threshold-input" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Free Delivery Threshold (ETB)
                </label>
                <input
                  id="admin-threshold-input"
                  type="number"
                  min={0}
                  max={1000000}
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>

              <div>
                <label htmlFor="admin-max-order-input" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Max Single-Order Cap (ETB)
                </label>
                <input
                  id="admin-max-order-input"
                  type="number"
                  min={100}
                  max={10000000}
                  value={maxOrderInput}
                  onChange={(e) => setMaxOrderInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>

              <div>
                <label htmlFor="admin-policy-reason" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                  Audit Note (optional)
                </label>
                <input
                  id="admin-policy-reason"
                  type="text"
                  maxLength={300}
                  value={policyReason}
                  onChange={(e) => setPolicyReason(e.target.value)}
                  placeholder="Reason for policy update..."
                  className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold shadow-sm transition-colors"
            >
              {policySaved ? 'Saved Governance Policy!' : 'Save Governance Policy'}
            </button>
          </form>
        )}

        {/* TAB 9: IMMUTABLE AUDIT LOG */}
        {activeTab === 'audit' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {(
                ['all', 'shop', 'verification', 'product', 'order', 'return_request', 'chat_supervision', 'user', 'review', 'config'] as const
              ).map((tt) => (
                <button
                  key={tt}
                  type="button"
                  onClick={() => setAuditTypeFilter(tt)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold capitalize whitespace-nowrap shrink-0 border transition-colors ${
                    auditTypeFilter === tt
                      ? 'bg-[#047857] dark:bg-[#10B981] text-white dark:text-[#0B1410] border-[#047857] dark:border-[#10B981]'
                      : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-stone-600 dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630]'
                  }`}
                >
                  {tt.replace(/_/g, ' ')}
                </button>
              ))}
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-6 text-center text-xs text-stone-500 dark:text-stone-400">
                No audit entries recorded yet. Every governance action creates an immutable record here.
              </div>
            ) : (
              <div className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none divide-y divide-[#D2E0DC]/70 dark:divide-[#2A3630]">
                {filteredAuditLogs.map((log) => (
                  <div key={log.logId} className="p-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono font-bold text-[#047857] dark:text-[#10B981] uppercase">
                        {log.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-stone-400 dark:text-stone-500 tabular-nums shrink-0">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      {log.targetLabel}{' '}
                      <span className="text-[10px] font-normal text-stone-500 dark:text-stone-400">
                        ({log.targetType.replace(/_/g, ' ')})
                      </span>
                    </div>
                    {log.reason && (
                      <div className="text-[11px] text-stone-600 dark:text-stone-300">
                        Reason: {log.reason}
                      </div>
                    )}
                    <div className="text-[10px] text-stone-400 dark:text-stone-500">
                      By {log.adminEmail}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mandatory-Reason Governance Confirmation Modal */}
      {pendingAction && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="governance-modal-title"
        >
          <form
            onSubmit={handleConfirmEnforcement}
            className="w-full max-w-md bg-[#FCFDFC] dark:bg-[#1C2420] rounded-t-3xl sm:rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] p-5 space-y-3.5 max-h-[85vh] overflow-y-auto shadow-xl"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <AlertTriangle
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    pendingAction.tone === 'danger'
                      ? 'text-rose-600 dark:text-rose-400'
                      : pendingAction.tone === 'warn'
                      ? 'text-[#D97706] dark:text-[#F59E0B]'
                      : 'text-[#047857] dark:text-[#10B981]'
                  }`}
                />
                <div>
                  <h3 id="governance-modal-title" className="text-sm font-bold text-stone-900 dark:text-stone-100">
                    {pendingAction.title}
                  </h3>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 leading-relaxed">
                    {pendingAction.subtitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                aria-label="Close modal"
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="governance-reason-input" className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Administrative Reason (logged in audit trail)
              </label>
              <textarea
                id="governance-reason-input"
                rows={3}
                maxLength={300}
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                placeholder={pendingAction.placeholder}
                className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 resize-none focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>

            {actionError && (
              <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                {actionError}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPendingAction(null)}
                className="flex-1 min-h-[44px] rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-xs font-semibold text-stone-700 dark:text-stone-200 hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={actionSubmitting}
                className={`flex-1 min-h-[44px] rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors ${
                  pendingAction.tone === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-700 text-white'
                    : pendingAction.tone === 'warn'
                    ? 'bg-[#D97706] hover:bg-[#B45309] dark:bg-[#F59E0B] dark:hover:bg-[#D97706] text-white dark:text-[#141A17]'
                    : 'bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410]'
                }`}
              >
                {actionSubmitting ? 'Applying...' : pendingAction.confirmLabel}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Full-Screen Business License Lightbox Modal */}
      {inspectingDocUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="license-lightbox-title"
        >
          <div className="w-full max-w-lg bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] overflow-hidden shadow-2xl">
            <div className="px-4 py-3 border-b border-[#D2E0DC] dark:border-[#2A3630] flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3
                  id="license-lightbox-title"
                  className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate"
                >
                  {inspectingDocUrl.title}
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 truncate mt-0.5">
                  {inspectingDocUrl.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectingDocUrl(null)}
                aria-label="Close license preview"
                className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-stone-500 hover:bg-[#EBF1EE] dark:hover:bg-[#242F29] shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-[#141A17] flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={inspectingDocUrl.imageUrl}
                alt={inspectingDocUrl.title}
                className="max-w-full max-h-[65vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
