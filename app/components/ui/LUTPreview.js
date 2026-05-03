"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./LUTPreview.module.css";

const getOptimizedUrl = (url, { width, quality }) => {
  const baseUrl = url.split('?')[0];
  return `${baseUrl}?q=${quality}&w=${width}&auto=format&fit=crop`;
};

const SAMPLE_IMAGES = [
  { id: 'portrait', name: 'Portrait', url: '/images/samples/portrait.png' },
  { id: 'cinematic', name: 'Cinematic', url: '/images/samples/cinematic.png' },
  { id: 'nature', name: 'Nature', url: '/images/samples/nature.png' },
];

export default function LUTPreview({ 
  lutUrl, 
  referenceImageUrl, 
  thumbnailUrl, 
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
  const [currentSampleId, setCurrentSampleId] = useState(SAMPLE_IMAGES[0].id);

  const activeImageUrl = (referenceImageUrl || thumbnailUrl) ? (referenceImageUrl || thumbnailUrl) : 
    (SAMPLE_IMAGES.find(s => s.id === currentSampleId)?.url || SAMPLE_IMAGES[0].url);

  const [activeRefImg, setActiveRefImg] = useState(() => {
    return activeImageUrl.startsWith('http') 
        ? getOptimizedUrl(activeImageUrl, { width: 2560, quality: 95 }) 
        : activeImageUrl;
  });

  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const sliderPosRef = useRef(50);

  useEffect(() => {
    sliderPosRef.current = sliderPos;
  }, [sliderPos]);

  useEffect(() => {
    const finalUrl = activeImageUrl.startsWith('http')
      ? getOptimizedUrl(activeImageUrl, { width: 2560, quality: 95 })
      : activeImageUrl;
    setActiveRefImg(finalUrl);
  }, [activeImageUrl]);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newPos = (x / rect.width) * 100;
    setSliderPos(newPos);
  }, []);

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

  useEffect(() => {
    let active = true;
    let rafId = null;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
    if (!gl) {
      setError("WebGL 2 not supported");
      return;
    }

    async function init() {
      try {
        setIsLoading(true);
        setError(null);
        
        const { loadAndParseLUT, createShaderProgram } = await import("@/app/lib/lutRenderer");
        
        const [lut, image] = await Promise.all([
          loadAndParseLUT(lutUrl),
          new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error("Reference image load failed"));
            img.src = activeRefImg;
          })
        ]);

        if (!active) return;
        if (!lut || !lut.uint8Data) throw new Error("Invalid LUT data");

        const fs30 = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vTextureCoord;
out vec4 outColor;
uniform sampler2D uSampler;
uniform sampler3D uLutSampler;
uniform float uSliderPos;
void main() {
  vec4 color = texture(uSampler, vTextureCoord);
  vec3 lookup = clamp(color.rgb, 0.0, 1.0);
  if (vTextureCoord.x > uSliderPos) {
    vec3 graded = texture(uLutSampler, lookup).rgb;
    outColor = vec4(graded, color.a);
  } else {
    outColor = color;
  }
}`;
        const vs30 = `#version 300 es
in vec4 aVertexPosition;
in vec2 aTextureCoord;
out vec2 vTextureCoord;
void main() {
  gl_Position = aVertexPosition;
  vTextureCoord = aTextureCoord;
}`;

        const program = createShaderProgram(gl, vs30, fs30);
        gl.useProgram(program);

        const positions = new Float32Array([-1, 1, 1, 1, -1, -1, 1, -1]);
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        const posLoc = gl.getAttribLocation(program, "aVertexPosition");
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const texCoords = new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]);
        const texBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, texCoords, gl.STATIC_DRAW);
        const texLoc = gl.getAttribLocation(program, "aTextureCoord");
        gl.enableVertexAttribArray(texLoc);
        gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        const imageTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, imageTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

        const lutTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_3D, lutTexture);
        gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, lut.size, lut.size, lut.size, 0, gl.RGBA, gl.UNSIGNED_BYTE, lut.uint8Data);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);
        gl.uniform1i(gl.getUniformLocation(program, "uLutSampler"), 1);
        const sliderLoc = gl.getUniformLocation(program, "uSliderPos");

        canvas.width = image.width;
        canvas.height = image.height;
        gl.viewport(0, 0, canvas.width, canvas.height);

        const render = () => {
          if (!active) return;
          gl.uniform1f(sliderLoc, sliderPosRef.current / 100);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          rafId = requestAnimationFrame(render);
        };
        
        rafId = requestAnimationFrame(render);
        setIsLoading(false);
      } catch (e) {
        console.error("LUT Preview Error:", e);
        if (active) setError(e.message || "Failed to render LUT");
      }
    }

    init();
    return () => { 
      active = false; 
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [lutUrl, activeRefImg]);

  return (
    <div className={`${styles.container} ${isCard ? styles.cardMode : ''}`} ref={containerRef}>
      {!isCard && (
        <div className={styles.header}>
          <div className={styles.titleWrapper}>
            <h3 className={styles.previewTitle}>{finalName}</h3>
          </div>
          
          <div className={styles.sampleSwitcher}>
            <span className={styles.switcherLabel}>Samples:</span>
            {SAMPLE_IMAGES.map((sample) => (
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
        </div>
      )}

      <div 
        className={styles.comparisonWrapper} 
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
      >
        <canvas ref={canvasRef} className={styles.canvas} />
        
        {isLoading && (
          <div className={styles.overlay}>
            <div className={styles.spinner} />
            <p>Processing LUT...</p>
          </div>
        )}

        {error && (
          <div className={styles.overlay}>
            <p className={styles.errorText}>{error}</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            <div 
              className={styles.slider} 
              style={{ left: `${sliderPos}%` }}
            >
              <div className={styles.sliderLine} />
              <div className={styles.sliderHandle} />
            </div>

            <div className={styles.labels}>
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
