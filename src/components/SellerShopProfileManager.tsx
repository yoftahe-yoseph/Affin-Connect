import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  FileCheck2,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Power,
  Store,
  Tag,
  Upload,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS } from '../data/seedData';
import {
  DiscoverShopCard,
  ResilientImage,
  SHOP_DIR_CATEGORY_TRANSLATION_KEYS,
} from './SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  buildShopSlug,
  getNeighborhoodCoordinates,
  HAWASSA_NEIGHBORHOODS,
  validateProductImageUrl,
} from '../utils/marketplaceLogic';
import {
  getShopAvailabilityStatus,
  inferShopMainCategory,
  resolveShopCallablePhone,
  sanitizeProductTypesList,
  SHOP_DIRECTORY_CATEGORIES,
  validateShopProfilePayload,
} from '../utils/shopDirectory';
import { processUploadedPhotoFile } from '../utils/imageUpload';
import type {
  PreferredContactMethod,
  Shop,
  ShopAvailabilityStatus,
} from '../types';

interface ShopFormState {
  name: string;
  description: string;
  mainCategory: string;
  productTypes: string[];
  productTypeInput: string;
  logoUrl: string;
  coverImageUrl: string;
  region: string;
  city: string;
  subCity: string;
  neighborhood: string;
  address: string;
  latitude: string;
  longitude: string;
  operatingHours: string;
  phoneNumber: string;
  publishBusinessPhone: boolean;
  businessPhoneNumber: string;
  preferredContactMethod: PreferredContactMethod;
  availabilityStatus: ShopAvailabilityStatus;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
}

function buildInitialCreateFormState(accountPhone: string): ShopFormState {
  return {
    name: '',
    description: '',
    mainCategory: 'groceries',
    productTypes: [],
    productTypeInput: '',
    logoUrl: BRAND_ASSETS.logo,
    coverImageUrl: '',
    region: 'Sidama',
    city: 'Hawassa',
    subCity: '',
    neighborhood: HAWASSA_NEIGHBORHOODS[0],
    address: '',
    latitude: '',
    longitude: '',
    operatingHours: '',
    phoneNumber: accountPhone,
    publishBusinessPhone: false,
    businessPhoneNumber: '',
    preferredContactMethod: 'both',
    availabilityStatus: 'active',
    deliveryAvailable: true,
    pickupAvailable: true,
  };
}

function buildEditFormStateFromShop(shop: Shop, accountPhone: string): ShopFormState {
  return {
    name: shop.name,
    description: shop.description,
    mainCategory: inferShopMainCategory(shop),
    productTypes: sanitizeProductTypesList(shop.productTypes),
    productTypeInput: '',
    logoUrl: shop.logoUrl || BRAND_ASSETS.logo,
    coverImageUrl: shop.coverImageUrl || '',
    region: shop.region || 'Sidama',
    city: shop.city || 'Hawassa',
    subCity: shop.subCity || '',
    neighborhood: shop.neighborhood || HAWASSA_NEIGHBORHOODS[0],
    address: shop.address || '',
    latitude: typeof shop.latitude === 'number' ? String(shop.latitude) : '',
    longitude: typeof shop.longitude === 'number' ? String(shop.longitude) : '',
    operatingHours: shop.operatingHours || '',
    phoneNumber: shop.phoneNumber || accountPhone,
    publishBusinessPhone: Boolean(shop.publishBusinessPhone),
    businessPhoneNumber: shop.businessPhoneNumber || '',
    preferredContactMethod: shop.preferredContactMethod || 'both',
    availabilityStatus: getShopAvailabilityStatus(shop),
    deliveryAvailable: shop.deliveryAvailable ?? true,
    pickupAvailable: shop.pickupAvailable ?? true,
  };
}

export const SellerShopProfileManager: React.FC<{
  currentShop: Shop | null;
  isVerifiedForDirectory: boolean;
  onGoToVerification: () => void;
}> = ({ currentShop, isVerifiedForDirectory, onGoToVerification }) => {
  const {
    firebaseUser,
    userProfile,
    activeRoleView,
    setActiveSellerShopId,
    saveSellerShop,
    updateShopAvailabilityStatus,
    navigate,
    language,
    t,
  } = useMarketplace();

  const registeredAccountPhone = useMemo(
    () => (userProfile?.phoneNumber || firebaseUser?.phoneNumber || '').trim(),
    [userProfile?.phoneNumber, firebaseUser?.phoneNumber]
  );

  const [mode, setMode] = useState<'view' | 'edit' | 'create'>(
    currentShop ? 'view' : 'create'
  );
  const [form, setForm] = useState<ShopFormState>(() =>
    currentShop
      ? buildEditFormStateFromShop(currentShop, registeredAccountPhone)
      : buildInitialCreateFormState(registeredAccountPhone)
  );
  const [showPreview, setShowPreview] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState<ShopAvailabilityStatus | null>(null);

  useEffect(() => {
    if (!currentShop) {
      setMode('create');
      setForm(buildInitialCreateFormState(registeredAccountPhone));
    } else if (mode === 'view') {
      setForm(buildEditFormStateFromShop(currentShop, registeredAccountPhone));
    }
    setFormErrors({});
    setSubmitError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.shopId, registeredAccountPhone]);

  const canManageCurrentShop = Boolean(
    currentShop &&
      (activeRoleView === 'admin' ||
        (firebaseUser && currentShop.ownerUid === firebaseUser.uid))
  );

  const openEditMode = () => {
    if (!currentShop) return;
    setForm(buildEditFormStateFromShop(currentShop, registeredAccountPhone));
    setFormErrors({});
    setSubmitError(null);
    setSuccessMsg(null);
    setShowPreview(false);
    setMode('edit');
  };

  const openCreateMode = () => {
    setForm(buildInitialCreateFormState(registeredAccountPhone));
    setFormErrors({});
    setSubmitError(null);
    setSuccessMsg(null);
    setShowPreview(false);
    setMode('create');
  };

  const addProductTypeTag = () => {
    const raw = form.productTypeInput.trim();
    if (!raw) return;
    const merged = sanitizeProductTypesList([...form.productTypes, ...raw.split(',')]);
    setForm((prev) => ({
      ...prev,
      productTypes: merged,
      productTypeInput: '',
    }));
  };

  const removeProductTypeTag = (tag: string) => {
    setForm((prev) => ({
      ...prev,
      productTypes: prev.productTypes.filter((item) => item !== tag),
    }));
  };

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'logoUrl' | 'coverImageUrl'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setSubmitError(null);
    try {
      const processed = await processUploadedPhotoFile(file);
      setForm((prev) => ({ ...prev, [field]: processed }));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : t('imageSizeTooLargeError')
      );
    }
  };

  const handleUseNeighborhoodCoords = () => {
    const coords = getNeighborhoodCoordinates(form.neighborhood);
    setForm((prev) => ({
      ...prev,
      latitude: coords.lat.toFixed(5),
      longitude: coords.lng.toFixed(5),
    }));
  };

  const previewShop: Shop = useMemo(() => {
    const now = new Date().toISOString();
    const effectivePhone =
      form.phoneNumber.trim() || registeredAccountPhone || currentShop?.phoneNumber || '';
    const parsedLat = form.latitude.trim() ? Number(form.latitude) : undefined;
    const parsedLng = form.longitude.trim() ? Number(form.longitude) : undefined;

    return {
      shopId: currentShop?.shopId ?? 'preview-shop',
      ownerUid: firebaseUser?.uid ?? 'preview-owner',
      name: form.name.trim() || 'Your Shop Name',
      slug: buildShopSlug(form.name || 'your-shop', 'preview'),
      description:
        form.description.trim() ||
        'Describe what your shop offers so customers can reach out directly.',
      logoUrl: validateProductImageUrl(form.logoUrl) ? form.logoUrl : BRAND_ASSETS.logo,
      coverImageUrl: validateProductImageUrl(form.coverImageUrl)
        ? form.coverImageUrl
        : BRAND_ASSETS.banner,
      phoneNumber: effectivePhone,
      ...(form.publishBusinessPhone && form.businessPhoneNumber.trim()
        ? { businessPhoneNumber: form.businessPhoneNumber.trim(), publishBusinessPhone: true }
        : { publishBusinessPhone: false }),
      preferredContactMethod: form.preferredContactMethod,
      mainCategory: form.mainCategory,
      productTypes: form.productTypes,
      region: form.region.trim() || 'Sidama',
      city: form.city.trim() || 'Hawassa',
      ...(form.subCity.trim() ? { subCity: form.subCity.trim() } : {}),
      neighborhood: form.neighborhood,
      address: form.address.trim() || 'Hawassa',
      ...(Number.isFinite(parsedLat) ? { latitude: parsedLat } : {}),
      ...(Number.isFinite(parsedLng) ? { longitude: parsedLng } : {}),
      ...(form.operatingHours.trim() ? { operatingHours: form.operatingHours.trim() } : {}),
      deliveryAvailable: form.deliveryAvailable,
      pickupAvailable: form.pickupAvailable,
      status: currentShop?.status ?? 'approved',
      verificationStatus: currentShop?.verificationStatus ?? 'approved',
      availabilityStatus: form.availabilityStatus,
      isPublished: form.availabilityStatus !== 'inactive',
      traderType: form.mainCategory === 'coffee' ? 'coffee' : 'general',
      rating: currentShop?.rating ?? 5.0,
      reviewCount: currentShop?.reviewCount ?? 0,
      createdAt: currentShop?.createdAt ?? now,
      updatedAt: now,
    };
  }, [form, registeredAccountPhone, currentShop, firebaseUser?.uid]);

  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormErrors({});
    setSubmitError(null);
    setSuccessMsg(null);

    const effectivePhone =
      form.phoneNumber.trim() || registeredAccountPhone;
    const parsedLat = form.latitude.trim() ? Number(form.latitude) : undefined;
    const parsedLng = form.longitude.trim() ? Number(form.longitude) : undefined;

    const validation = validateShopProfilePayload({
      name: form.name,
      description: form.description,
      mainCategory: form.mainCategory,
      productTypes: form.productTypes,
      region: form.region,
      city: form.city,
      subCity: form.subCity,
      neighborhood: form.neighborhood,
      address: form.address,
      phoneNumber: effectivePhone,
      businessPhoneNumber: form.publishBusinessPhone ? form.businessPhoneNumber : undefined,
      publishBusinessPhone: form.publishBusinessPhone,
      preferredContactMethod: form.preferredContactMethod,
      operatingHours: form.operatingHours,
      availabilityStatus: form.availabilityStatus,
      latitude: parsedLat,
      longitude: parsedLng,
      deliveryAvailable: form.deliveryAvailable,
      pickupAvailable: form.pickupAvailable,
    });

    if (!validation.valid) {
      setFormErrors(validation.errors);
      return;
    }

    const now = new Date().toISOString();
    const isAdminCreator = activeRoleView === 'admin';
    const isEditing = mode === 'edit' && Boolean(currentShop);
    const shopId = isEditing ? currentShop!.shopId : `shop-${Date.now()}`;
    const safeLogo = validateProductImageUrl(form.logoUrl)
      ? form.logoUrl
      : currentShop?.logoUrl || BRAND_ASSETS.logo;
    const safeCover =
      form.coverImageUrl.trim() && validateProductImageUrl(form.coverImageUrl)
        ? form.coverImageUrl
        : isEditing
        ? currentShop!.coverImageUrl || BRAND_ASSETS.banner
        : BRAND_ASSETS.banner;

    const shopPayload: Shop = {
      ...(isEditing ? currentShop! : {}),
      shopId,
      ownerUid: isEditing ? currentShop!.ownerUid : firebaseUser?.uid ?? 'seller-applicant',
      name: form.name.trim(),
      slug: buildShopSlug(form.name, shopId),
      description:
        form.description.trim() ||
        `Verified local shop in ${form.neighborhood}, ${form.city.trim() || 'Hawassa'}.`,
      logoUrl: safeLogo,
      coverImageUrl: safeCover,
      phoneNumber: effectivePhone,
      ...(form.publishBusinessPhone && form.businessPhoneNumber.trim()
        ? {
            businessPhoneNumber: form.businessPhoneNumber.trim(),
            publishBusinessPhone: true,
          }
        : {
            publishBusinessPhone: false,
            businessPhoneNumber: undefined,
          }),
      preferredContactMethod: form.preferredContactMethod,
      mainCategory: form.mainCategory,
      productTypes: sanitizeProductTypesList(form.productTypes),
      region: form.region.trim() || 'Sidama',
      city: form.city.trim() || 'Hawassa',
      ...(form.subCity.trim() ? { subCity: form.subCity.trim() } : { subCity: undefined }),
      neighborhood: form.neighborhood,
      address: form.address.trim(),
      ...(parsedLat !== undefined && Number.isFinite(parsedLat) ? { latitude: parsedLat } : {}),
      ...(parsedLng !== undefined && Number.isFinite(parsedLng) ? { longitude: parsedLng } : {}),
      ...(form.operatingHours.trim()
        ? { operatingHours: form.operatingHours.trim() }
        : { operatingHours: undefined }),
      deliveryAvailable: form.deliveryAvailable,
      pickupAvailable: form.pickupAvailable,
      status: isEditing
        ? currentShop!.status
        : isAdminCreator
        ? 'approved'
        : 'pending',
      verificationStatus: isEditing
        ? currentShop!.verificationStatus
        : isAdminCreator
        ? 'approved'
        : 'unverified',
      availabilityStatus: form.availabilityStatus,
      isPublished: isEditing
        ? Boolean(isVerifiedForDirectory && form.availabilityStatus !== 'inactive')
        : Boolean(isAdminCreator && form.availabilityStatus !== 'inactive'),
      traderType: form.mainCategory === 'coffee' ? 'coffee' : 'general',
      rating: isEditing ? currentShop!.rating : 5.0,
      reviewCount: isEditing ? currentShop!.reviewCount : 0,
      createdAt: isEditing ? currentShop!.createdAt : now,
      updatedAt: now,
    };

    setIsSubmitting(true);
    try {
      await saveSellerShop(shopPayload);
      setActiveSellerShopId(shopId);
      setMode('view');
      setShowPreview(false);
      setSuccessMsg(
        isEditing
          ? `Shop profile "${shopPayload.name}" updated.`
          : isAdminCreator
          ? `Shop profile "${shopPayload.name}" created and live in Discover Shops.`
          : `Shop profile "${shopPayload.name}" created. Complete seller verification to publish it in Discover Shops.`
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to save shop profile right now.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (nextStatus: ShopAvailabilityStatus) => {
    if (!currentShop || statusUpdating) return;
    setSubmitError(null);
    setSuccessMsg(null);
    setStatusUpdating(nextStatus);
    try {
      const shouldPublish = Boolean(
        isVerifiedForDirectory && nextStatus !== 'inactive'
      );
      await updateShopAvailabilityStatus(
        currentShop.shopId,
        nextStatus,
        shouldPublish
      );
      setSuccessMsg(
        nextStatus === 'active'
          ? `"${currentShop.name}" is now Active.`
          : nextStatus === 'temporarily_closed'
          ? `"${currentShop.name}" is marked Temporarily Closed.`
          : `"${currentShop.name}" has been deactivated from Discover Shops.`
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to update shop status.'
      );
    } finally {
      setStatusUpdating(null);
    }
  };

  const currentAvailability = currentShop
    ? getShopAvailabilityStatus(currentShop)
    : 'inactive';
  const currentCallable = currentShop ? resolveShopCallablePhone(currentShop) : null;

  return (
    <div className="space-y-4">
      {successMsg && (
        <div className="p-3 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/25 dark:border-[#10B981]/35 text-[#0F4C44] dark:text-[#10B981] text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {submitError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Active Shop Profile Summary & Status Controls */}
      {currentShop && mode === 'view' && (
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] shrink-0">
                <ResilientImage
                  src={currentShop.logoUrl}
                  alt={currentShop.name}
                  fallbackTitle={currentShop.name}
                />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-[#0E2421] dark:text-stone-100 truncate">
                  {currentShop.name}
                </h2>
                <div className="text-[11px] text-[#46635E] dark:text-stone-400 truncate">
                  {t(SHOP_DIR_CATEGORY_TRANSLATION_KEYS[inferShopMainCategory(currentShop)])} ·{' '}
                  {getLocalizedNeighborhood(currentShop.neighborhood, language)}
                </div>
              </div>
            </div>

            {canManageCurrentShop && (
              <button
                type="button"
                onClick={openEditMode}
                className="min-h-[38px] px-3 rounded-xl border border-[#0F4C44]/30 dark:border-[#10B981]/35 bg-[#E5F2EE] dark:bg-[#10B981]/15 text-xs font-semibold text-[#0F4C44] dark:text-[#10B981] flex items-center gap-1.5 shrink-0"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>{t('editShopProfileBtn')}</span>
              </button>
            )}
          </div>

          <p className="text-xs text-[#46635E] dark:text-stone-300 leading-relaxed">
            {currentShop.description}
          </p>

          {(currentShop.productTypes?.length ?? 0) > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {currentShop.productTypes!.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-[10px] font-medium text-[#2B4945] dark:text-stone-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[#46635E] dark:text-stone-300 pt-2 border-t border-[#D2E0DC]/70 dark:border-[#2A3630]">
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
              <span className="tabular-nums truncate">
                {currentCallable?.callable && currentCallable.displayPhone
                  ? currentCallable.displayPhone
                  : t('shopPhoneUnavailable')}
              </span>
            </div>
            {currentShop.operatingHours && (
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                <span className="truncate">{currentShop.operatingHours}</span>
              </div>
            )}
          </div>

          {!isVerifiedForDirectory && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300/80 dark:border-amber-400/30 space-y-2">
              <p className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                {t('shopVerificationRequiredPublishNotice')}
              </p>
              <button
                type="button"
                onClick={onGoToVerification}
                className="min-h-[36px] px-3 rounded-lg bg-[#0F4C44] dark:bg-amber-400 text-[#FCFDFC] dark:text-[#141A17] text-[11px] font-bold inline-flex items-center gap-1.5"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>{t('docVerifyGateBtn')}</span>
              </button>
            </div>
          )}

          {/* Quick Shop Availability Status Controls */}
          {canManageCurrentShop && (
            <div className="pt-2.5 border-t border-[#D2E0DC]/70 dark:border-[#2A3630] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#0F4C44] dark:text-stone-200">
                <span className="flex items-center gap-1.5">
                  <Power className="w-3.5 h-3.5" />
                  <span>{t('shopAvailabilityLabel')}</span>
                </span>
                <span className="capitalize font-bold">
                  {currentAvailability === 'active'
                    ? t('shopStatusActive')
                    : currentAvailability === 'temporarily_closed'
                    ? t('shopStatusTempClosed')
                    : t('shopStatusInactive')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    { id: 'active', label: t('shopActivateBtn') },
                    { id: 'temporarily_closed', label: t('shopTempCloseBtn') },
                    { id: 'inactive', label: t('shopDeactivateBtn') },
                  ] as const
                ).map((action) => {
                  const isCurrent = currentAvailability === action.id;
                  const disabledForUnverified =
                    !isVerifiedForDirectory && action.id !== 'inactive';
                  return (
                    <button
                      key={action.id}
                      type="button"
                      disabled={Boolean(statusUpdating) || disabledForUnverified}
                      onClick={() => handleQuickStatusChange(action.id)}
                      className={`min-h-[38px] px-2 rounded-xl border text-[11px] font-semibold transition-colors disabled:opacity-50 ${
                        isCurrent
                          ? action.id === 'active'
                            ? 'bg-[#0F4C44] dark:bg-[#10B981] text-[#FCFDFC] dark:text-[#0B1410] border-[#0F4C44] dark:border-[#10B981]'
                            : action.id === 'temporarily_closed'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-stone-700 text-white border-stone-700'
                          : 'bg-[#F3F6F4] dark:bg-[#141A17] text-[#2B4945] dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630] hover:border-[#0F4C44]/50'
                      }`}
                    >
                      {statusUpdating === action.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                      ) : (
                        action.label
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Customer View / Preview Actions */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="min-h-[40px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs font-semibold text-[#0F4C44] dark:text-stone-200 flex items-center justify-center gap-1.5"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? t('hideShopPreviewBtn') : t('previewShopProfileBtn')}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate({ name: 'shop', shopId: currentShop.shopId })}
              className="min-h-[40px] px-3 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] text-[#FCFDFC] dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span>{t('viewShopBtn')}</span>
            </button>
          </div>

          {showPreview && (
            <div className="pt-2 space-y-2 border-t border-[#D2E0DC] dark:border-[#2A3630]">
              <div className="text-[11px] font-bold text-[#0F4C44] dark:text-[#00D68F]">
                {t('shopProfilePreviewTitle')}
              </div>
              <DiscoverShopCard shop={currentShop} isPreview />
            </div>
          )}
        </section>
      )}

      {/* Button to Create Another Shop Profile when viewing existing shop */}
      {currentShop && mode === 'view' && (
        <button
          type="button"
          onClick={openCreateMode}
          className="w-full min-h-[44px] px-4 rounded-2xl border border-dashed border-[#0F4C44]/40 dark:border-[#10B981]/40 bg-[#E5F2EE]/50 dark:bg-[#10B981]/10 hover:bg-[#E5F2EE] dark:hover:bg-[#10B981]/15 text-[#0F4C44] dark:text-[#10B981] text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>{t('createShopProfileBtn')}</span>
        </button>
      )}

      {/* Create / Edit Shop Profile Form */}
      {(mode === 'create' || mode === 'edit') && (
        <form
          onSubmit={handleSubmitProfile}
          className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981] shrink-0" />
                <h2 className="text-sm font-bold text-[#0E2421] dark:text-stone-100">
                  {mode === 'edit' ? t('editShopProfileBtn') : t('createShopProfileBtn')}
                </h2>
              </div>
              <p className="text-[11px] text-[#46635E] dark:text-stone-400 mt-0.5 leading-relaxed">
                {t('createShopProfileSubtitle')}
              </p>
            </div>
            {currentShop && (
              <button
                type="button"
                onClick={() => {
                  setMode('view');
                  setFormErrors({});
                  setSubmitError(null);
                }}
                className="min-h-[34px] px-2.5 rounded-lg border border-[#D2E0DC] dark:border-[#2A3630] text-xs font-semibold text-[#46635E] dark:text-stone-300"
              >
                {t('cancel')}
              </button>
            )}
          </div>

          {/* Shop Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
              Shop Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Sidama Highland Coffee Roasters"
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 focus:outline-none focus:border-[#0F4C44] dark:focus:border-[#10B981]"
            />
            {formErrors.name && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{formErrors.name}</p>
            )}
          </div>

          {/* Main Shop Category */}
          <div>
            <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
              {t('shopMainCategoryLabel')} *
            </label>
            <select
              value={form.mainCategory}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  mainCategory: e.target.value,
                }))
              }
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 focus:outline-none focus:border-[#0F4C44] dark:focus:border-[#10B981]"
            >
              {SHOP_DIRECTORY_CATEGORIES.map((cat) => (
                <option key={cat.slug} value={cat.slug}>
                  {t(cat.labelKey)}
                </option>
              ))}
            </select>
          </div>

          {/* Types of Products Sold */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300">
              {t('shopProductTypesLabel')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.productTypeInput}
                onChange={(e) => setForm((p) => ({ ...p, productTypeInput: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addProductTypeTag();
                  }
                }}
                placeholder={t('shopProductTypesPlaceholder')}
                className="flex-1 min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 focus:outline-none focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
              <button
                type="button"
                onClick={addProductTypeTag}
                className="min-h-[42px] px-3.5 rounded-xl bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/25 dark:border-[#10B981]/35 text-[#0F4C44] dark:text-[#10B981] text-xs font-bold shrink-0"
              >
                {t('shopProductTypesAddBtn')}
              </button>
            </div>
            <p className="text-[10px] text-[#5E7B76] dark:text-stone-400">
              {t('shopProductTypesHint')}
            </p>
            {formErrors.productTypes && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                {formErrors.productTypes}
              </p>
            )}
            {form.productTypes.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {form.productTypes.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#E5F2EE] dark:bg-[#10B981]/15 border border-[#0F4C44]/20 dark:border-[#10B981]/30 text-[11px] font-medium text-[#0F4C44] dark:text-[#10B981]"
                  >
                    <Tag className="w-3 h-3 shrink-0" />
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => removeProductTypeTag(tag)}
                      aria-label={`Remove ${tag}`}
                      className="p-0.5 hover:text-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Shop Description */}
          <div>
            <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
              Shop Description *
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Tell customers about your shop, quality standards, wholesale/retail options, and specialties..."
              className="w-full p-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 focus:outline-none focus:border-[#0F4C44] dark:focus:border-[#10B981]"
            />
            {formErrors.description && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                {formErrors.description}
              </p>
            )}
          </div>

          {/* Location Fields: Region, City, Sub-City, Neighborhood, Specific Address */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                {t('shopRegionLabel')}
              </label>
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm((p) => ({ ...p, region: e.target.value }))}
                placeholder="Sidama"
                className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                {t('shopCityLabel')}
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
                placeholder="Hawassa"
                className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                {t('shopSubCityLabel')}
              </label>
              <input
                type="text"
                value={form.subCity}
                onChange={(e) => setForm((p) => ({ ...p, subCity: e.target.value }))}
                placeholder="e.g. Tabor, Hayk Dar"
                className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                {t('selectNeighborhood')} *
              </label>
              <select
                value={form.neighborhood}
                onChange={(e) => setForm((p) => ({ ...p, neighborhood: e.target.value }))}
                className="w-full min-h-[42px] px-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
              >
                {HAWASSA_NEIGHBORHOODS.map((n) => (
                  <option key={n} value={n}>
                    {getLocalizedNeighborhood(n, language)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
              Specific Location / Landmark *
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
              placeholder="e.g. Piazza Main Road, Building B, Shop #12"
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
            />
            {formErrors.address && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                {formErrors.address}
              </p>
            )}
          </div>

          {/* Optional Map Coordinates */}
          <div className="p-3 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0F4C44] dark:text-[#10B981]" />
                <span>{t('shopCoordinatesLabel')}</span>
              </span>
              <button
                type="button"
                onClick={handleUseNeighborhoodCoords}
                className="text-[10px] font-bold text-[#0F4C44] dark:text-[#10B981] hover:underline"
              >
                Use {getLocalizedNeighborhood(form.neighborhood, language)} Pin
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={form.latitude}
                onChange={(e) => setForm((p) => ({ ...p, latitude: e.target.value }))}
                placeholder="Latitude (e.g. 7.0510)"
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] text-xs text-[#0E2421] dark:text-stone-100 tabular-nums"
              />
              <input
                type="text"
                inputMode="decimal"
                value={form.longitude}
                onChange={(e) => setForm((p) => ({ ...p, longitude: e.target.value }))}
                placeholder="Longitude (e.g. 38.4763)"
                className="w-full min-h-[38px] px-2.5 rounded-lg border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] text-xs text-[#0E2421] dark:text-stone-100 tabular-nums"
              />
            </div>
            {(formErrors.coordinates || formErrors.latitude || formErrors.longitude) && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400">
                {formErrors.coordinates || formErrors.latitude || formErrors.longitude}
              </p>
            )}
          </div>

          {/* Opening Hours (Optional) */}
          <div>
            <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
              {t('shopOpeningHoursLabel')} (Optional)
            </label>
            <input
              type="text"
              value={form.operatingHours}
              onChange={(e) => setForm((p) => ({ ...p, operatingHours: e.target.value }))}
              placeholder="e.g. Mon–Sat 8:00 AM – 7:00 PM"
              className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
            />
          </div>

          {/* Registered Owner Phone & Optional Business Phone */}
          <div className="p-3 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] space-y-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] mb-1">
                {t('shopRegisteredPhoneLabel')}
              </label>
              <input
                type="tel"
                value={form.phoneNumber}
                onChange={(e) => setForm((p) => ({ ...p, phoneNumber: e.target.value }))}
                readOnly={Boolean(registeredAccountPhone)}
                placeholder="+251 9X XXX XXXX"
                className={`w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] text-xs tabular-nums ${
                  registeredAccountPhone
                    ? 'bg-[#E7F1ED]/70 dark:bg-[#092825] text-[#0E2421] dark:text-stone-200 font-semibold'
                    : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100'
                }`}
              />
              <p className="text-[10px] text-[#5E7B76] dark:text-stone-400 mt-1">
                {t('shopRegisteredPhoneHint')}
              </p>
              {formErrors.phoneNumber && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                  {formErrors.phoneNumber}
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-[11px] font-semibold text-[#2B4945] dark:text-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={form.publishBusinessPhone}
                onChange={(e) =>
                  setForm((p) => ({ ...p, publishBusinessPhone: e.target.checked }))
                }
                className="accent-[#0F4C44] dark:accent-[#10B981]"
              />
              <span>{t('shopPublishBusinessPhoneToggle')}</span>
            </label>

            {form.publishBusinessPhone && (
              <div>
                <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                  {t('shopBusinessPhoneLabel')}
                </label>
                <input
                  type="tel"
                  value={form.businessPhoneNumber}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, businessPhoneNumber: e.target.value }))
                  }
                  placeholder="+251 9X XXX XXXX"
                  className="w-full min-h-[42px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] text-xs text-[#0E2421] dark:text-stone-100 tabular-nums"
                />
                {formErrors.businessPhoneNumber && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                    {formErrors.businessPhoneNumber}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Preferred Contact Method & Shop Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                {t('shopPreferredContactLabel')}
              </label>
              <select
                value={form.preferredContactMethod}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    preferredContactMethod: e.target.value as PreferredContactMethod,
                  }))
                }
                className="w-full min-h-[42px] px-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
              >
                <option value="both">{t('shopPreferredContactBoth')}</option>
                <option value="phone">{t('shopPreferredContactPhone')}</option>
                <option value="chat">{t('shopPreferredContactChat')}</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#2B4945] dark:text-stone-300 mb-1">
                {t('shopAvailabilityLabel')}
              </label>
              <select
                value={form.availabilityStatus}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    availabilityStatus: e.target.value as ShopAvailabilityStatus,
                  }))
                }
                className="w-full min-h-[42px] px-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100"
              >
                <option value="active">{t('shopStatusActive')}</option>
                <option value="temporarily_closed">{t('shopStatusTempClosed')}</option>
                <option value="inactive">{t('shopStatusInactive')}</option>
              </select>
            </div>
          </div>

          {/* Fulfillment Options */}
          <div className="grid grid-cols-2 gap-2">
            <label className="min-h-[40px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] flex items-center gap-2 text-xs text-[#0E2421] dark:text-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={form.deliveryAvailable}
                onChange={(e) =>
                  setForm((p) => ({ ...p, deliveryAvailable: e.target.checked }))
                }
                className="accent-[#0F4C44] dark:accent-[#10B981]"
              />
              <span>{t('deliveryAvailable')}</span>
            </label>
            <label className="min-h-[40px] px-3 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] flex items-center gap-2 text-xs text-[#0E2421] dark:text-stone-200 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pickupAvailable}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pickupAvailable: e.target.checked }))
                }
                className="accent-[#0F4C44] dark:accent-[#10B981]"
              />
              <span>{t('pickupAvailable')}</span>
            </label>
          </div>
          {formErrors.fulfillment && (
            <p className="text-[11px] text-rose-600 dark:text-rose-400">
              {formErrors.fulfillment}
            </p>
          )}

          {/* Logo & Optional Cover Uploads */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] shrink-0">
                  <ResilientImage src={form.logoUrl} alt="Shop logo preview" />
                </div>
                <span className="text-[11px] font-semibold text-[#2B4945] dark:text-stone-200 truncate">
                  {t('shopLogoImageLabel')}
                </span>
              </div>
              <label className="min-h-[34px] px-2.5 rounded-lg border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] inline-flex items-center gap-1 cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'logoUrl')}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17]">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] flex items-center justify-center shrink-0">
                  {form.coverImageUrl ? (
                    <ResilientImage src={form.coverImageUrl} alt="Shop cover preview" />
                  ) : (
                    <ImageIcon className="w-4 h-4 text-[#5E7B76]" />
                  )}
                </div>
                <span className="text-[11px] font-semibold text-[#2B4945] dark:text-stone-200 truncate">
                  {t('shopCoverImageLabel')}
                </span>
              </div>
              <label className="min-h-[34px] px-2.5 rounded-lg border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] inline-flex items-center gap-1 cursor-pointer shrink-0">
                <Upload className="w-3.5 h-3.5" />
                <span>Upload</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'coverImageUrl')}
                  className="sr-only"
                />
              </label>
            </div>
          </div>

          {/* Live Customer Preview Toggle */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="w-full min-h-[40px] px-3 rounded-xl border border-[#BFD6CE] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-[#0F4C44] dark:text-[#10B981] text-xs font-semibold flex items-center justify-center gap-1.5"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? t('hideShopPreviewBtn') : t('previewShopProfileBtn')}</span>
            </button>

            {showPreview && (
              <div className="p-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#031719] border border-[#D2E0DC] dark:border-[#14443F] space-y-2">
                <div className="text-[11px] font-bold text-[#0F4C44] dark:text-[#00D68F]">
                  {t('shopProfilePreviewTitle')}
                </div>
                <DiscoverShopCard shop={previewShop} isPreview />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] dark:from-[#00D68F] dark:to-[#00C8D7] hover:brightness-105 disabled:opacity-60 text-[#FCFDFC] dark:text-[#031719] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
            <span>
              {isSubmitting
                ? t('saving')
                : mode === 'edit'
                ? 'Save Shop Profile Changes'
                : t('createShopProfileBtn')}
            </span>
          </button>
        </form>
      )}
    </div>
  );
};
