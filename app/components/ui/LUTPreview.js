"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import styles from "./LUTPreview.module.css";

const getOptimizedUrl = (url, { width, quality }) => {
  if (!url) return "";
  if (!url.startsWith('http')) return url;
  const baseUrl = url.split('?')[0];
  return `${baseUrl}?q=${quality}&w=${width}&auto=format&fit=crop`;
};

const SAMPLE_IMAGES = [
  { id: 'portrait', name: 'Portrait', url: '/images/samples/portrait.png', gradedUrl: null },
  { id: 'cinematic', name: 'Cinematic', url: '/images/samples/cinematic.png', gradedUrl: null },
  { id: 'nature', name: 'Nature', url: '/images/samples/nature.png', gradedUrl: null },
];

export default function LUTPreview({ 
  lutUrl, 
  referenceImageUrl, 
  thumbnailUrl, 
  gradedPreviewUrl,
  gradedThumbnailUrl,
  customSamples = [],
  name, 
  resourceName, 
  variant = 'full' 
}) {
  const isCard = variant === 'card';
  const finalName = name || resourceName;
  const [sliderPos, setSliderPos] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const hasCustomImage = !!(referenceImageUrl || thumbnailUrl);

  const samples = useMemo(() => {
    const list = [];
    
    // 1. If there is a custom preview image uploaded for this resource, always include it first
    if (hasCustomImage) {
      list.push({
        id: 'custom',
        name: 'Custom Preview',
        url: referenceImageUrl || thumbnailUrl,
        gradedUrl: gradedPreviewUrl || gradedThumbnailUrl || null,
        isCustom: true
      });
    }
    
    // 2. Add custom samples if they are actually custom (not the auto-populated default samples)
    const realCustomSamples = (customSamples || []).filter(
      s => s.id !== 'portrait' && s.id !== 'cinematic' && s.id !== 'nature'
    );
    
    if (realCustomSamples.length > 0) {
      realCustomSamples.forEach(s => {
        list.push({
          id: `custom-${s.id}`,
          name: s.name || 'Custom',
          url: s.url,
          gradedUrl: s.gradedUrl || s.graded_url || null,
          isCustom: true
        });
      });
    }
    
    // 3. If we still have nothing, display the default sample images (from customSamples or SAMPLE_IMAGES)
    if (list.length === 0) {
      const systemSamples = (customSamples || []).filter(
        s => s.id === 'portrait' || s.id === 'cinematic' || s.id === 'nature'
      );
      if (systemSamples.length > 0) {
        return systemSamples.map(s => ({
          id: `custom-${s.id}`,
          name: s.name,
          url: s.url,
          gradedUrl: s.gradedUrl || s.graded_url || null,
          isCustom: false
        }));
      }
      return SAMPLE_IMAGES;
    }
    
    return list;
  }, [customSamples, hasCustomImage, referenceImageUrl, thumbnailUrl, gradedPreviewUrl, gradedThumbnailUrl]);

  const [currentSampleId, setCurrentSampleId] = useState(() => {
    return samples[0]?.id || 'portrait';
  });

  useEffect(() => {
    if (samples.length > 0) {
      if (!samples.some(s => s.id === currentSampleId)) {
        setCurrentSampleId(samples[0].id);
      }
    }
  }, [samples, currentSampleId]);

  const activeSample = useMemo(() => {
    return samples.find(s => s.id === currentSampleId) || samples[0];
  }, [samples, currentSampleId]);

  const activeImageUrl = useMemo(() => {
    const url = activeSample?.url || SAMPLE_IMAGES[0].url;
    return url.startsWith('http') 
      ? getOptimizedUrl(url, { width: 2000, quality: 90 }) 
      : url;
  }, [activeSample]);

  const activeGradedImageUrl = useMemo(() => {
    const url = activeSample?.gradedUrl;
    if (!url) return null;
    return url.startsWith('http') 
      ? getOptimizedUrl(url, { width: 2000, quality: 90 }) 
      : url;
  }, [activeSample]);

  const containerRef = useRef(null);
  const [imageRatio, setImageRatio] = useState(null);
  const [imgBounds, setImgBounds] = useState({ left: 0, width: 0 });
  const [originalLoaded, setOriginalLoaded] = useState(false);
  const [gradedLoaded, setGradedLoaded] = useState(false);

  useEffect(() => {
    setSliderPos(50);
  }, [activeImageUrl]);

  useEffect(() => {
    setOriginalLoaded(false);
    setGradedLoaded(false);
    setIsLoading(true);
    setError(null);
  }, [currentSampleId]);

  useEffect(() => {
    if (!activeGradedImageUrl) {
      if (originalLoaded) {
        setIsLoading(false);
      }
    } else {
      if (originalLoaded && gradedLoaded) {
        setIsLoading(false);
      }
    }
  }, [originalLoaded, gradedLoaded, activeGradedImageUrl]);

  const updateImgBounds = useCallback(() => {
    if (!containerRef.current || !imageRatio) return;
    const wrapper = containerRef.current.querySelector(`.${styles.comparisonWrapper}`);
    if (!wrapper) return;
    
    const rect = wrapper.getBoundingClientRect();
    const wrapperWidth = rect.width;
    const wrapperHeight = rect.height;
    
    if (wrapperWidth === 0 || wrapperHeight === 0) return;
    
    const wrapperRatio = wrapperWidth / wrapperHeight;
    
    let renderedWidth, leftOffset;
    if (imageRatio > wrapperRatio) {
      renderedWidth = wrapperWidth;
      leftOffset = 0;
    } else {
      renderedWidth = wrapperHeight * imageRatio;
      leftOffset = (wrapperWidth - renderedWidth) / 2;
    }
    
    setImgBounds({ left: leftOffset, width: renderedWidth });
  }, [imageRatio]);

  useEffect(() => {
    if (!imageRatio) return;
    updateImgBounds();
    window.addEventListener("resize", updateImgBounds);
    return () => window.removeEventListener("resize", updateImgBounds);
  }, [imageRatio, updateImgBounds]);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current || !imageRatio) return;
    
    const wrapper = containerRef.current.querySelector(`.${styles.comparisonWrapper}`);
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    
    const wrapperWidth = rect.width;
    const wrapperHeight = rect.height;
    const wrapperRatio = wrapperWidth / wrapperHeight;
    
    let renderedWidth, leftOffset;
    if (imageRatio > wrapperRatio) {
      renderedWidth = wrapperWidth;
      leftOffset = 0;
    } else {
      renderedWidth = wrapperHeight * imageRatio;
      leftOffset = (wrapperWidth - renderedWidth) / 2;
    }

    const relativeX = clientX - rect.left;
    const clampedX = Math.max(leftOffset, Math.min(relativeX, leftOffset + renderedWidth));
    
    const newPos = (clampedX / wrapperWidth) * 100;
    setSliderPos(newPos);
  }, [imageRatio]);

  const onMouseDown = (e) => {
    setIsResizing(true);
    handleMove(e.clientX);
  };
  const onTouchStart = (e) => {
    setIsResizing(true);
    handleMove(e.touches[0].clientX);
  };

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e) => handleMove(e.clientX);
    const onTouchMove = (e) => handleMove(e.touches[0].clientX);
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("touchend", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("touchend", onMouseUp);
    };
  }, [isResizing, handleMove]);

  const isOverlay = variant === 'overlay';

  return (
    <div className={`${styles.container} ${isCard ? styles.cardMode : ''}`} ref={containerRef}>
      {!isCard && (
        <div className={`${styles.header} ${isOverlay ? styles.overlayHeader : ''}`}>
          <div className={styles.titleWrapper}>
            <h3 className={styles.previewTitle}>{finalName}</h3>
          </div>
          
          {samples.length > 1 && (
            <div className={styles.sampleSwitcher}>
              <span className={styles.switcherLabel}>Samples:</span>
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  className={`${styles.sampleButton} ${currentSampleId === sample.id ? styles.sampleActive : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentSampleId(sample.id);
                  }}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div 
        className={styles.comparisonWrapper} 
        onMouseDown={activeGradedImageUrl ? onMouseDown : undefined}
        onTouchStart={activeGradedImageUrl ? onTouchStart : undefined}
      >
        {/* Original Image */}
        <img 
          src={activeImageUrl} 
          alt="Original" 
          className={styles.imageOriginal}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.target;
            if (naturalWidth && naturalHeight) {
              setImageRatio(naturalWidth / naturalHeight);
            }
            setOriginalLoaded(true);
          }}
          onError={() => {
            setOriginalLoaded(true);
            setError("Failed to load preview image");
          }}
        />

        {/* Graded Image */}
        {activeGradedImageUrl && (
          <img 
            src={activeGradedImageUrl} 
            alt="Graded" 
            className={styles.imageGraded}
            style={{ 
              clipPath: `inset(0 0 0 ${sliderPos}%)`
            }}
            onLoad={() => setGradedLoaded(true)}
            onError={() => {
              setGradedLoaded(true);
              console.warn("Failed to load graded preview image");
            }}
          />
        )}
        
        {isLoading && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
            <p>Loading preview...</p>
          </div>
        )}

        {error && (
          <div className={styles.overlay}>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {!isLoading && !error && activeGradedImageUrl && (
          <>
            <div 
              className={styles.slider} 
              style={{ left: `${sliderPos}%` }}
            >
              <div className={styles.sliderLine} />
              <div className={styles.sliderHandle} />
            </div>

            <div 
              className={styles.labels}
              style={imgBounds.width > 0 ? {
                left: `${imgBounds.left}px`,
                width: `${imgBounds.width}px`
              } : undefined}
            >
              <div 
                className={styles.labelWrapper}
                style={{ opacity: Math.max(0, Math.min(1, (sliderPos - 15) / 15)) }}
              >
                <span className={styles.labelBefore}>ORIGINAL</span>
              </div>
              <div 
                className={styles.labelWrapper}
                style={{ opacity: Math.max(0, Math.min(1, (85 - sliderPos) / 15)) }}
              >
                <span className={styles.labelAfter}>LUT PREVIEW</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
