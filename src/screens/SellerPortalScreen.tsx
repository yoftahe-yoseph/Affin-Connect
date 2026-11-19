import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Archive,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Coffee,
  FileCheck2,
  Loader2,
  Lock,
  MessageSquare,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  Upload,
  Video,
  X,
  XCircle,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { BRAND_ASSETS } from '../data/seedData';
import { EmptyState, OrderStatusBadge, ResilientImage } from '../components/SharedUI';
import { getLocalizedNeighborhood } from '../constants/translations';
import {
  buildShopSlug,
  canShopListProducts,
  classifyProductCoffeeCategory,
  COFFEE_BEAN_FORMS,
  COFFEE_CATEGORY_SLUG,
  COFFEE_PACKAGE_WEIGHTS,
  COFFEE_PROCESSING_METHODS,
  COFFEE_PRODUCT_TYPE_SUGGESTIONS,
  COFFEE_ROAST_LEVELS,
  ETHIOPIAN_COFFEE_ORIGINS,
  formatETB,
  formatFriendlyErrorMessage,
  getEffectiveShopVerificationStatus,
  HAWASSA_ISSUING_AUTHORITIES,
  HAWASSA_NEIGHBORHOODS,
  normalizeProductCategory,
  resolveSellerManagedShops,
  validateCoffeeDetailsInput,
  validateMerchantVerificationInput,
  validateProductImageUrl,
  validateProductInput,
  validateShopInput,
} from '../utils/marketplaceLogic';
import { ProductCategorizationApiError } from '../services/marketplaceService';
import {
  compressImageSourceToDataUrl,
  estimateDataUrlByteSize,
  formatImageByteSize,
  processUploadedPhotoFile,
} from '../utils/imageUpload';
import type {
  CoffeeBeanForm,
  CoffeeProcessMethod,
  CoffeeRoastLevel,
  OrderStatus,
  Product,
  TraderType,
} from '../types';

type SellerTabId = 'dashboard' | 'orders' | 'products' | 'verification' | 'shop';

export const SellerPortalScreen: React.FC<{
  tab?: SellerTabId;
}> = ({ tab = 'dashboard' }) => {
  const {
    navigate,
    firebaseUser,
    activeRoleView,
    shops,
    products,
    categories,
    sellerOrders,
    activeSellerShopId,
    setActiveSellerShopId,
    getShopVerification,
    submitMerchantVerification,
    updateOrderStatus,
    saveSellerProduct,
    saveSellerShop,
    openOrderChat,
    openTradeChatInbox,
    tradeChats,
    language,
    t,
  } = useMarketplace();

  const [activeTab, setActiveTab] = useState<SellerTabId>(tab);
  useEffect(() => {
    if (tab) setActiveTab(tab);
  }, [tab]);

  const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [pinInputs, setPinInputs] = useState<Record<string, string>>({});
  const [pinErrors, setPinErrors] = useState<Record<string, string>>({});

  // Product Form State
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodPreviousPrice, setProdPreviousPrice] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodCategory, setProdCategory] = useState(categories[0]?.slug ?? 'groceries');
  const [prodProductType, setProdProductType] = useState('');
  const [ambiguousConfirmedTarget, setAmbiguousConfirmedTarget] = useState<
    null | 'coffee' | 'non_coffee'
  >(null);
  const [prodDesc, setProdDesc] = useState('');
  const [prodImageUrl, setProdImageUrl] = useState('');
  const [prodDeliveryAvailable, setProdDeliveryAvailable] = useState(true);
  const [prodPickupAvailable, setProdPickupAvailable] = useState(true);
  // Conditional Coffee-Specific Product Fields (only used when prodCategory === 'coffee')
  const [coffeeOrigin, setCoffeeOrigin] = useState<string>('Sidama');
  const [coffeeBrand, setCoffeeBrand] = useState<string>('');
  const [coffeeRoastLevel, setCoffeeRoastLevel] = useState<CoffeeRoastLevel>('medium');
  const [coffeeProcessMethod, setCoffeeProcessMethod] = useState<CoffeeProcessMethod>('washed');
  const [coffeeBeanForm, setCoffeeBeanForm] = useState<CoffeeBeanForm>('whole_bean');
  const [coffeeWeight, setCoffeeWeight] = useState<string>('500g');
  const [coffeeRoastDate, setCoffeeRoastDate] = useState<string>('');
  const [prodErrors, setProdErrors] = useState<Record<string, string>>({});
  const [prodSubmitError, setProdSubmitError] = useState<string | null>(null);
  const [prodSuccessMsg, setProdSuccessMsg] = useState<string | null>(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isProcessingProductPhoto, setIsProcessingProductPhoto] = useState(false);
  const [productCameraOpen, setProductCameraOpen] = useState(false);
  const [productCameraError, setProductCameraError] = useState<string | null>(null);
  const productVideoRef = useRef<HTMLVideoElement | null>(null);
  const productStreamRef = useRef<MediaStream | null>(null);

  // Virtual Shop Creation & Editing State
  const [isCreatingShop, setIsCreatingShop] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopDescription, setNewShopDescription] = useState('');
  const [newShopNeighborhood, setNewShopNeighborhood] = useState<string>(HAWASSA_NEIGHBORHOODS[0]);
  const [newShopAddress, setNewShopAddress] = useState('');
  const [newShopPhone, setNewShopPhone] = useState('');
  const [newShopLogoUrl, setNewShopLogoUrl] = useState(BRAND_ASSETS.logo);
  const [newShopTraderType, setNewShopTraderType] = useState<TraderType>('general');
  const [newShopDeliveryAvailable, setNewShopDeliveryAvailable] = useState(true);
  const [newShopPickupAvailable, setNewShopPickupAvailable] = useState(true);
  const [shopFormErrors, setShopFormErrors] = useState<Record<string, string>>({});
  const [shopCreateError, setShopCreateError] = useState<string | null>(null);
  const [shopSavedMsg, setShopSavedMsg] = useState<string | null>(null);

  const [isEditingCurrentShop, setIsEditingCurrentShop] = useState(false);
  const [isUpdatingShop, setIsUpdatingShop] = useState(false);
  const [editShopName, setEditShopName] = useState('');
  const [editShopDesc, setEditShopDesc] = useState('');
  const [editShopNeighborhood, setEditShopNeighborhood] = useState<string>(HAWASSA_NEIGHBORHOODS[0]);
  const [editShopAddress, setEditShopAddress] = useState('');
  const [editShopPhone, setEditShopPhone] = useState('');
  const [editShopLogoUrl, setEditShopLogoUrl] = useState(BRAND_ASSETS.logo);
  const [editShopTraderType, setEditShopTraderType] = useState<TraderType>('general');
  const [editShopDelivery, setEditShopDelivery] = useState(true);
  const [editShopPickup, setEditShopPickup] = useState(true);
  const [editShopErrors, setEditShopErrors] = useState<Record<string, string>>({});
  const [editShopError, setEditShopError] = useState<string | null>(null);

  const managedShops = resolveSellerManagedShops(
    shops,
    firebaseUser?.uid,
    activeRoleView === 'admin'
  );
  const currentShop =
    managedShops.find((s) => s.shopId === activeSellerShopId) ?? managedShops[0] ?? null;
  const currentVerification = currentShop ? getShopVerification(currentShop.shopId) : null;
  const docStatus = getEffectiveShopVerificationStatus(currentShop, currentVerification);
  const isListingUnlocked = Boolean(
    currentShop &&
      (activeRoleView === 'admin' || canShopListProducts(currentShop, currentVerification))
  );

  // Document Verification Form State
  const [businessLegalName, setBusinessLegalName] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [tinNumber, setTinNumber] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState<string>(HAWASSA_ISSUING_AUTHORITIES[0]);
  const [expiryDate, setExpiryDate] = useState('');
  const [licenseImageDataUrl, setLicenseImageDataUrl] = useState<string | undefined>(undefined);
  const [documentFileName, setDocumentFileName] = useState<string | undefined>(undefined);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [docSubmitError, setDocSubmitError] = useState<string | null>(null);
  const [docSubmitSuccess, setDocSubmitSuccess] = useState<string | null>(null);
  const [docSubmitting, setDocSubmitting] = useState(false);

  // Camera state for business license capture
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
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

  const stopProductCameraStream = () => {
    if (productStreamRef.current) {
      for (const track of productStreamRef.current.getTracks()) {
        track.stop();
      }
      productStreamRef.current = null;
    }
    if (productVideoRef.current) {
      productVideoRef.current.srcObject = null;
    }
    setProductCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop();
        }
        streamRef.current = null;
      }
      if (productStreamRef.current) {
        for (const track of productStreamRef.current.getTracks()) {
          track.stop();
        }
        productStreamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [cameraOpen]);

  useEffect(() => {
    if (productCameraOpen && productVideoRef.current && productStreamRef.current) {
      productVideoRef.current.srcObject = productStreamRef.current;
      void productVideoRef.current.play().catch(() => {});
    }
  }, [productCameraOpen]);

  // Sync verification form values when switching active shop or loading record
  useEffect(() => {
    setDocErrors({});
    setDocSubmitError(null);
    setDocSubmitSuccess(null);
    stopCameraStream();
    if (currentVerification) {
      setBusinessLegalName(currentVerification.businessLegalName);
      setLicenseNumber(currentVerification.licenseNumber);
      setTinNumber(currentVerification.tinNumber ?? '');
      setIssuingAuthority(currentVerification.issuingAuthority);
      setExpiryDate(currentVerification.expiryDate ?? '');
      setLicenseImageDataUrl(currentVerification.licenseImageDataUrl);
      setDocumentFileName(currentVerification.documentFileName);
    } else {
      setBusinessLegalName(currentShop?.name ?? '');
      setLicenseNumber('');
      setTinNumber('');
      setIssuingAuthority(HAWASSA_ISSUING_AUTHORITIES[0]);
      setExpiryDate('');
      setLicenseImageDataUrl(undefined);
      setDocumentFileName(undefined);
    }
    setShowProductForm(false);
    setProdSubmitError(null);
    setProdSuccessMsg(null);
    setIsEditingCurrentShop(false);
    setEditShopError(null);
    setEditShopErrors({});
    if (currentShop) {
      setEditShopName(currentShop.name);
      setEditShopDesc(currentShop.description);
      setEditShopNeighborhood(currentShop.neighborhood);
      setEditShopAddress(currentShop.address);
      setEditShopPhone(currentShop.phoneNumber);
      setEditShopLogoUrl(currentShop.logoUrl || BRAND_ASSETS.logo);
      setEditShopTraderType(currentShop.traderType === 'coffee' ? 'coffee' : 'general');
      setEditShopDelivery(currentShop.deliveryAvailable);
      setEditShopPickup(currentShop.pickupAvailable);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentShop?.shopId, currentVerification?.verificationId, currentVerification?.updatedAt]);

  const shopProducts = products.filter((p) => p.shopId === currentShop?.shopId);
  const activeProductsCount = shopProducts.filter((p) => p.status === 'active').length;
  const lowStockCount = shopProducts.filter((p) => p.stock <= 5 && p.status === 'active').length;
  const pendingOrders = sellerOrders.filter((o) => o.orderStatus === 'pending');
  const totalSales = sellerOrders
    .filter((o) => o.orderStatus !== 'rejected' && o.orderStatus !== 'canceled')
    .reduce((acc, o) => acc + o.totalAmount, 0);

  const openCreateForm = () => {
    if (!currentShop) {
      setActiveTab('shop');
      return;
    }
    if (!isListingUnlocked) {
      setActiveTab('verification');
      return;
    }
    stopProductCameraStream();
    setProductCameraError(null);
    setEditingProductId(null);
    setProdName('');
    setProdPrice('');
    setProdPreviousPrice('');
    setProdStock('10');
    setProdCategory(
      currentShop.traderType === 'coffee'
        ? COFFEE_CATEGORY_SLUG
        : categories[0]?.slug ?? 'groceries'
    );
    setProdProductType(currentShop.traderType === 'coffee' ? 'Roasted Coffee' : '');
    setAmbiguousConfirmedTarget(null);
    setProdDesc('');
    setProdImageUrl(
      currentShop.logoUrl && validateProductImageUrl(currentShop.logoUrl)
        ? currentShop.logoUrl
        : BRAND_ASSETS.coffee
    );
    setProdDeliveryAvailable(currentShop.deliveryAvailable ?? true);
    setProdPickupAvailable(currentShop.pickupAvailable ?? true);
    setCoffeeOrigin('Sidama');
    setCoffeeBrand(currentShop.name);
    setCoffeeRoastLevel('medium');
    setCoffeeProcessMethod('washed');
    setCoffeeBeanForm('whole_bean');
    setCoffeeWeight('500g');
    setCoffeeRoastDate('');
    setProdErrors({});
    setProdSubmitError(null);
    setProdSuccessMsg(null);
    setShowProductForm(true);
  };

  const openEditForm = (p: Product) => {
    if (!currentShop) {
      setActiveTab('shop');
      return;
    }
    if (!isListingUnlocked) {
      setActiveTab('verification');
      return;
    }
    stopProductCameraStream();
    setProductCameraError(null);
    setEditingProductId(p.productId);
    setProdName(p.name);
    setProdPrice(String(p.price));
    setProdPreviousPrice(p.previousPrice ? String(p.previousPrice) : '');
    setProdStock(String(p.stock));
    setProdCategory(normalizeProductCategory(p.category) || p.category);
    setProdProductType(p.productType ?? '');
    setAmbiguousConfirmedTarget(null);
    setProdDesc(p.description);
    setProdImageUrl(p.imageUrl);
    setProdDeliveryAvailable(p.deliveryAvailable);
    setProdPickupAvailable(p.pickupAvailable);
    setCoffeeOrigin(p.coffeeDetails?.origin ?? 'Sidama');
    setCoffeeBrand(p.coffeeDetails?.brand ?? currentShop.name);
    setCoffeeRoastLevel(p.coffeeDetails?.roastLevel ?? 'medium');
    setCoffeeProcessMethod(p.coffeeDetails?.processingMethod ?? 'washed');
    setCoffeeBeanForm(p.coffeeDetails?.beanForm ?? 'whole_bean');
    setCoffeeWeight(p.coffeeDetails?.packageWeight ?? '500g');
    setCoffeeRoastDate(p.coffeeDetails?.roastDate ?? '');
    setProdErrors({});
    setProdSubmitError(null);
    setProdSuccessMsg(null);
    setShowProductForm(true);
  };

  // Live automatic coffee categorization preview strictly from structured fields
  // (product name, category, productType) — never from free-text description.
  const categorizationPreview = useMemo(() => {
    const confirmedCategoryValue =
      ambiguousConfirmedTarget === 'coffee'
        ? COFFEE_CATEGORY_SLUG
        : ambiguousConfirmedTarget === 'non_coffee'
          ? prodCategory === COFFEE_CATEGORY_SLUG
            ? 'home-living'
            : prodCategory
          : undefined;
    return classifyProductCoffeeCategory({
      name: prodName,
      category: prodCategory,
      productType: prodProductType,
      categoryConfirmed: ambiguousConfirmedTarget !== null,
      confirmedCategory: confirmedCategoryValue,
    });
  }, [prodName, prodCategory, prodProductType, ambiguousConfirmedTarget]);

  const effectiveIsCoffeeListing = categorizationPreview.outcome === 'coffee';

  const handleProductPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProdSubmitError(null);
    setProductCameraError(null);
    setIsProcessingProductPhoto(true);
    try {
      const processed = await processUploadedPhotoFile(file);
      setProdImageUrl(processed);
      stopProductCameraStream();
    } catch (err) {
      setProdSubmitError(
        formatFriendlyErrorMessage(err, t('imageSizeTooLargeError'))
      );
    } finally {
      setIsProcessingProductPhoto(false);
    }
  };

  const handleOpenProductCamera = async () => {
    setProductCameraError(null);
    setProdSubmitError(null);
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setProductCameraError(t('returnCameraUnavailable'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      productStreamRef.current = stream;
      setProductCameraOpen(true);
    } catch {
      setProductCameraError(t('returnCameraUnavailable'));
    }
  };

  const handleCaptureProductCameraFrame = () => {
    const video = productVideoRef.current;
    if (!video) return;
    setIsProcessingProductPhoto(true);
    try {
      const width = video.videoWidth || 800;
      const height = video.videoHeight || 600;
      const captured = compressImageSourceToDataUrl(video, width, height);
      setProdImageUrl(captured);
      setProductCameraError(null);
      setProdSubmitError(null);
      stopProductCameraStream();
    } catch (err) {
      setProductCameraError(
        formatFriendlyErrorMessage(err, t('returnCameraUnavailable'))
      );
      stopProductCameraStream();
    } finally {
      setIsProcessingProductPhoto(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop || isSavingProduct || isProcessingProductPhoto) return;
    setProdSubmitError(null);
    setProdSuccessMsg(null);
    setProdErrors({});

    if (!isListingUnlocked) {
      setProdSubmitError(t('docVerifyGateDesc'));
      return;
    }

    const parsedPrice = Number(prodPrice);
    const parsedStock = Number(prodStock);
    const errs = validateProductInput({
      name: prodName,
      price: parsedPrice,
      stock: parsedStock,
      category: prodCategory,
      description: prodDesc,
    });
    if (!prodDeliveryAvailable && !prodPickupAvailable) {
      errs.fulfillment = 'Enable delivery or in-shop pickup for this product.';
    }

    if (categorizationPreview.outcome === 'conflict') {
      setProdSubmitError(categorizationPreview.reason);
      return;
    }
    if (
      categorizationPreview.outcome === 'ambiguous' &&
      categorizationPreview.requiresConfirmation
    ) {
      setProdSubmitError(
        'Please confirm below whether this product belongs in Coffee Traders or a general category before publishing.'
      );
      return;
    }

    const isCoffeeListing = categorizationPreview.outcome === 'coffee';
    let validatedCoffeeDetails: Product['coffeeDetails'] | undefined;
    if (isCoffeeListing) {
      const coffeeCheck = validateCoffeeDetailsInput({
        origin: coffeeOrigin,
        brand: coffeeBrand,
        roastLevel: coffeeRoastLevel,
        processingMethod: coffeeProcessMethod,
        beanForm: coffeeBeanForm,
        packageWeight: coffeeWeight,
        roastDate: coffeeRoastDate || undefined,
      });
      Object.assign(errs, coffeeCheck.errors);
      validatedCoffeeDetails = coffeeCheck.sanitized;
    }

    if (Object.keys(errs).length > 0) {
      setProdErrors(errs);
      return;
    }

    const existing = editingProductId
      ? products.find((p) => p.productId === editingProductId)
      : undefined;

    const candidateUrl = prodImageUrl.trim();
    const fallbackUrl =
      existing?.imageUrl ||
      (currentShop.logoUrl && validateProductImageUrl(currentShop.logoUrl)
        ? currentShop.logoUrl
        : BRAND_ASSETS.coffee);
    const finalImageUrl = candidateUrl || fallbackUrl;

    if (!validateProductImageUrl(finalImageUrl)) {
      setProdSubmitError(
        candidateUrl.startsWith('http://')
          ? 'Image URL must use https:// or upload a JPG/PNG/WebP photo under 150 KB.'
          : t('imageSizeTooLargeError')
      );
      return;
    }

    const parsedComparePrice = prodPreviousPrice.trim() ? Number(prodPreviousPrice) : undefined;
    const roundedPrice = Math.round(parsedPrice);
    const resolvedPreviousPrice =
      parsedComparePrice && Number.isFinite(parsedComparePrice) && parsedComparePrice > roundedPrice
        ? Math.round(parsedComparePrice)
        : existing && roundedPrice < existing.price
          ? existing.price
          : undefined;

    const now = new Date().toISOString();
    const trimmedProductType = prodProductType.trim();
    const product: Product = {
      productId:
        existing?.productId ??
        `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      shopId: currentShop.shopId,
      shopName: currentShop.name,
      name: prodName.trim(),
      description: prodDesc.trim(),
      category: prodCategory,
      ...(trimmedProductType ? { productType: trimmedProductType } : {}),
      price: roundedPrice,
      ...(resolvedPreviousPrice !== undefined ? { previousPrice: resolvedPreviousPrice } : {}),
      stock: Math.floor(parsedStock),
      isAvailable: Math.floor(parsedStock) > 0,
      imageUrl: finalImageUrl,
      ...(validatedCoffeeDetails ? { coffeeDetails: validatedCoffeeDetails } : {}),
      pickupAvailable: prodPickupAvailable,
      deliveryAvailable: prodDeliveryAvailable,
      status: 'active',
      ...(existing?.rating !== undefined ? { rating: existing.rating } : {}),
      ...(existing?.reviewCount !== undefined ? { reviewCount: existing.reviewCount } : {}),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    const confirmedCategoryArg =
      ambiguousConfirmedTarget === 'coffee'
        ? COFFEE_CATEGORY_SLUG
        : ambiguousConfirmedTarget === 'non_coffee'
          ? prodCategory === COFFEE_CATEGORY_SLUG
            ? 'home-living'
            : prodCategory
          : undefined;

    setIsSavingProduct(true);
    try {
      const saved = await saveSellerProduct(product, {
        categoryConfirmed: ambiguousConfirmedTarget !== null,
        confirmedCategory: confirmedCategoryArg,
      });
      stopProductCameraStream();
      setShowProductForm(false);
      setAmbiguousConfirmedTarget(null);
      const destinationLabel =
        saved.product.category === COFFEE_CATEGORY_SLUG
          ? 'Coffee Traders'
          : currentShop.name;
      setProdSuccessMsg(
        existing
          ? `Updated "${saved.product.name}" (${saved.product.category === COFFEE_CATEGORY_SLUG ? 'Coffee Traders' : saved.product.category}).`
          : saved.categorization.autoAssigned
            ? `Published "${saved.product.name}" — automatically categorized into Coffee Traders!`
            : `Published "${saved.product.name}" to ${destinationLabel}!`
      );
    } catch (err) {
      if (err instanceof ProductCategorizationApiError) {
        setProdSubmitError(err.message);
      } else {
        setProdSubmitError(
          formatFriendlyErrorMessage(err, 'Unable to save product listing.')
        );
      }
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleToggleProductStatus = async (product: Product) => {
    if (!isListingUnlocked) return;
    setProdSubmitError(null);
    setProdSuccessMsg(null);
    const nextStatus = product.status === 'active' ? 'archived' : 'active';
    try {
      await saveSellerProduct({
        ...product,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      setProdSuccessMsg(
        nextStatus === 'active'
          ? `Reactivated "${product.name}".`
          : `Archived "${product.name}" from buyer search.`
      );
    } catch (err) {
      setProdSubmitError(
        formatFriendlyErrorMessage(err, 'Unable to update product status.')
      );
    }
  };

  const handleShopLogoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: 'new' | 'edit'
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (target === 'new') setShopCreateError(null);
    else setEditShopError(null);
    try {
      const processed = await processUploadedPhotoFile(file);
      if (target === 'new') setNewShopLogoUrl(processed);
      else setEditShopLogoUrl(processed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('imageSizeTooLargeError');
      if (target === 'new') setShopCreateError(msg);
      else setEditShopError(msg);
    }
  };

  const handleApplyNewShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingShop) return;
    setShopFormErrors({});
    setShopCreateError(null);
    setShopSavedMsg(null);

    const validationErrors = validateShopInput({
      name: newShopName,
      description: newShopDescription,
      phoneNumber: newShopPhone,
      neighborhood: newShopNeighborhood,
      address: newShopAddress,
      deliveryAvailable: newShopDeliveryAvailable,
      pickupAvailable: newShopPickupAvailable,
    });
    if (Object.keys(validationErrors).length > 0) {
      setShopFormErrors(validationErrors);
      return;
    }

    const id = `shop-${Date.now()}`;
    const now = new Date().toISOString();
    const isAdminCreator = activeRoleView === 'admin';
    const descriptionText =
      newShopDescription.trim() ||
      `Verified local merchant located in ${newShopNeighborhood}, Hawassa.`;

    setIsCreatingShop(true);
    try {
      await saveSellerShop({
        shopId: id,
        ownerUid: firebaseUser?.uid ?? 'seller-applicant',
        name: newShopName.trim(),
        slug: buildShopSlug(newShopName, id),
        description: descriptionText,
        logoUrl: validateProductImageUrl(newShopLogoUrl) ? newShopLogoUrl : BRAND_ASSETS.logo,
        coverImageUrl: BRAND_ASSETS.banner,
        phoneNumber: newShopPhone.trim(),
        city: 'Hawassa',
        neighborhood: newShopNeighborhood,
        address: newShopAddress.trim(),
        deliveryAvailable: newShopDeliveryAvailable,
        pickupAvailable: newShopPickupAvailable,
        status: isAdminCreator ? 'approved' : 'pending',
        verificationStatus: isAdminCreator ? 'approved' : 'unverified',
        traderType: newShopTraderType,
        rating: 5.0,
        reviewCount: 0,
        createdAt: now,
        updatedAt: now,
      });
      setActiveSellerShopId(id);
      setNewShopName('');
      setNewShopDescription('');
      setNewShopAddress('');
      setNewShopPhone('');
      setNewShopLogoUrl(BRAND_ASSETS.logo);
      setNewShopTraderType('general');
      setNewShopDeliveryAvailable(true);
      setNewShopPickupAvailable(true);
      setShopSavedMsg(
        isAdminCreator
          ? `Virtual shop "${newShopName.trim()}" created and approved. You can post products immediately.`
          : 'Virtual shop created as pending. Upload your business license on the Verification tab to unlock product listings.'
      );
      setActiveTab(isAdminCreator ? 'products' : 'verification');
    } catch (err) {
      setShopCreateError(
        err instanceof Error ? err.message : 'Unable to create virtual shop right now.'
      );
    } finally {
      setIsCreatingShop(false);
    }
  };

  const handleSaveCurrentShopEdits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop || isUpdatingShop) return;
    setEditShopErrors({});
    setEditShopError(null);
    setShopSavedMsg(null);

    const validationErrors = validateShopInput({
      name: editShopName,
      description: editShopDesc,
      phoneNumber: editShopPhone,
      neighborhood: editShopNeighborhood,
      address: editShopAddress,
      deliveryAvailable: editShopDelivery,
      pickupAvailable: editShopPickup,
    });
    if (Object.keys(validationErrors).length > 0) {
      setEditShopErrors(validationErrors);
      return;
    }

    setIsUpdatingShop(true);
    try {
      await saveSellerShop({
        ...currentShop,
        name: editShopName.trim(),
        slug: buildShopSlug(editShopName, currentShop.shopId),
        description: editShopDesc.trim() || currentShop.description,
        neighborhood: editShopNeighborhood,
        address: editShopAddress.trim(),
        phoneNumber: editShopPhone.trim(),
        logoUrl: validateProductImageUrl(editShopLogoUrl) ? editShopLogoUrl : currentShop.logoUrl,
        traderType: editShopTraderType,
        deliveryAvailable: editShopDelivery,
        pickupAvailable: editShopPickup,
        updatedAt: new Date().toISOString(),
      });
      setIsEditingCurrentShop(false);
      setShopSavedMsg(`Saved changes to "${editShopName.trim()}".`);
    } catch (err) {
      setEditShopError(
        err instanceof Error ? err.message : 'Unable to update virtual shop details.'
      );
    } finally {
      setIsUpdatingShop(false);
    }
  };

  const handleOpenCamera = async () => {
    setCameraError(null);
    setDocSubmitError(null);
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
      const width = video.videoWidth || 800;
      const height = video.videoHeight || 600;
      const captured = compressImageSourceToDataUrl(video, width, height);
      setLicenseImageDataUrl(captured);
      setDocumentFileName('camera-license-scan.jpg');
      setDocErrors((prev) => {
        const next = { ...prev };
        delete next.licenseImageDataUrl;
        return next;
      });
      setDocSubmitError(null);
      stopCameraStream();
    } catch {
      setCameraError(t('returnCameraUnavailable'));
      stopCameraStream();
    }
  };

  const handleLicenseFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setCameraError(null);
    setDocSubmitError(null);
    try {
      const processed = await processUploadedPhotoFile(file);
      setLicenseImageDataUrl(processed);
      setDocumentFileName(file.name.slice(0, 120));
      setDocErrors((prev) => {
        const next = { ...prev };
        delete next.licenseImageDataUrl;
        return next;
      });
    } catch (err) {
      setDocSubmitError(
        err instanceof Error ? err.message : 'Could not load business license image.'
      );
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShop) return;
    setDocErrors({});
    setDocSubmitError(null);
    setDocSubmitSuccess(null);

    const errs = validateMerchantVerificationInput({
      businessLegalName,
      licenseNumber,
      tinNumber,
      issuingAuthority,
      expiryDate,
      licenseImageDataUrl,
    });
    if (Object.keys(errs).length > 0) {
      setDocErrors(errs);
      return;
    }

    setDocSubmitting(true);
    try {
      await submitMerchantVerification({
        shopId: currentShop.shopId,
        businessLegalName,
        licenseNumber,
        tinNumber: tinNumber || undefined,
        issuingAuthority,
        expiryDate: expiryDate || undefined,
        licenseImageDataUrl: licenseImageDataUrl!,
        documentFileName,
      });
      setDocSubmitSuccess(t('docVerifySubmittedToast'));
      stopCameraStream();
    } catch (err) {
      setDocSubmitError(
        err instanceof Error ? err.message : 'Unable to submit business license.'
      );
    } finally {
      setDocSubmitting(false);
    }
  };

  const getNextSellerStatus = (
    orderStatus: OrderStatus,
    fulfillment: 'delivery' | 'pickup'
  ): { next: OrderStatus; label: string } | null => {
    switch (orderStatus) {
      case 'accepted':
        return { next: 'preparing', label: 'Start Preparing' };
      case 'preparing':
        return fulfillment === 'delivery'
          ? { next: 'out_for_delivery', label: 'Dispatch for Delivery' }
          : { next: 'ready_for_pickup', label: 'Mark Ready for Pickup' };
      case 'out_for_delivery':
      case 'ready_for_pickup':
        return { next: 'delivered', label: 'Mark Delivered' };
      default:
        return null;
    }
  };

  const renderVerificationStatusLabel = () => {
    switch (docStatus) {
      case 'approved':
        return t('docVerifyStatusApproved');
      case 'pending_review':
        return t('docVerifyStatusPending');
      case 'rejected':
        return t('docVerifyStatusRejected');
      default:
        return t('docVerifyStatusUnverified');
    }
  };

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 bg-white dark:bg-[#1C2420] border-b border-[#E7E5E4] dark:border-[#2A3630] px-4 pt-3 pb-2 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Store className="w-5 h-5 text-[#047857] dark:text-[#10B981] shrink-0" />
            <h1 className="text-sm font-display font-bold text-stone-900 dark:text-stone-100 truncate">
              {t('sellerPortalShort')}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openTradeChatInbox()}
              aria-label={t('tradeChatInboxTitle')}
              className="min-h-[38px] px-2.5 rounded-lg border border-[#047857]/30 dark:border-[#10B981]/30 bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#D1FAE5] dark:hover:bg-[#10B981]/25 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="tabular-nums">
                {tradeChats.filter((th) => th.shopId === currentShop?.shopId).length}
              </span>
            </button>

            {managedShops.length > 0 ? (
              <select
                aria-label="Select Active Shop"
                value={currentShop?.shopId ?? ''}
                onChange={(e) => setActiveSellerShopId(e.target.value)}
                className="max-w-[150px] px-2.5 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-semibold text-stone-800 dark:text-stone-100 bg-[#FAF8F5] dark:bg-[#141A17] truncate focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
              >
                {managedShops.map((s) => (
                  <option
                    key={s.shopId}
                    value={s.shopId}
                    className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100"
                  >
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('shop')}
                className="px-2.5 py-1.5 rounded-lg border border-[#10B981]/30 bg-[#10B981]/15 text-[#10B981] text-xs font-bold whitespace-nowrap"
              >
                + Create Shop
              </button>
            )}
          </div>
        </div>

        {/* Navigation Segmented Bar */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] rounded-xl text-[11px] font-semibold">
          {(
            [
              { id: 'dashboard', label: t('sellerDashboard') },
              { id: 'orders', label: `${t('navOrders')} (${pendingOrders.length})` },
              { id: 'products', label: t('productsManagement') },
              {
                id: 'verification',
                label: t('docVerifyTab'),
                needsAttention: docStatus !== 'approved',
              },
              { id: 'shop', label: t('shopLabel') },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[36px] flex-1 min-w-fit px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 ${
                activeTab === item.id
                  ? 'bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              <span>{item.label}</span>
              {'needsAttention' in item && item.needsAttention && (
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full bg-[#D97706] dark:bg-[#F59E0B] shrink-0"
                />
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="p-4 space-y-4">
        {!currentShop && activeTab !== 'shop' && (
          <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#10B981]/30 shadow-sm p-5 text-center space-y-3">
            <Store className="w-8 h-8 text-[#10B981] mx-auto" />
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                Create Your Hawassa Virtual Shop
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                You need your own virtual shop before verifying your license or uploading products.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('shop')}
              className="w-full min-h-[44px] px-4 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Virtual Shop</span>
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && currentShop && (
          <>
            <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] shrink-0">
                    <ResilientImage
                      src={currentShop.logoUrl}
                      alt={currentShop.name}
                      fallbackTitle={currentShop.name}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {currentShop.name}
                    </div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      {getLocalizedNeighborhood(currentShop.neighborhood, language)} · Status:{' '}
                      <span
                        className={`font-semibold capitalize ${
                          currentShop.status === 'approved'
                            ? 'text-[#047857] dark:text-[#10B981]'
                            : currentShop.status === 'suspended'
                            ? 'text-rose-700 dark:text-rose-400'
                            : 'text-[#D97706] dark:text-[#F59E0B]'
                        }`}
                      >
                        {currentShop.status}
                      </span>
                    </div>
                  </div>
                </div>
                {isListingUnlocked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('products');
                      openCreateForm();
                    }}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center gap-1 shadow-sm transition-colors shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Product</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('verification')}
                    className="min-h-[44px] px-3 py-2 rounded-xl bg-[#D97706] hover:bg-[#B45309] dark:bg-[#F59E0B] dark:hover:bg-[#D97706] text-white dark:text-[#141A17] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>{t('docVerifyTab')}</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#E7E5E4]/70 dark:border-[#2A3630]">
                <button
                  type="button"
                  onClick={() => setActiveTab('shop')}
                  className="min-h-[40px] px-3 rounded-xl border border-[#047857]/30 dark:border-[#10B981]/30 bg-[#ECFDF5] dark:bg-[#10B981]/15 text-[#047857] dark:text-[#10B981] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#D1FAE5] dark:hover:bg-[#10B981]/25 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>Create Virtual Shop</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ name: 'shop', shopId: currentShop.shopId })}
                  className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-stone-700 dark:text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:border-[#047857]/40 transition-colors"
                >
                  <Store className="w-3.5 h-3.5 shrink-0 text-[#047857] dark:text-[#10B981]" />
                  <span>{t('visitShop')}</span>
                </button>
              </div>
            </div>

            {!isListingUnlocked && (
              <section className="rounded-2xl border border-[#FDE68A] dark:border-[#F59E0B]/30 bg-[#FFFBEB] dark:bg-[#F59E0B]/10 p-4 space-y-2.5 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t('docVerifyGateTitle')}
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                      {currentShop.status === 'suspended'
                        ? currentShop.suspensionReason || 'This shop is currently suspended by administrators.'
                        : t('docVerifyGateDesc')}
                    </p>
                    <div className="text-[11px] font-semibold text-[#B45309] dark:text-[#F59E0B] mt-1">
                      {renderVerificationStatusLabel()}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('verification')}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#F59E0B] dark:hover:bg-[#D97706] text-white dark:text-[#141A17] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>{t('docVerifyGateBtn')}</span>
                </button>
              </section>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Total Sales</div>
                <div className="text-lg font-bold text-[#047857] dark:text-[#10B981] mt-1 tabular-nums">
                  {formatETB(totalSales)}
                </div>
              </div>
              <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Pending Orders</div>
                <div className="text-lg font-bold text-[#D97706] dark:text-[#F59E0B] mt-1 tabular-nums">
                  {pendingOrders.length}
                </div>
              </div>
              <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Active Products</div>
                <div className="text-lg font-bold text-stone-900 dark:text-stone-100 mt-1 tabular-nums">
                  {activeProductsCount}
                </div>
              </div>
              <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4">
                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">Low Stock Alerts</div>
                <div className="text-lg font-bold text-rose-700 dark:text-rose-400 mt-1 tabular-nums">
                  {lowStockCount}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate({ name: 'video' })}
              className="w-full p-4 rounded-2xl bg-[#1C2420] border border-[#2A3630] text-white flex items-center justify-between hover:bg-[#242F29] shadow-sm transition-colors"
            >
              <div className="text-left">
                <div className="text-xs font-bold">Photo-to-Video Promo Studio</div>
                <div className="text-[11px] text-stone-300 dark:text-stone-400 mt-0.5">
                  Turn product photos into 16:9 or 9:16 shop reels
                </div>
              </div>
              <Video className="w-5 h-5 text-[#F59E0B] shrink-0" />
            </button>
          </>
        )}

        {activeTab === 'orders' && (
          <div className="space-y-3">
            {sellerOrders.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="w-6 h-6" />}
                title="No orders for this shop yet"
                description="Place a test order as a customer and switch back here to accept or fulfill it."
              />
            ) : (
              sellerOrders.map((order) => {
                const nextAction = getNextSellerStatus(
                  order.orderStatus,
                  order.fulfillmentMethod
                );
                return (
                  <div
                    key={order.orderId}
                    className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                        #{order.orderId.slice(-6).toUpperCase()}
                      </span>
                      <OrderStatusBadge status={order.orderStatus} />
                    </div>

                    <div className="text-xs text-stone-700 dark:text-stone-300">
                      <div className="font-semibold text-stone-900 dark:text-stone-100">
                        {order.customerName} · {order.customerPhone}
                      </div>
                      <div className="text-stone-500 dark:text-stone-400 mt-0.5">
                        {order.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                      </div>
                      <div className="font-bold text-[#047857] dark:text-[#10B981] mt-1 tabular-nums">
                        {formatETB(order.totalAmount)} ({order.fulfillmentMethod})
                        {order.paymentReference ? ` · Ref: ${order.paymentReference}` : ''}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openOrderChat(order)}
                      className="w-full min-h-[40px] px-3 rounded-xl bg-[#ECFDF5] dark:bg-[#064E3B]/40 border border-[#047857]/25 dark:border-[#10B981]/30 hover:bg-[#D1FAE5] dark:hover:bg-[#064E3B]/60 text-[#047857] dark:text-[#34D399] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {t('tradeChatMessageBuyerBtn')} · #{order.orderId.slice(-6).toUpperCase()}
                      </span>
                    </button>

                    {order.orderStatus === 'pending' && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.orderId, 'accepted')}
                          className="flex-1 min-h-[40px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('acceptOrder')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingOrderId(order.orderId)}
                          className="min-h-[40px] px-3 rounded-xl border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t('rejectOrder')}</span>
                        </button>
                      </div>
                    )}

                    {rejectingOrderId === order.orderId && (
                      <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 space-y-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection (required)"
                          className="w-full p-2 rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={!rejectReason.trim()}
                            onClick={() => {
                              updateOrderStatus(order.orderId, 'rejected', rejectReason.trim());
                              setRejectingOrderId(null);
                              setRejectReason('');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold disabled:opacity-50"
                          >
                            Confirm Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectingOrderId(null)}
                            className="px-3 py-1.5 text-xs text-stone-600 dark:text-stone-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {nextAction && nextAction.next === 'delivered' ? (
                      <div className="p-3 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 space-y-2">
                        <label
                          htmlFor={`seller-pin-${order.orderId}`}
                          className="block text-[11px] font-bold text-stone-900 dark:text-stone-100"
                        >
                          {t('deliveryPinVerifyTitle')}
                        </label>
                        <div className="flex gap-2">
                          <input
                            id={`seller-pin-${order.orderId}`}
                            type="text"
                            inputMode="numeric"
                            maxLength={4}
                            value={pinInputs[order.orderId] ?? ''}
                            onChange={(e) => {
                              const cleaned = e.target.value.replace(/\D/g, '').slice(0, 4);
                              setPinInputs((prev) => ({ ...prev, [order.orderId]: cleaned }));
                              setPinErrors((prev) => {
                                const next = { ...prev };
                                delete next[order.orderId];
                                return next;
                              });
                            }}
                            placeholder={t('deliveryPinInputPlaceholder')}
                            className="w-28 min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs font-mono font-bold tracking-widest text-center text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await updateOrderStatus(
                                  order.orderId,
                                  'delivered',
                                  undefined,
                                  pinInputs[order.orderId] ?? ''
                                );
                              } catch (err) {
                                setPinErrors((prev) => ({
                                  ...prev,
                                  [order.orderId]:
                                    err instanceof Error
                                      ? err.message
                                      : t('deliveryPinInvalidError'),
                                }));
                              }
                            }}
                            className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
                          >
                            {t('deliveryPinVerifyBtn')}
                          </button>
                        </div>
                        {pinErrors[order.orderId] && (
                          <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                            {pinErrors[order.orderId]}
                          </p>
                        )}
                      </div>
                    ) : (
                      nextAction && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.orderId, nextAction.next)}
                          className="w-full min-h-[40px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold transition-colors"
                        >
                          {nextAction.label}
                        </button>
                      )
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'products' && currentShop && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 tabular-nums">
                Shop Inventory ({shopProducts.length})
              </h2>
              <button
                type="button"
                disabled={!isListingUnlocked}
                onClick={openCreateForm}
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:bg-stone-300 dark:disabled:bg-[#2A3630] disabled:text-stone-500 dark:disabled:text-stone-500 text-white dark:text-[#0B1410] text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
              >
                {isListingUnlocked ? (
                  <Plus className="w-3.5 h-3.5" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
                <span>{t('addProduct')}</span>
              </button>
            </div>

            {!isListingUnlocked && currentShop && (
              <div className="rounded-2xl border border-[#FDE68A] dark:border-[#F59E0B]/30 bg-[#FFFBEB] dark:bg-[#F59E0B]/10 p-4 space-y-3 shadow-sm">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t('docVerifyGateTitle')}
                    </div>
                    <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                      {t('docVerifyGateDesc')}
                    </p>
                    <div className="mt-1.5 text-[11px] font-semibold text-[#B45309] dark:text-[#F59E0B]">
                      Current status: {renderVerificationStatusLabel()}
                    </div>
                    {currentVerification?.status === 'rejected' && currentVerification.reviewNote && (
                      <div className="mt-1.5 p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200">
                        Admin feedback: {currentVerification.reviewNote}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('verification')}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#F59E0B] dark:hover:bg-[#D97706] text-white dark:text-[#141A17] text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                >
                  <FileCheck2 className="w-4 h-4 shrink-0" />
                  <span>{t('docVerifyGateBtn')}</span>
                </button>
              </div>
            )}

            {prodSuccessMsg && (
              <div className="p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 text-[#047857] dark:text-[#10B981] text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{prodSuccessMsg}</span>
              </div>
            )}

            {showProductForm && isListingUnlocked && (
              <form
                onSubmit={handleSaveProduct}
                className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                    {editingProductId ? t('editProduct') : t('addProduct')}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowProductForm(false)}
                    className="text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200"
                  >
                    {t('cancel')}
                  </button>
                </div>

                <div>
                  <input
                    type="text"
                    value={prodName}
                    onChange={(e) => {
                      setProdName(e.target.value);
                      setAmbiguousConfirmedTarget(null);
                    }}
                    placeholder="Product Name (e.g., Sidama Roasted Coffee 500g)"
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />
                  {prodErrors.name && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{prodErrors.name}</p>}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <input
                      type="number"
                      min={1}
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="Price (ETB)"
                      className="w-full min-h-[44px] px-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs tabular-nums text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                    />
                    {prodErrors.price && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{prodErrors.price}</p>
                    )}
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={prodPreviousPrice}
                      onChange={(e) => setProdPreviousPrice(e.target.value)}
                      placeholder="Was ETB (opt)"
                      className="w-full min-h-[44px] px-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs tabular-nums text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min={0}
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      placeholder="Stock Qty"
                      className="w-full min-h-[44px] px-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs tabular-nums text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                    />
                    {prodErrors.stock && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{prodErrors.stock}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    aria-label="Product Category"
                    value={prodCategory}
                    onChange={(e) => {
                      setProdCategory(e.target.value);
                      setAmbiguousConfirmedTarget(null);
                    }}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs bg-white dark:bg-[#141A17] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  >
                    <option
                      value={COFFEE_CATEGORY_SLUG}
                      className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100"
                    >
                      {t('coffeeCategoryOptionLabel')}
                    </option>
                    {categories.map((c) => (
                      <option key={c.slug} value={c.slug} className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100">
                        {language === 'am'
                          ? c.nameAm
                          : language === 'om'
                          ? c.nameOm
                          : language === 'sid'
                          ? c.nameSid || c.name
                          : c.name}
                      </option>
                    ))}
                  </select>

                  <div>
                    <input
                      type="text"
                      list="seller-product-type-suggestions"
                      maxLength={60}
                      value={prodProductType}
                      onChange={(e) => {
                        setProdProductType(e.target.value);
                        setAmbiguousConfirmedTarget(null);
                      }}
                      placeholder="Product Type (opt, e.g. Roasted Coffee)"
                      className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                    />
                    <datalist id="seller-product-type-suggestions">
                      {COFFEE_PRODUCT_TYPE_SUGGESTIONS.map((suggestion) => (
                        <option key={suggestion} value={suggestion} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Live Automatic Coffee Categorization Status Banner */}
                {prodName.trim().length >= 3 && categorizationPreview.outcome === 'coffee' && categorizationPreview.autoAssigned && (
                  <div className="rounded-xl border border-[#C68B59]/45 bg-[#4B2E24]/15 dark:bg-[#4B2E24]/35 px-3 py-2 flex items-start gap-2 text-[11px] text-[#4B2E24] dark:text-[#F8F4EE]">
                    <Coffee className="w-4 h-4 text-[#C68B59] shrink-0 mt-0.5" />
                    <div className="min-w-0 leading-snug">
                      <span className="font-bold">Auto-detected as Ethiopian Coffee:</span>{' '}
                      This listing will automatically publish in <span className="font-semibold">Coffee Traders</span> and stay separated from unrelated categories.
                    </div>
                  </div>
                )}

                {prodName.trim().length >= 3 && categorizationPreview.outcome === 'conflict' && (
                  <div className="rounded-xl border border-rose-300 dark:border-rose-700/60 bg-rose-50 dark:bg-rose-950/40 p-3 space-y-2 text-[11px] text-rose-800 dark:text-rose-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span className="leading-snug">{categorizationPreview.reason}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProdCategory(categorizationPreview.suggestedCategory);
                        setProdSubmitError(null);
                      }}
                      className="min-h-[34px] px-3 rounded-lg bg-rose-700 hover:bg-rose-800 dark:bg-rose-600 dark:hover:bg-rose-500 text-white text-[11px] font-semibold transition-colors"
                    >
                      {categorizationPreview.suggestedCategory === COFFEE_CATEGORY_SLUG
                        ? 'Switch Category to Coffee Traders'
                        : `Switch Category to ${categorizationPreview.suggestedCategory}`}
                    </button>
                  </div>
                )}

                {prodName.trim().length >= 3 &&
                  categorizationPreview.outcome === 'ambiguous' &&
                  categorizationPreview.requiresConfirmation && (
                    <div className="rounded-xl border border-[#F59E0B]/45 bg-[#FFFBEB] dark:bg-[#F59E0B]/10 p-3 space-y-2 text-[11px] text-stone-800 dark:text-[#FDE68A]">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                        <div className="leading-snug">
                          <span className="font-bold">Confirm Product Category:</span>{' '}
                          {categorizationPreview.reason}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAmbiguousConfirmedTarget('coffee');
                            setProdCategory(COFFEE_CATEGORY_SLUG);
                            setProdSubmitError(null);
                          }}
                          className="min-h-[36px] px-2.5 rounded-lg bg-[#4B2E24] hover:bg-[#3A221A] text-[#F8F4EE] border border-[#C68B59]/50 text-[11px] font-semibold transition-colors"
                        >
                          List in Coffee Traders
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAmbiguousConfirmedTarget('non_coffee');
                            if (prodCategory === COFFEE_CATEGORY_SLUG) {
                              setProdCategory(categorizationPreview.suggestedCategory || 'home-living');
                            }
                            setProdSubmitError(null);
                          }}
                          className="min-h-[36px] px-2.5 rounded-lg bg-white dark:bg-[#141A17] text-stone-800 dark:text-stone-100 border border-[#E7E5E4] dark:border-[#2A3630] text-[11px] font-semibold transition-colors"
                        >
                          Keep Non-Coffee
                        </button>
                      </div>
                    </div>
                  )}

                {/* Conditional Coffee-Specific Fields (Shown for Specialty Coffee & Auto-Detected Coffee listings) */}
                {effectiveIsCoffeeListing && (
                  <fieldset className="rounded-2xl border border-[#C68B59]/45 bg-[#4B2E24]/15 dark:bg-[#4B2E24]/30 p-3 space-y-2.5">
                    <legend className="px-1.5 text-[11px] font-bold text-[#4B2E24] dark:text-[#F8F4EE] flex items-center gap-1.5">
                      <Coffee className="w-3.5 h-3.5 text-[#C68B59]" />
                      <span>{t('coffeeSellerSectionTitle')}</span>
                    </legend>
                    <p className="text-[11px] text-stone-600 dark:text-[#D5C3B3] leading-snug">
                      {t('coffeeSellerSectionHint')}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                          {t('coffeeFilterOrigin')}
                        </label>
                        <input
                          type="text"
                          list="ethiopian-coffee-origins"
                          maxLength={80}
                          value={coffeeOrigin}
                          onChange={(e) => setCoffeeOrigin(e.target.value)}
                          placeholder="e.g. Sidama, Yirgacheffe"
                          className="w-full min-h-[40px] px-2.5 rounded-xl border border-[#C68B59]/40 bg-white dark:bg-[#1A100D] text-xs text-stone-900 dark:text-[#F8F4EE]"
                        />
                        <datalist id="ethiopian-coffee-origins">
                          {ETHIOPIAN_COFFEE_ORIGINS.map((origin) => (
                            <option key={origin} value={origin} />
                          ))}
                        </datalist>
                        {prodErrors.coffeeOrigin && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                            {prodErrors.coffeeOrigin}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                          {t('coffeeFilterBrand')} (opt)
                        </label>
                        <input
                          type="text"
                          maxLength={80}
                          value={coffeeBrand}
                          onChange={(e) => setCoffeeBrand(e.target.value)}
                          placeholder={currentShop?.name || 'Roastery / Brand'}
                          className="w-full min-h-[40px] px-2.5 rounded-xl border border-[#C68B59]/40 bg-white dark:bg-[#1A100D] text-xs text-stone-900 dark:text-[#F8F4EE]"
                        />
                        {prodErrors.coffeeBrand && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                            {prodErrors.coffeeBrand}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                          {t('coffeeFilterRoast')}
                        </label>
                        <select
                          value={coffeeRoastLevel}
                          onChange={(e) =>
                            setCoffeeRoastLevel(e.target.value as CoffeeRoastLevel)
                          }
                          className="w-full min-h-[40px] px-2.5 rounded-xl border border-[#C68B59]/40 bg-white dark:bg-[#1A100D] text-xs text-stone-900 dark:text-[#F8F4EE]"
                        >
                          {COFFEE_ROAST_LEVELS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                          {t('coffeeProcessMethod')}
                        </label>
                        <select
                          value={coffeeProcessMethod}
                          onChange={(e) =>
                            setCoffeeProcessMethod(e.target.value as CoffeeProcessMethod)
                          }
                          className="w-full min-h-[40px] px-2.5 rounded-xl border border-[#C68B59]/40 bg-white dark:bg-[#1A100D] text-xs text-stone-900 dark:text-[#F8F4EE]"
                        >
                          {COFFEE_PROCESSING_METHODS.map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Bean Form Segmented Control */}
                    <div>
                      <span className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                        {t('coffeeFilterForm')}
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {COFFEE_BEAN_FORMS.map((f) => {
                          const active = coffeeBeanForm === f.value;
                          return (
                            <button
                              key={f.value}
                              type="button"
                              onClick={() => setCoffeeBeanForm(f.value)}
                              className={`min-h-[38px] px-3 rounded-xl border text-xs font-semibold transition-colors ${
                                active
                                  ? 'bg-[#4B2E24] border-[#C68B59] text-[#F8F4EE]'
                                  : 'bg-white dark:bg-[#1A100D] border-[#C68B59]/30 text-stone-700 dark:text-[#D5C3B3]'
                              }`}
                            >
                              {f.value === 'whole_bean'
                                ? t('coffeeWholeBeans')
                                : t('coffeeGround')}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                          {t('coffeeFilterWeight')}
                        </label>
                        <input
                          type="text"
                          list="coffee-package-weights"
                          maxLength={32}
                          value={coffeeWeight}
                          onChange={(e) => setCoffeeWeight(e.target.value)}
                          placeholder="250g, 500g, 1kg"
                          className="w-full min-h-[40px] px-2.5 rounded-xl border border-[#C68B59]/40 bg-white dark:bg-[#1A100D] text-xs text-stone-900 dark:text-[#F8F4EE]"
                        />
                        <datalist id="coffee-package-weights">
                          {COFFEE_PACKAGE_WEIGHTS.map((w) => (
                            <option key={w} value={w} />
                          ))}
                        </datalist>
                        {prodErrors.coffeeWeight && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                            {prodErrors.coffeeWeight}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-semibold text-stone-600 dark:text-[#D5C3B3] mb-1">
                          {t('coffeeRoastDate')} (opt)
                        </label>
                        <input
                          type="date"
                          value={coffeeRoastDate}
                          onChange={(e) => setCoffeeRoastDate(e.target.value)}
                          className="w-full min-h-[40px] px-2.5 rounded-xl border border-[#C68B59]/40 bg-white dark:bg-[#1A100D] text-xs text-stone-900 dark:text-[#F8F4EE]"
                        />
                        {prodErrors.coffeeRoastDate && (
                          <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">
                            {prodErrors.coffeeRoastDate}
                          </p>
                        )}
                      </div>
                    </div>
                  </fieldset>
                )}

                <div>
                  <textarea
                    rows={3}
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="Describe product quality, weight, or sizing..."
                    className="w-full p-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />
                  {prodErrors.description && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{prodErrors.description}</p>
                  )}
                </div>

                {/* Fulfillment Availability Toggles */}
                <div className="grid grid-cols-2 gap-2">
                  <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodDeliveryAvailable}
                      onChange={(e) => setProdDeliveryAvailable(e.target.checked)}
                      className="accent-[#047857] dark:accent-[#10B981]"
                    />
                    <span>{t('deliveryAvailable')}</span>
                  </label>
                  <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodPickupAvailable}
                      onChange={(e) => setProdPickupAvailable(e.target.checked)}
                      className="accent-[#047857] dark:accent-[#10B981]"
                    />
                    <span>{t('pickupAvailable')}</span>
                  </label>
                </div>
                {prodErrors.fulfillment && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">{prodErrors.fulfillment}</p>
                )}

                {/* Product Catalog Photo Capture, File Upload, or URL */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                      {t('productPhotoUploadLabel')}
                    </span>
                    {isProcessingProductPhoto && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#10B981]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Optimizing photo...</span>
                      </span>
                    )}
                  </div>

                  {productCameraOpen ? (
                    <div className="space-y-2">
                      <video
                        ref={productVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-44 object-cover rounded-xl bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={handleCaptureProductCameraFrame}
                          className="min-h-[40px] px-3 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <Camera className="w-4 h-4 shrink-0" />
                          <span>{t('returnCapturePhoto')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopProductCameraStream}
                          className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#242F29] transition-colors"
                        >
                          {t('returnCancelCamera')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isProcessingProductPhoto}
                        onClick={handleOpenProductCamera}
                        className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] hover:bg-[#ECFDF5] dark:hover:bg-[#242F29] disabled:opacity-50 text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                      >
                        <Camera className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                        <span>{t('docVerifyTakePhoto')}</span>
                      </button>

                      <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] hover:bg-[#ECFDF5] dark:hover:bg-[#242F29] text-[11px] font-semibold text-stone-800 dark:text-stone-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap">
                        <Upload className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981] shrink-0" />
                        <span>{t('uploadProductPhoto')}</span>
                        <input
                          id="seller-product-photo-input"
                          type="file"
                          accept="image/*"
                          onChange={handleProductPhotoChange}
                          className="sr-only"
                        />
                      </label>
                    </div>
                  )}

                  {productCameraError && (
                    <p className="text-[11px] text-[#B45309] dark:text-[#F59E0B] bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 rounded-xl px-3 py-2">
                      {productCameraError}
                    </p>
                  )}

                  <input
                    type="text"
                    value={prodImageUrl.startsWith('data:image/') ? '' : prodImageUrl}
                    onChange={(e) => setProdImageUrl(e.target.value)}
                    placeholder="Or paste https:// image URL (optional)"
                    className="w-full min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />

                  {prodImageUrl && (
                    <div className="flex items-center gap-3 p-2 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-white dark:bg-[#1C2420] shrink-0">
                        <ResilientImage src={prodImageUrl} alt={prodName || 'Product preview'} />
                      </div>
                      <div className="min-w-0 flex-1 text-[11px] text-stone-600 dark:text-stone-300">
                        {prodImageUrl.startsWith('data:image/') ? (
                          <span className="text-[#047857] dark:text-[#10B981] font-semibold tabular-nums">
                            {t('imageSizeLimitHint', {
                              size: formatImageByteSize(estimateDataUrlByteSize(prodImageUrl)),
                            })}
                          </span>
                        ) : (
                          <span className="truncate block">{prodImageUrl}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setProdImageUrl('')}
                        aria-label="Clear selected product photo"
                        className="min-h-[34px] px-2 rounded-lg text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 inline-flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {prodSubmitError && (
                  <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                    {prodSubmitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSavingProduct || isProcessingProductPhoto}
                  className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-60 text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  {(isSavingProduct || isProcessingProductPhoto) && (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  )}
                  <span>{isSavingProduct ? t('saving') : 'Save Product'}</span>
                </button>
              </form>
            )}

            {shopProducts.length === 0 ? (
              <div className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-6 text-center space-y-1.5">
                <Package className="w-6 h-6 text-stone-400 mx-auto" />
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  No products listed for {currentShop?.name}
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400">
                  {isListingUnlocked
                    ? 'Tap Add New Product above to publish your first Hawassa listing.'
                    : 'Complete document verification to publish products.'}
                </p>
              </div>
            ) : (
              shopProducts.map((p) => (
                <div
                  key={p.productId}
                  className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm hover:shadow-md p-3 flex items-center gap-3 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#FAF8F5] dark:bg-[#141A17] shrink-0">
                    <ResilientImage src={p.imageUrl} alt={p.name} fallbackTitle={p.name} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{p.name}</div>
                    <div className="text-[11px] text-stone-600 dark:text-stone-400 tabular-nums mt-0.5">
                      {formatETB(p.price)} · Stock: {p.stock} ·{' '}
                      <span className={p.status === 'active' ? 'text-[#047857] dark:text-[#10B981]' : 'text-stone-400 dark:text-stone-500'}>
                        {p.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      disabled={!isListingUnlocked}
                      onClick={() => openEditForm(p)}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#242F29] disabled:opacity-40 transition-colors"
                    >
                      {t('edit')}
                    </button>
                    <button
                      type="button"
                      disabled={!isListingUnlocked}
                      onClick={() => handleToggleProductStatus(p)}
                      aria-label={p.status === 'active' ? 'Archive product' : 'Restore product'}
                      title={p.status === 'active' ? 'Archive product' : 'Restore product'}
                      className="min-w-[36px] min-h-[36px] rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] text-stone-600 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#242F29] disabled:opacity-40 flex items-center justify-center transition-colors"
                    >
                      {p.status === 'active' ? (
                        <Archive className="w-3.5 h-3.5" />
                      ) : (
                        <RotateCcw className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'verification' && currentShop && (
          <div className="space-y-4">
            {/* Verification Status Banner Card */}
            <section
              className={`rounded-2xl border p-4 space-y-2 shadow-sm ${
                docStatus === 'approved'
                  ? 'bg-[#ECFDF5] dark:bg-[#10B981]/10 border-[#A7F3D0] dark:border-[#10B981]/30'
                  : docStatus === 'rejected'
                  ? 'bg-rose-50/70 dark:bg-rose-950/35 border-rose-200 dark:border-rose-800'
                  : 'bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border-[#FDE68A] dark:border-[#F59E0B]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  {docStatus === 'approved' ? (
                    <ShieldCheck className="w-5 h-5 text-[#047857] dark:text-[#10B981] shrink-0 mt-0.5" />
                  ) : docStatus === 'rejected' ? (
                    <XCircle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
                  ) : docStatus === 'pending_review' ? (
                    <Clock className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                  ) : (
                    <FileCheck2 className="w-5 h-5 text-[#D97706] dark:text-[#F59E0B] shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      {t('docVerifyTitle')} · {currentShop.name}
                    </div>
                    <div
                      className={`text-[11px] font-bold mt-0.5 ${
                        docStatus === 'approved'
                          ? 'text-[#047857] dark:text-[#10B981]'
                          : docStatus === 'rejected'
                          ? 'text-rose-800 dark:text-rose-300'
                          : 'text-[#B45309] dark:text-[#F59E0B]'
                      }`}
                    >
                      {renderVerificationStatusLabel()}
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                {t('docVerifySubtitle')}
              </p>

              {currentVerification?.submittedAt && (
                <div className="text-[10px] text-stone-500 dark:text-stone-400 tabular-nums">
                  Submitted: {new Date(currentVerification.submittedAt).toLocaleString()}
                  {currentVerification.reviewedAt
                    ? ` · Reviewed: ${new Date(currentVerification.reviewedAt).toLocaleString()}`
                    : ''}
                </div>
              )}

              {currentVerification?.status === 'rejected' && currentVerification.reviewNote && (
                <div className="p-2.5 rounded-xl bg-white/80 dark:bg-[#141A17]/80 border border-rose-200 dark:border-rose-800 text-[11px] text-rose-800 dark:text-rose-200">
                  <span className="font-bold">Admin review note:</span> {currentVerification.reviewNote}
                </div>
              )}

              {docStatus === 'approved' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('products')}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] text-white dark:text-[#0B1410] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('productsManagement')}</span>
                </button>
              )}
            </section>

            {/* Business License Upload Form */}
            <form
              onSubmit={handleSubmitVerification}
              className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3.5"
            >
              <div>
                <label
                  htmlFor="doc-legal-name"
                  className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1"
                >
                  {t('docVerifyLegalNameLabel')}
                </label>
                <input
                  id="doc-legal-name"
                  type="text"
                  maxLength={140}
                  value={businessLegalName}
                  onChange={(e) => setBusinessLegalName(e.target.value)}
                  placeholder={t('docVerifyLegalNamePlaceholder')}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
                {docErrors.businessLegalName && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                    {t(docErrors.businessLegalName)}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="doc-license-number"
                    className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    {t('docVerifyLicenseNumLabel')}
                  </label>
                  <input
                    id="doc-license-number"
                    type="text"
                    maxLength={60}
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value)}
                    placeholder={t('docVerifyLicenseNumPlaceholder')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs font-mono text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />
                  {docErrors.licenseNumber && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {t(docErrors.licenseNumber)}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="doc-tin-number"
                    className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    {t('docVerifyTinLabel')}
                  </label>
                  <input
                    id="doc-tin-number"
                    type="text"
                    maxLength={30}
                    value={tinNumber}
                    onChange={(e) => setTinNumber(e.target.value)}
                    placeholder={t('docVerifyTinPlaceholder')}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs font-mono text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />
                  {docErrors.tinNumber && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {t(docErrors.tinNumber)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="doc-issuing-authority"
                    className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    {t('docVerifyAuthorityLabel')}
                  </label>
                  <select
                    id="doc-issuing-authority"
                    value={issuingAuthority}
                    onChange={(e) => setIssuingAuthority(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  >
                    {HAWASSA_ISSUING_AUTHORITIES.map((auth) => (
                      <option
                        key={auth}
                        value={auth}
                        className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100"
                      >
                        {auth}
                      </option>
                    ))}
                  </select>
                  {docErrors.issuingAuthority && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {t(docErrors.issuingAuthority)}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="doc-expiry-date"
                    className="block text-[11px] font-semibold text-stone-700 dark:text-stone-300 mb-1"
                  >
                    {t('docVerifyExpiryLabel')}
                  </label>
                  <input
                    id="doc-expiry-date"
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 tabular-nums focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                  />
                  {docErrors.expiryDate && (
                    <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">
                      {t(docErrors.expiryDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* License Document Camera & File Upload */}
              <div className="space-y-2 pt-1">
                <div>
                  <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-300">
                    {t('docVerifyUploadLabel')}
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                    {t('docVerifyUploadHint')}
                  </p>
                </div>

                {cameraOpen ? (
                  <div className="space-y-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-48 object-cover rounded-xl bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630]"
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
                        className="min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-[#FAF8F5] dark:hover:bg-[#242F29] transition-colors"
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
                      className="min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] hover:bg-[#ECFDF5] dark:hover:bg-[#242F29] text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <Camera className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
                      <span>{t('docVerifyTakePhoto')}</span>
                    </button>

                    <label className="min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] hover:bg-[#ECFDF5] dark:hover:bg-[#242F29] text-xs font-semibold text-stone-800 dark:text-stone-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap">
                      <Upload className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
                      <span>{t('docVerifyUploadFile')}</span>
                      <input
                        id="license-document-input"
                        type="file"
                        accept="image/*"
                        onChange={handleLicenseFileChange}
                        className="sr-only"
                      />
                    </label>
                  </div>
                )}

                {cameraError && (
                  <p className="text-[11px] text-[#B45309] dark:text-[#F59E0B] bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 rounded-xl px-3 py-2">
                    {cameraError}
                  </p>
                )}

                {licenseImageDataUrl && (
                  <div className="p-2.5 rounded-xl border border-[#A7F3D0] dark:border-[#10B981]/30 bg-[#ECFDF5]/60 dark:bg-[#10B981]/10 space-y-2">
                    <img
                      src={licenseImageDataUrl}
                      alt="Uploaded business license preview"
                      className="w-full max-h-48 object-contain rounded-lg bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630]"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[11px] font-semibold text-[#047857] dark:text-[#10B981] truncate flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">
                            {documentFileName || 'business-license.jpg'}
                          </span>
                        </span>
                        <div className="text-[10px] text-stone-500 dark:text-stone-400 tabular-nums mt-0.5">
                          {t('imageSizeLimitHint', {
                            size: formatImageByteSize(estimateDataUrlByteSize(licenseImageDataUrl)),
                          })}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setLicenseImageDataUrl(undefined);
                          setDocumentFileName(undefined);
                        }}
                        className="min-h-[40px] px-2.5 rounded-lg text-[11px] font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 flex items-center gap-1 shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>{t('returnRemovePhoto')}</span>
                      </button>
                    </div>
                  </div>
                )}

                {docErrors.licenseImageDataUrl && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400">
                    {t(docErrors.licenseImageDataUrl)}
                  </p>
                )}
              </div>

              {docSubmitError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-medium text-rose-800 dark:text-rose-200">
                  {docSubmitError}
                </div>
              )}

              {docSubmitSuccess && (
                <div className="p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 text-[11px] font-medium text-[#047857] dark:text-[#10B981] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{docSubmitSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={docSubmitting}
                className="w-full min-h-[44px] px-4 rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:bg-stone-300 dark:disabled:bg-[#2A3630] text-white dark:text-[#0B1410] text-xs font-semibold shadow-sm transition-colors"
              >
                {docSubmitting
                  ? t('saving')
                  : currentVerification
                  ? t('docVerifyResubmitBtn')
                  : t('docVerifySubmitBtn')}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'shop' && (
          <div className="space-y-4">
            {shopSavedMsg && (
              <div className="p-2.5 rounded-xl bg-[#ECFDF5] dark:bg-[#10B981]/15 border border-[#A7F3D0] dark:border-[#10B981]/30 text-[#047857] dark:text-[#10B981] text-xs font-medium flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{shopSavedMsg}</span>
              </div>
            )}

            {/* Active Virtual Shop Profile & Inline Editor */}
            {currentShop && (
              <section className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#FAF8F5] dark:bg-[#141A17] border border-[#E7E5E4] dark:border-[#2A3630] shrink-0">
                      <ResilientImage
                        src={currentShop.logoUrl}
                        alt={currentShop.name}
                        fallbackTitle={currentShop.name}
                      />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                        {currentShop.name}
                      </h2>
                      <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                        {getLocalizedNeighborhood(currentShop.neighborhood, language)} ·{' '}
                        {currentShop.phoneNumber}
                      </div>
                    </div>
                  </div>
                  {(activeRoleView === 'admin' ||
                    (firebaseUser && currentShop.ownerUid === firebaseUser.uid)) && (
                    <button
                      type="button"
                      onClick={() => setIsEditingCurrentShop((v) => !v)}
                      className="min-h-[36px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-xs font-semibold text-stone-700 dark:text-stone-200 flex items-center gap-1.5 shrink-0"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{isEditingCurrentShop ? t('cancel') : t('edit')}</span>
                    </button>
                  )}
                </div>

                {!isEditingCurrentShop ? (
                  <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
                    {currentShop.description}
                  </p>
                ) : (
                  <form onSubmit={handleSaveCurrentShopEdits} className="space-y-2.5 pt-2 border-t border-[#E7E5E4] dark:border-[#2A3630]">
                    <div>
                      <input
                        type="text"
                        value={editShopName}
                        onChange={(e) => setEditShopName(e.target.value)}
                        placeholder="Virtual Shop Name"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100"
                      />
                      {editShopErrors.name && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{editShopErrors.name}</p>
                      )}
                    </div>

                    <div>
                      <textarea
                        rows={2}
                        value={editShopDesc}
                        onChange={(e) => setEditShopDesc(e.target.value)}
                        placeholder="Describe what your virtual shop sells..."
                        className="w-full p-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100"
                      />
                      {editShopErrors.description && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{editShopErrors.description}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={editShopNeighborhood}
                        onChange={(e) => setEditShopNeighborhood(e.target.value)}
                        className="w-full min-h-[44px] px-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100"
                      >
                        {HAWASSA_NEIGHBORHOODS.map((n) => (
                          <option key={n} value={n}>
                            {getLocalizedNeighborhood(n, language)}
                          </option>
                        ))}
                      </select>
                      <div>
                        <input
                          type="tel"
                          value={editShopPhone}
                          onChange={(e) => setEditShopPhone(e.target.value)}
                          placeholder="+251 9X XXX XXXX"
                          className="w-full min-h-[44px] px-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100"
                        />
                        {editShopErrors.phoneNumber && (
                          <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{editShopErrors.phoneNumber}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        value={editShopAddress}
                        onChange={(e) => setEditShopAddress(e.target.value)}
                        placeholder="Street / Market Stall Location"
                        className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100"
                      />
                      {editShopErrors.address && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{editShopErrors.address}</p>
                      )}
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                        {t('sellerTraderTypeLabel')}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEditShopTraderType('general')}
                          className={`min-h-[40px] px-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                            editShopTraderType === 'general'
                              ? 'bg-[#047857] border-[#047857] text-white'
                              : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          {t('sellerTraderTypeGeneral')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditShopTraderType('coffee')}
                          className={`min-h-[40px] px-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            editShopTraderType === 'coffee'
                              ? 'bg-[#4B2E24] border-[#C68B59] text-[#F8F4EE]'
                              : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300'
                          }`}
                        >
                          <Coffee className="w-3.5 h-3.5 text-[#C68B59] shrink-0" />
                          <span className="truncate">{t('coffeeTradersTitle')}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editShopDelivery}
                          onChange={(e) => setEditShopDelivery(e.target.checked)}
                          className="accent-[#047857]"
                        />
                        <span>{t('deliveryAvailable')}</span>
                      </label>
                      <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editShopPickup}
                          onChange={(e) => setEditShopPickup(e.target.checked)}
                          className="accent-[#047857]"
                        />
                        <span>{t('pickupAvailable')}</span>
                      </label>
                    </div>
                    {editShopErrors.fulfillment && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400">{editShopErrors.fulfillment}</p>
                    )}

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                        Shop Logo Photo
                      </span>
                      <label className="min-h-[36px] px-3 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] text-[11px] font-semibold text-stone-800 dark:text-stone-200 inline-flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                        <span>Upload Logo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleShopLogoUpload(e, 'edit')}
                          className="sr-only"
                        />
                      </label>
                    </div>

                    {editShopError && (
                      <p className="text-[11px] font-medium text-rose-700 dark:text-rose-400">
                        {editShopError}
                      </p>
                    )}

                    <button
                      type="submit"
                      disabled={isUpdatingShop}
                      className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-60 text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                      {isUpdatingShop && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                      <span>{isUpdatingShop ? t('saving') : 'Save Virtual Shop Changes'}</span>
                    </button>
                  </form>
                )}
              </section>
            )}

            {/* Create a New Virtual Shop Form */}
            <form
              onSubmit={handleApplyNewShop}
              className="bg-white dark:bg-[#1C2420] rounded-2xl border border-[#E7E5E4] dark:border-[#2A3630] shadow-sm p-4 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-[#047857] dark:text-[#10B981] shrink-0" />
                <h2 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Create a New Hawassa Virtual Shop
                </h2>
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed">
                {activeRoleView === 'admin'
                  ? 'Admin-created virtual shops are approved automatically so you can start posting products right away.'
                  : 'New merchant applications start in pending status. Upload your trade license on the Verification tab for manual admin approval before listing products.'}
              </p>

              <div>
                <input
                  type="text"
                  value={newShopName}
                  onChange={(e) => setNewShopName(e.target.value)}
                  placeholder="Virtual Shop Name (e.g. Sidama Crafts Hub)"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
                {shopFormErrors.name && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{shopFormErrors.name}</p>
                )}
              </div>

              <div>
                <textarea
                  rows={2}
                  value={newShopDescription}
                  onChange={(e) => setNewShopDescription(e.target.value)}
                  placeholder="What does your shop offer? (optional, min 10 chars if provided)"
                  className="w-full p-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
                {shopFormErrors.description && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{shopFormErrors.description}</p>
                )}
              </div>

              <div className="space-y-1">
                <span className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300">
                  {t('sellerTraderTypeLabel')}
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewShopTraderType('general')}
                    className={`min-h-[40px] px-2.5 rounded-xl border text-[11px] font-semibold transition-colors ${
                      newShopTraderType === 'general'
                        ? 'bg-[#047857] border-[#047857] text-white'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {t('sellerTraderTypeGeneral')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewShopTraderType('coffee')}
                    className={`min-h-[40px] px-2.5 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                      newShopTraderType === 'coffee'
                        ? 'bg-[#4B2E24] border-[#C68B59] text-[#F8F4EE]'
                        : 'bg-[#FAF8F5] dark:bg-[#141A17] border-[#E7E5E4] dark:border-[#2A3630] text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    <Coffee className="w-3.5 h-3.5 text-[#C68B59] shrink-0" />
                    <span className="truncate">{t('coffeeTradersTitle')}</span>
                  </button>
                </div>
              </div>

              <div>
                <select
                  value={newShopNeighborhood}
                  onChange={(e) => setNewShopNeighborhood(e.target.value)}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] text-xs bg-white dark:bg-[#141A17] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                >
                  {HAWASSA_NEIGHBORHOODS.map((n) => (
                    <option
                      key={n}
                      value={n}
                      className="bg-white dark:bg-[#1C2420] text-stone-900 dark:text-stone-100"
                    >
                      {getLocalizedNeighborhood(n, language)}
                    </option>
                  ))}
                </select>
                {shopFormErrors.neighborhood && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{shopFormErrors.neighborhood}</p>
                )}
              </div>

              <div>
                <input
                  type="text"
                  value={newShopAddress}
                  onChange={(e) => setNewShopAddress(e.target.value)}
                  placeholder="Street / Market Stall Location"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
                {shopFormErrors.address && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{shopFormErrors.address}</p>
                )}
              </div>

              <div>
                <input
                  type="tel"
                  value={newShopPhone}
                  onChange={(e) => setNewShopPhone(e.target.value)}
                  placeholder="Shop Contact Phone (e.g. 0911234567)"
                  className="w-full min-h-[44px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#141A17] text-xs text-stone-900 dark:text-stone-100 placeholder:text-stone-400 dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#ECFDF5] dark:focus:ring-[#10B981]/20 focus:border-[#047857] dark:focus:border-[#10B981]"
                />
                {shopFormErrors.phoneNumber && (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">{shopFormErrors.phoneNumber}</p>
                )}
              </div>

              {/* Delivery & Pickup Options */}
              <div className="grid grid-cols-2 gap-2">
                <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShopDeliveryAvailable}
                    onChange={(e) => setNewShopDeliveryAvailable(e.target.checked)}
                    className="accent-[#047857] dark:accent-[#10B981]"
                  />
                  <span>{t('deliveryAvailable')}</span>
                </label>
                <label className="min-h-[40px] px-3 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17] flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newShopPickupAvailable}
                    onChange={(e) => setNewShopPickupAvailable(e.target.checked)}
                    className="accent-[#047857] dark:accent-[#10B981]"
                  />
                  <span>{t('pickupAvailable')}</span>
                </label>
              </div>
              {shopFormErrors.fulfillment && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">{shopFormErrors.fulfillment}</p>
              )}

              {/* Virtual Shop Logo Preview & Upload */}
              <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-[#E7E5E4] dark:border-[#2A3630] bg-[#FAF8F5] dark:bg-[#141A17]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-white dark:bg-[#1C2420] border border-[#E7E5E4] dark:border-[#2A3630] shrink-0">
                    <ResilientImage src={newShopLogoUrl} alt="Virtual shop logo preview" />
                  </div>
                  <div className="text-[11px] font-semibold text-stone-700 dark:text-stone-200 truncate">
                    Virtual Shop Logo
                  </div>
                </div>
                <label className="min-h-[36px] px-3 rounded-lg border border-[#E7E5E4] dark:border-[#2A3630] bg-white dark:bg-[#1C2420] text-[11px] font-semibold text-stone-800 dark:text-stone-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0">
                  <Upload className="w-3.5 h-3.5 text-[#047857] dark:text-[#10B981]" />
                  <span>Upload Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleShopLogoUpload(e, 'new')}
                    className="sr-only"
                  />
                </label>
              </div>

              {shopCreateError && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-[11px] font-medium text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{shopCreateError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isCreatingShop}
                className="w-full min-h-[44px] rounded-xl bg-[#047857] hover:bg-[#065F46] dark:bg-[#10B981] dark:hover:bg-[#059669] disabled:opacity-60 text-white dark:text-[#0B1410] text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                {isCreatingShop && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                <span>{isCreatingShop ? 'Creating Virtual Shop...' : 'Create Virtual Shop'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
