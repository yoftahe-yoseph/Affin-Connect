import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Film,
  ImagePlus,
  Loader2,
  Sparkles,
  Video,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatETB } from '../utils/marketplaceLogic';

type AspectRatio = '16:9' | '9:16';
type MotionStyle = 'zoom' | 'pan' | 'spotlight';

interface SavedReelRow {
  id: number;
  productId: string | null;
  title: string;
  caption: string;
  aspectRatio: string;
}

export const VideoStudioScreen: React.FC = () => {
  const { goBack, products, firebaseUser } = useMarketplace();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.productId ?? ''
  );
  const [imageSrc, setImageSrc] = useState<string>(products[0]?.imageUrl ?? '');
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string>('image/jpeg');

  const [headline, setHeadline] = useState<string>(
    products[0]?.name ?? 'Fresh from Hawasa Gebeya'
  );
  const [subtitle, setSubtitle] = useState<string>(
    products[0]
      ? `${products[0].shopName} · ${formatETB(products[0].price)}`
      : 'Same-day delivery across Hawassa'
  );
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('9:16');
  const [motionStyle, setMotionStyle] = useState<MotionStyle>('zoom');

  const [captionLoading, setCaptionLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [savedReels, setSavedReels] = useState<SavedReelRow[]>([]);

  const selectedProduct = products.find((p) => p.productId === selectedProductId);

  const loadReels = useCallback(async () => {
    if (!firebaseUser) {
      setSavedReels([]);
      return;
    }
    try {
      const token = await firebaseUser.getIdToken();
      const res = await fetch('/api/sql/reels', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = (await res.json()) as { reels?: SavedReelRow[] };
        setSavedReels(data.reels ?? []);
      }
    } catch {
      // Ignore silent background load error
    }
  }, [firebaseUser]);

  useEffect(() => {
    loadReels();
  }, [loadReels]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

  const handleSelectCatalogProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.productId === productId);
    if (prod) {
      setImageSrc(prod.imageUrl);
      setImageBase64(null);
      setHeadline(prod.name);
      setSubtitle(`${prod.shopName} · ${formatETB(prod.price)}`);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageMimeType(file.type || 'image/jpeg');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setImageSrc(dataUrl);
      const base64Part = dataUrl.split(',')[1] || '';
      setImageBase64(base64Part);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateAiCaption = async () => {
    setCaptionLoading(true);
    setRenderError(null);
    try {
      const res = await fetch('/api/video/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: selectedProduct?.name || headline,
          shopName: selectedProduct?.shopName || 'Hawasa Gebeya',
          priceEtb: selectedProduct?.price,
          imageBase64: imageBase64 ?? undefined,
          mimeType: imageBase64 ? imageMimeType : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate caption.');
      if (data.headline) setHeadline(data.headline);
      if (data.subtitle) setSubtitle(data.subtitle);
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Caption generation failed.');
    } finally {
      setCaptionLoading(false);
    }
  };

  const handleAnimateToVideo = async () => {
    if (!imageSrc) return;
    setRendering(true);
    setRenderError(null);

    try {
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('Video recording is not supported in this browser.');
      }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Could not load the selected photo.'));
        img.src = imageSrc;
      });

      const width = aspectRatio === '16:9' ? 960 : 540;
      const height = aspectRatio === '16:9' ? 540 : 960;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable.');

      const stream = canvas.captureStream(30);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const recordingDone = new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: 'video/webm' }));
        };
      });

      recorder.start();

      const durationMs = 3600;
      const startTime = performance.now();

      await new Promise<void>((resolve) => {
        const renderFrame = (now: number) => {
          const progress = Math.min(1, (now - startTime) / durationMs);
          const eased = 0.5 - 0.5 * Math.cos(progress * Math.PI);

          ctx.fillStyle = '#064e3b';
          ctx.fillRect(0, 0, width, height);

          // Compute cover scale + smooth Ken Burns / Pan / Spotlight motion
          const baseScale = Math.max(width / img.width, height / img.height);
          let scale = baseScale * (1 + 0.14 * eased);
          let offsetX = 0;
          let offsetY = 0;

          if (motionStyle === 'pan') {
            scale = baseScale * 1.18;
            offsetX = (eased - 0.5) * width * 0.12;
            offsetY = (0.5 - eased) * height * 0.06;
          } else if (motionStyle === 'spotlight') {
            scale = baseScale * (1.16 - 0.12 * eased);
          }

          const drawW = img.width * scale;
          const drawH = img.height * scale;
          const drawX = (width - drawW) / 2 + offsetX;
          const drawY = (height - drawH) / 2 + offsetY;

          ctx.drawImage(img, drawX, drawY, drawW, drawH);

          // Gradient overlay at bottom for clean typography
          const grad = ctx.createLinearGradient(0, height * 0.52, 0, height);
          grad.addColorStop(0, 'rgba(6, 78, 59, 0)');
          grad.addColorStop(0.55, 'rgba(6, 78, 59, 0.72)');
          grad.addColorStop(1, 'rgba(2, 44, 34, 0.94)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, width, height);

          // Brand tag
          ctx.fillStyle = '#f59e0b';
          ctx.font = `700 ${Math.round(width * 0.026)}px sans-serif`;
          ctx.fillText('HAWASA GEBEYA · SIDAMA', Math.round(width * 0.06), Math.round(height * 0.81));

          // Headline
          ctx.fillStyle = '#ffffff';
          ctx.font = `700 ${Math.round(width * 0.045)}px sans-serif`;
          ctx.fillText(
            headline.slice(0, 36),
            Math.round(width * 0.06),
            Math.round(height * 0.87)
          );

          // Subtitle
          ctx.fillStyle = '#d6d3d1';
          ctx.font = `500 ${Math.round(width * 0.029)}px sans-serif`;
          ctx.fillText(
            subtitle.slice(0, 52),
            Math.round(width * 0.06),
            Math.round(height * 0.92)
          );

          if (progress < 1) {
            requestAnimationFrame(renderFrame);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(renderFrame);
      });

      recorder.stop();
      const blob = await recordingDone;
      const nextUrl = URL.createObjectURL(blob);
      setVideoUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return nextUrl;
      });

      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();
          await fetch('/api/sql/reels', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              productId: selectedProductId || null,
              title: headline,
              caption: subtitle,
              aspectRatio,
            }),
          });
          await loadReels();
        } catch {
          // Optional persistence failure does not block rendered video
        }
      }
    } catch (err) {
      setRenderError(err instanceof Error ? err.message : 'Unable to animate image into video.');
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-20 bg-[#FCFDFC]/95 backdrop-blur-md dark:bg-[#1C2420] border-b border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_12px_-6px_rgba(15,76,68,0.12)] dark:shadow-none px-3 py-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          aria-label="Go back"
          className="min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-[#0F4C44] dark:text-stone-300 hover:bg-[#EBF1EE] dark:hover:bg-[#141A17]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-sm font-display font-bold text-[#0F4C44] dark:text-stone-100">
            Photo-to-Video Studio
          </h1>
          <p className="text-[10px] text-[#46635E] dark:text-stone-400">Create 16:9 or 9:16 Shop Reels</p>
        </div>
        <div className="w-11" />
      </header>

      <div className="p-4 space-y-4">
        {/* Source Photo Selection */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">1. Choose or Upload Photo</h2>
            <label className="px-3 py-1.5 rounded-xl bg-[#0F4C44] dark:bg-[#2A3630] text-[#FCFDFC] text-[11px] font-semibold cursor-pointer flex items-center gap-1.5 hover:bg-[#0B3B35] dark:hover:bg-[#34423B] transition-colors">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="sr-only"
              />
            </label>
          </div>

          <select
            aria-label="Pick a Hawassa catalog photo"
            value={selectedProductId}
            onChange={(e) => handleSelectCatalogProduct(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs font-medium text-[#0E2421] dark:text-stone-100 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
          >
            {products.map((p) => (
              <option key={p.productId} value={p.productId} className="bg-[#FCFDFC] dark:bg-[#1C2420] text-[#0E2421] dark:text-stone-100">
                {p.name} ({formatETB(p.price)})
              </option>
            ))}
          </select>

          {imageSrc && (
            <div className="rounded-xl overflow-hidden border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] flex justify-center">
              <img
                src={imageSrc}
                alt="Selected reel frame"
                className={`object-cover transition-all ${
                  aspectRatio === '16:9' ? 'w-full aspect-video' : 'w-44 aspect-[9/16]'
                }`}
              />
            </div>
          )}
        </section>

        {/* Aspect Ratio, Motion & Overlay Copy */}
        <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
          <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">2. Format & Promo Copy</h2>

          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: '9:16', label: '9:16 Portrait Reel' },
                { id: '16:9', label: '16:9 Landscape' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAspectRatio(opt.id)}
                className={`py-2.5 px-3 rounded-xl border text-xs font-semibold transition-colors ${
                  aspectRatio === opt.id
                    ? 'bg-[#E5F2EE] dark:bg-[#10B981]/15 text-[#0F4C44] dark:text-[#10B981] border-[#0F4C44] dark:border-[#10B981]'
                    : 'bg-[#F3F6F4] dark:bg-[#141A17] text-[#46635E] dark:text-stone-300 border-[#D2E0DC] dark:border-[#2A3630] hover:bg-[#EBF1EE] dark:hover:bg-[#1C2420]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'zoom', label: 'Slow Zoom' },
                { id: 'pan', label: 'Pan Slide' },
                { id: 'spotlight', label: 'Spotlight' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMotionStyle(m.id)}
                className={`py-2 px-2 rounded-lg text-[11px] font-semibold border transition-colors ${
                  motionStyle === m.id
                    ? 'bg-[#FFFBEB] dark:bg-[#F59E0B]/15 border-[#D97706] dark:border-[#F59E0B] text-[#92400E] dark:text-[#F59E0B]'
                    : 'bg-[#F3F6F4] dark:bg-[#141A17] border-[#D2E0DC] dark:border-[#2A3630] text-[#46635E] dark:text-stone-300'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#46635E] dark:text-stone-400">Video Overlay Text</span>
              <button
                type="button"
                onClick={handleGenerateAiCaption}
                disabled={captionLoading}
                className="text-[11px] font-semibold text-[#0F4C44] dark:text-[#10B981] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                {captionLoading ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-[#D97706] dark:text-[#F59E0B]" />
                )}
                <span>Suggest with Gemini</span>
              </button>
            </div>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="Headline"
              className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
            />
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Subtitle / Price"
              className="w-full p-2.5 rounded-xl border border-[#D2E0DC] dark:border-[#2A3630] bg-[#F3F6F4] dark:bg-[#141A17] text-xs text-[#0E2421] dark:text-stone-100 placeholder:text-[#5E7B76] dark:placeholder:text-stone-500 focus:outline-none focus:ring-4 focus:ring-[#E5F2EE] dark:focus:ring-[#10B981]/20 focus:border-[#0F4C44] dark:focus:border-[#10B981]"
            />
          </div>

          <button
            type="button"
            onClick={handleAnimateToVideo}
            disabled={rendering || !imageSrc}
            className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-[#0F4C44] to-[#047857] hover:brightness-105 dark:bg-none dark:bg-[#10B981] dark:hover:bg-[#059669] text-[#FCFDFC] dark:text-[#0B1410] text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-[0_2px_8px_-2px_rgba(15,76,68,0.28)] dark:shadow-none"
          >
            {rendering ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Animating Video ({aspectRatio})...</span>
              </>
            ) : (
              <>
                <Video className="w-4 h-4" />
                <span>Animate Photo into Video</span>
              </>
            )}
          </button>
        </section>

        {renderError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200">
            {renderError}
          </div>
        )}

        {videoUrl && (
          <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100 flex items-center gap-1.5">
                <Film className="w-4 h-4 text-[#0F4C44] dark:text-[#10B981]" />
                <span>Generated Promo Video ({aspectRatio})</span>
              </h2>
              <a
                href={videoUrl}
                download={`hawasa-gebeya-reel-${aspectRatio.replace(':', 'x')}.webm`}
                className="px-3 py-1.5 rounded-lg bg-[#0F4C44] dark:bg-[#2A3630] hover:bg-[#0B3B35] dark:hover:bg-[#34423B] text-[#FCFDFC] text-[11px] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </a>
            </div>
            <video
              src={videoUrl}
              controls
              playsInline
              loop
              className={`w-full rounded-xl bg-black ${
                aspectRatio === '16:9' ? 'aspect-video' : 'max-h-[420px]'
              }`}
            />
          </section>
        )}

        {firebaseUser && savedReels.length > 0 && (
          <section className="bg-[#FCFDFC] dark:bg-[#1C2420] rounded-2xl border border-[#D2E0DC] dark:border-[#2A3630] shadow-[0_2px_10px_-3px_rgba(15,76,68,0.09)] dark:shadow-none p-4 space-y-2">
            <h2 className="text-xs font-bold text-[#0F4C44] dark:text-stone-100">
              Recent Shop Reels ({savedReels.length})
            </h2>
            <div className="space-y-1.5">
              {savedReels.slice(0, 5).map((r) => (
                <div
                  key={r.id}
                  className="p-2.5 rounded-xl bg-[#F3F6F4] dark:bg-[#141A17] border border-[#D2E0DC] dark:border-[#2A3630] flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#0E2421] dark:text-stone-100 truncate">{r.title}</div>
                    <div className="text-[10px] text-[#46635E] dark:text-stone-400 truncate">{r.caption}</div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-[#0F4C44] dark:text-[#10B981] shrink-0">
                    {r.aspectRatio}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
