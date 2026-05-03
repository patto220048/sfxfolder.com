"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import styles from "./LUTPreview.module.css";

const DEFAULT_REFERENCES = [
  { id: 'cinematic', label: 'Cinema', url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2025&auto=format&fit=crop' },
  { id: 'portrait', label: 'Portrait', url: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?q=80&w=1964&auto=format&fit=crop' },
  { id: 'landscape', label: 'Nature', url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=2070&auto=format&fit=crop' },
  { id: 'interior', label: 'Indoor', url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?q=80&w=2069&auto=format&fit=crop' },
];

export default function LUTPreview({ lutUrl, referenceImageUrl, name }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [sliderPos, setSliderPos] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRefImg, setActiveRefImg] = useState(referenceImageUrl || DEFAULT_REFERENCES[0].url);
  const sliderPosRef = useRef(50); // Use ref for smooth updates without re-triggering useEffect
  const glResourcesRef = useRef({ program: null, sliderLoc: null, gl: null });

  // Update ref when sliderPos changes (for the render loop to pick up)
  useEffect(() => {
    sliderPosRef.current = sliderPos;
  }, [sliderPos]);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const newPos = (x / rect.width) * 100;
    setSliderPos(newPos);
  }, []);

  const onMouseDown = () => setIsResizing(true);
  const onTouchStart = () => setIsResizing(true);

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
  }, [lutUrl, activeRefImg]); // ONLY re-run when source data changes

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.header}>
        <div className={styles.refSelector}>
          <span className={styles.selectorLabel}>Reference Scene:</span>
          <div className={styles.refButtons}>
            {DEFAULT_REFERENCES.map(ref => (
              <button 
                key={ref.id}
                className={`${styles.refButton} ${activeRefImg === ref.url ? styles.refButtonActive : ""}`}
                onClick={() => setActiveRefImg(ref.url)}
              >
                {ref.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.comparisonWrapper}>
        {isLoading && <div className={styles.loading}><div className={styles.spinner} /><span>Applying LUT...</span></div>}
        {error && <div className={styles.error}><span>{error}</span></div>}

        <canvas ref={canvasRef} className={styles.canvas} />
        
        <div className={styles.labels}>
          <div className={styles.labelItem} style={{ opacity: Math.max(0.4, sliderPos / 100) }}>
            <span className={styles.labelText}>ORIGINAL</span>
          </div>
          <div className={styles.labelItem} style={{ opacity: Math.max(0.4, (100 - sliderPos) / 100) }}>
            <span className={styles.labelText}>LUT PREVIEW</span>
          </div>
        </div>

        <div className={styles.slider} style={{ left: `${sliderPos}%` }} onMouseDown={onMouseDown} onTouchStart={onTouchStart}>
          <div className={styles.sliderLine} />
          <div className={styles.sliderHandle}>
            <div className={styles.handleArrows}><span>❮</span><span>❯</span></div>
          </div>
        </div>
      </div>
      
      <div className={styles.hintBar}>
        <p>Drag the slider to see the magic • Left: Original • Right: Graded</p>
      </div>
    </div>
  );
}
