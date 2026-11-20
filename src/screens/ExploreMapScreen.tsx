import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  APILoadingStatus,
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import {
  ArrowLeft,
  Bookmark,
  Compass,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  Search,
  Sparkles,
  Store,
  Trash2,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import type { Shop } from '../types';
import { getShopCoordinates, HAWASSA_CENTER } from '../utils/hawassaCoordinates';

interface GroundedPlaceItem {
  title: string;
  uri: string;
  placeId?: string;
  reviewSnippets?: string[];
}

interface SavedPlaceRow {
  id: number;
  title: string;
  query: string;
  mapsUri: string | null;
  notes: string | null;
}

const ShopMarkerItem: React.FC<{
  shop: Shop;
  isSelected: boolean;
  isNearest: boolean;
  distanceLabel?: string;
  bajajEtaLabel?: string;
  onSelect: (shop: Shop) => void;
  onClose: () => void;
  onVisitShop: (shopId: string) => void;
}> = ({
  shop,
  isSelected,
  isNearest,
  distanceLabel,
  bajajEtaLabel,
  onSelect,
  onClose,
  onVisitShop,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const position = useMemo(
    () => getShopCoordinates(shop.shopId, shop.neighborhood),
    [shop.shopId, shop.neighborhood]
  );

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={shop.name}
        onClick={() => onSelect(shop)}
      >
        <Pin
          background={isSelected || isNearest ? '#D97706' : '#047857'}
          borderColor={isSelected || isNearest ? '#92400E' : '#065F46'}
          glyphColor="#ffffff"
          scale={isSelected ? 1.2 : isNearest ? 1.12 : 1.0}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={240} onCloseClick={onClose}>
          <div className="p-1 space-y-1.5 text-stone-900">
            <div className="text-xs font-bold leading-snug">{shop.name}</div>
            <div className="text-[11px] text-stone-600">
              {shop.neighborhood} · {shop.address}
            </div>
            {distanceLabel && (
              <div className="text-[11px] font-semibold text-[#047857] tabular-nums">
                {distanceLabel}
                {bajajEtaLabel ? ` · ${bajajEtaLabel}` : ''}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] font-semibold text-[#D97706] tabular-nums">
                ★ {shop.rating.toFixed(1)}
              </span>
              <button
                type="button"
                onClick={() => onVisitShop(shop.shopId)}
                className="px-2.5 py-1 rounded-lg bg-[#047857] text-white text-[11px] font-semibold hover:bg-[#065F46]"
              >
                Open Shop
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapFocusController: React.FC<{
  focusShop: Shop | null;
  deliveryPin: { lat: number; lng: number } | null;
}> = ({ focusShop, deliveryPin }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (focusShop) {
      map.panTo(getShopCoordinates(focusShop.shopId, focusShop.neighborhood));
      map.setZoom(15);
    } else if (deliveryPin) {
      map.panTo(deliveryPin);
      map.setZoom(14);
    }
  }, [map, focusShop, deliveryPin]);

  return null;
};

const MapQuotaMonitor: React.FC = () => {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
    }
  }, [status]);

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="p-3 rounded-xl bg-[#FFFBEB] dark:bg-[#F59E0B]/10 border border-[#FDE68A] dark:border-[#F59E0B]/30 text-xs text-[#92400E] dark:text-[#F59E0B]">
        Interactive map tiles could not be loaded right now. Check your Maps quota or use Maps AI
        Grounding below.
      </div>
    );
  }

  return null;
};

const QUICK_GROUNDING_PROMPTS = [
  'Coffee shops & roasters near Piazza Hawassa',
  'Landmarks & parks along Lake Hawassa shore',
  'Transit & delivery hubs near Menhariya Hawassa',
];

export const ExploreMapScreen: React.FC<{ initialShopId?: string }> = ({ initialShopId }) => {
  const {
    goBack,
    navigate,
    shops,
    firebaseUser,
    language,
    selectedNeighborhood,
    userLocation,
    effectiveUserCoords,
    detectingLocation,
    detectUserLocation,
    proximityRankings,
    proximityByShopId,
    t,
  } = useMarketplace();

  const approvedShops = useMemo(() => shops.filter((s) => s.status === 'approved'), [shops]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(() => {
    if (initialShopId) {
      return shops.find((s) => s.shopId === initialShopId) ?? null;
    }
    return null;
  });

  const [mapsApiKey, setMapsApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || ''
  );
  const [keyLoading, setKeyLoading] = useState<boolean>(!mapsApiKey);
  const [deliveryPin, setDeliveryPin] = useState<{ lat: number; lng: number } | null>(() =>
    userLocation?.source === 'gps' ? userLocation.coords : null
  );

  // Maps Grounding State
  const [groundingQuery, setGroundingQuery] = useState('');
  const [useDeviceGps, setUseDeviceGps] = useState(false);
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);
  const [groundingText, setGroundingText] = useState<string | null>(null);
  const [groundedPlaces, setGroundedPlaces] = useState<GroundedPlaceItem[]>([]);

  // Saved Places in Cloud SQL
  const [savedPlaces, setSavedPlaces] = useState<SavedPlaceRow[]>([]);
  const [savingPlaceUri, setSavingPlaceUri] = useState<string | null>(null);

  useEffect(() => {
    if (mapsApiKey) {
      setKeyLoading(false);
      return;
    }
    let active = true;
    fetch('/api/maps-config')
      .then((res) => res.json())
      .then((data: { apiKey?: string }) => {
        if (active && data.apiKey) {
          setMapsApiKey(data.apiKey);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setKeyLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mapsApiKey]);

  const loadSavedPlaces = useCallback(async () => {
    if (!firebaseUser) {
      setSavedPlaces([]);
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/sql/places', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { places?: SavedPlaceRow[] };
        setSavedPlaces(data.places ?? []);
      }
    } catch {
      // Silent background sync fallback
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadSavedPlaces();
  }, [loadSavedPlaces]);

  const handleUseMyLocation = async () => {
    const loc = await detectUserLocation();
    setDeliveryPin(loc.coords);
    setUseDeviceGps(true);
  };

  const runMapsGrounding = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? groundingQuery).trim();
    if (!q) return;
    setGroundingQuery(q);
    setGroundingLoading(true);
    setGroundingError(null);

    try {
      const res = await fetch('/api/maps-grounding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: q,
          latitude: useDeviceGps && deliveryPin ? deliveryPin.lat : HAWASSA_CENTER.lat,
          longitude: useDeviceGps && deliveryPin ? deliveryPin.lng : HAWASSA_CENTER.lng,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          typeof data?.error === 'string' ? data.error : 'Maps Grounding lookup failed.'
        );
      }

      setGroundingText(data.text || '');
      setGroundedPlaces(Array.isArray(data.places) ? data.places : []);
    } catch (err) {
      setGroundingError(err instanceof Error ? err.message : 'Unable to query Google Maps data.');
    } finally {
      setGroundingLoading(false);
    }
  };

  const handleSaveGroundedPlace = async (place: GroundedPlaceItem) => {
    if (!firebaseUser) return;
    setSavingPlaceUri(place.uri);
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/sql/places', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: place.title,
          query: groundingQuery || 'Hawassa search',
          mapsUri: place.uri,
          notes: place.reviewSnippets?.[0] ?? null,
        }),
      });
      if (res.ok) {
        await loadSavedPlaces();
      }
    } finally {
      setSavingPlaceUri(null);
    }
  };

  const handleDeleteSavedPlace = async (placeId: number) => {
    if (!firebaseUser) return;
    const token = await firebaseUser.getIdToken();
    const res = await fetch(`/api/sql/places/${placeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSavedPlaces((prev) => prev.filter((p) => p.id !== placeId));
    }
  };

  const filteredShops = useMemo(() => {
    const rankedList =
      proximityRankings.length > 0 ? proximityRankings.map((r) => r.shop) : approvedShops;
    if (selectedNeighborhood === 'All Hawassa') return rankedList;
    const matches = rankedList.filter((s) => s.neighborhood === selectedNeighborhood);
    return matches.length > 0 ? matches : rankedList;
  }, [proximityRankings, approvedShops, selectedNeighborhood]);

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 dark:bg-[#1C2420]/95 backdrop-blur-md border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center min-w-0">
          <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100 truncate">
            Hawassa Live Map & Explorer
          </h1>
          <p className="text-[10px] text-[#46635E] dark:text-stone-400 truncate">
            Verified Shops · Google Maps Grounding
          </p>
        </div>
        <button
          type="button"
          onClick={handleUseMyLocation}
          aria-label="Center on my GPS location"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-[#10B981] hover:bg-[#E5F2EE] dark:hover:bg-[#10B981]/15"
        >
          <Navigation className="w-4 h-4" />
        </button>
      </header>

        <div className="p-4 space-y-5">
        {/* Live GPS Detection Bar */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-3.5 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100 truncate">
              {userLocation?.source === 'gps'
                ? t('liveGpsLabel', { neighborhood: userLocation.neighborhood })
                : t('nearestShopsForYou')}
            </div>
            <div className="text-[11px] text-[#46635E] dark:text-stone-400 tabular-nums mt-0.5 truncate">
              {effectiveUserCoords.lat.toFixed(4)}, {effectiveUserCoords.lng.toFixed(4)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={detectingLocation}
            className="min-h-[44px] px-3.5 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 text-[#FCFDFC] text-xs font-semibold flex items-center gap-1.5 shrink-0 shadow-[0_2px_8px_-2px_rgba(15,76,68,0.28)] dark:shadow-none transition-all disabled:opacity-70"
          >
            {detectingLocation ? (
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            ) : (
              <Navigation className="w-4 h-4 shrink-0" />
            )}
            <span>{detectingLocation ? t('detectingLocation') : t('detectMyLocation')}</span>
          </button>
        </section>

        {/* Interactive Google Map Container */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
              <span>Hawassa Merchant Map</span>
            </h2>
            <span className="text-[11px] text-[#46635E] dark:text-stone-400 tabular-nums">
              {filteredShops.length} shops pinned
            </span>
          </div>

          <div className="rounded-2xl overflow-hidden border border-[#D2E0DC] dark:border-[#2A3630] bg-[#FCFDFC] dark:bg-[#1C2420] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none">
            {keyLoading ? (
              <div className="h-[300px] flex items-center justify-center gap-2 text-xs text-stone-500 dark:text-stone-400">
                <Loader2 className="w-4 h-4 animate-spin text-[#047857] dark:text-[#10B981]" />
                <span>Loading Hawassa Map...</span>
              </div>
            ) : mapsApiKey ? (
              <APIProvider
                apiKey={mapsApiKey}
                libraries={['marker', 'places']}
                language={language === 'am' ? 'am' : 'en'}
                region="ET"
              >
                <MapQuotaMonitor />
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={
                    selectedShop
                      ? getShopCoordinates(selectedShop.shopId, selectedShop.neighborhood)
                      : effectiveUserCoords || HAWASSA_CENTER
                  }
                  defaultZoom={selectedShop ? 15 : 13}
                  gestureHandling="greedy"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '300px' }}
                  onClick={(e) => {
                    if (e.detail.latLng) {
                      setDeliveryPin({
                        lat: e.detail.latLng.lat,
                        lng: e.detail.latLng.lng,
                      });
                    }
                  }}
                >
                  <MapFocusController focusShop={selectedShop} deliveryPin={deliveryPin} />
                  {filteredShops.map((shop) => {
                    const prox = proximityByShopId[shop.shopId];
                    return (
                      <ShopMarkerItem
                        key={shop.shopId}
                        shop={shop}
                        isSelected={selectedShop?.shopId === shop.shopId}
                        isNearest={Boolean(prox?.isNearestForUser)}
                        distanceLabel={
                          prox ? t('nearestShopDistanceAway', { distance: prox.distanceLabel }) : undefined
                        }
                        bajajEtaLabel={
                          prox ? t('bajajEtaShort', { min: prox.estimatedBajajMinutes }) : undefined
                        }
                        onSelect={(s) => setSelectedShop(s)}
                        onClose={() => setSelectedShop(null)}
                        onVisitShop={(id) => navigate({ name: 'shop', shopId: id })}
                      />
                    );
                  })}
                  {deliveryPin && (
                    <AdvancedMarker position={deliveryPin} title="Your Hawassa Location">
                      <Pin background="#0284c7" borderColor="#075985" glyphColor="#ffffff" />
                    </AdvancedMarker>
                  )}
                </GoogleMap>
              </APIProvider>
            ) : (
              <div className="h-[200px] p-4 flex flex-col items-center justify-center text-center gap-2">
                <Compass className="w-6 h-6 text-[#047857] dark:text-[#10B981]" />
                <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Interactive Map Key Unavailable
                </div>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 max-w-xs">
                  Use the nearest shop directory cards below or query live Google Maps places with AI
                  Grounding.
                </p>
              </div>
            )}
          </div>

          {deliveryPin && (
            <div className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[11px] text-sky-900 dark:text-sky-200 flex items-center justify-between">
              <span className="tabular-nums">
                Delivery Pin: {deliveryPin.lat.toFixed(4)}, {deliveryPin.lng.toFixed(4)}
              </span>
              <button
                type="button"
                onClick={() => setDeliveryPin(null)}
                className="font-semibold text-sky-700 dark:text-sky-300 hover:underline"
              >
                Clear Pin
              </button>
            </div>
          )}

          {/* Nearest Shops For You Pin Selector Strip */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-stone-700 dark:text-stone-300">
              {t('nearestShopsForYou')}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 mobile-scroll">
              {filteredShops.map((shop) => {
                const prox = proximityByShopId[shop.shopId];
                const active = selectedShop?.shopId === shop.shopId;
                return (
                  <button
                    key={shop.shopId}
                    type="button"
                    onClick={() => setSelectedShop(shop)}
                    className={`shrink-0 px-3 py-2 rounded-xl border text-left transition-colors ${
                      active
                        ? 'bg-[#0F4C44] dark:bg-[#10B981] text-[#FCFDFC] dark:text-[#0B1410] border-[#0F4C44] dark:border-[#10B981]'
                        : prox?.isNearestForUser
                        ? 'bg-[#E5F2EE] dark:bg-[#10B981]/15 text-[#0E2421] dark:text-stone-100 border-[#0F4C44] dark:border-[#10B981]'
                        : 'bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-200 border-[#D2E0DC] dark:border-[#2A3630] hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]'
                    }`}
                  >
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Store className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate max-w-[140px]">{shop.name}</span>
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 tabular-nums ${
                        active
                          ? 'text-[#FCFDFC]/90 dark:text-[#0B1410]/85'
                          : prox?.isNearestForUser
                          ? 'text-[#0F4C44] dark:text-[#10B981] font-semibold'
                          : 'text-[#46635E] dark:text-stone-400'
                      }`}
                    >
                      {shop.neighborhood}
                      {prox ? ` · ${prox.distanceLabel}` : ''}
                      {prox?.isNearestForUser ? ` · ${t('nearestShopBadge')}` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Google Maps Grounding with Gemini */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#D97706] dark:text-[#F59E0B] shrink-0" />
              <div>
                <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">
                  Live Google Maps Place Finder
                </h2>
                <p className="text-[11px] text-[#46635E] dark:text-stone-400">
                  Discover real Hawassa landmarks, cafes & delivery drop-offs
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              runMapsGrounding();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#5E7B76] dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={groundingQuery}
                onChange={(e) => setGroundingQuery(e.target.value)}
                placeholder="Ask about places in Hawassa..."
                aria-label="Search real places in Hawassa with Google Maps Grounding"
                className="w-full min-h-[42px] pl-9 pr-3 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-400 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
              />
            </div>
            <button
              type="submit"
              disabled={groundingLoading || !groundingQuery.trim()}
              className="min-h-[42px] px-4 rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 shrink-0 transition-all"
            >
              {groundingLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>Find</span>
              )}
            </button>
          </form>

          <div className="flex flex-wrap gap-1.5">
            {QUICK_GROUNDING_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => runMapsGrounding(q)}
                className="px-2.5 py-1.5 rounded-lg bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] text-[11px] font-medium text-[#0E2421] dark:text-stone-300 hover:bg-[#E5F2EE] dark:hover:bg-[#10B981]/15 hover:border-[#0F4C44]/40 dark:hover:border-[#10B981]/40 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {groundingError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
              {groundingError}
            </div>
          )}

          {groundingText && (
            <div className="p-3.5 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] space-y-3">
              <div className="text-xs text-[#0E2421] dark:text-stone-200 whitespace-pre-line leading-relaxed">
                {groundingText}
              </div>

              {groundedPlaces.length > 0 && (
                <div className="pt-2 border-t border-[#D2E0DC] dark:border-[#2A3630] space-y-2">
                  <div className="text-[11px] font-bold text-[#0F4C44] dark:text-stone-300">
                    Google Maps Grounded Links ({groundedPlaces.length})
                  </div>
                  <div className="space-y-2">
                    {groundedPlaces.map((place, idx) => (
                      <div
                        key={`${place.uri}-${idx}`}
                        className="p-2.5 rounded-xl bg-[#FCFDFC] dark:bg-[#1C2420] border border-[#D2E0DC] dark:border-[#2A3630] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <a
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-[#0F4C44] dark:text-[#10B981] hover:underline flex items-center gap-1 min-w-0"
                          >
                            <span className="truncate">{place.title}</span>
                            <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                          {firebaseUser && (
                            <button
                              type="button"
                              onClick={() => handleSaveGroundedPlace(place)}
                              disabled={savingPlaceUri === place.uri}
                              className="px-2 py-1 rounded-lg border border-[#D2E0DC] dark:border-[#2A3630] text-[10px] font-semibold text-[#0E2421] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17] flex items-center gap-1 shrink-0"
                            >
                              <Bookmark className="w-3 h-3 text-[#D97706] dark:text-[#F59E0B]" />
                              <span>{savingPlaceUri === place.uri ? 'Saving...' : 'Save'}</span>
                            </button>
                          )}
                        </div>
                        {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                          <p className="text-[11px] text-[#46635E] dark:text-stone-400 italic leading-snug">
                            “{place.reviewSnippets[0]}”
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Saved Grounded Places (Synced for Signed-in Users) */}
        {firebaseUser && savedPlaces.length > 0 && (
          <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">
              Your Saved Hawassa Places ({savedPlaces.length})
            </h2>
            <div className="space-y-2">
              {savedPlaces.map((sp) => (
                <div
                  key={sp.id}
                  className="p-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    {sp.mapsUri ? (
                      <a
                        href={sp.mapsUri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-[#0F4C44] dark:text-[#10B981] hover:underline flex items-center gap-1 truncate"
                      >
                        <span className="truncate">{sp.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : (
                      <div className="text-xs font-bold text-[#0E2421] dark:text-stone-100 truncate">{sp.title}</div>
                    )}
                    <div className="text-[10px] text-[#46635E] dark:text-stone-400 truncate">{sp.query}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedPlace(sp.id)}
                    aria-label={`Remove ${sp.title}`}
                    className="p-1.5 text-stone-400 dark:text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
