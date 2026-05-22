/**
 * WebGL LUT Renderer Utility
 * Parses .cube files and applies them to images using fragment shaders.
 */

export async function loadAndParseLUT(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch LUT: ${response.statusText}`);
  }
  const text = await response.text();
  return parseLUTText(text);
}

export function parseLUTText(text) {
  const lines = text.split('\n');
  
  let size = 0;
  const rawData = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.startsWith('LUT_3D_SIZE')) {
      size = parseInt(line.split(/\s+/)[1]);
      continue;
    }

    const parts = line.split(/\s+/).filter(p => p.length > 0).map(Number);
    if (parts.length === 3 && !parts.some(isNaN)) {
      rawData.push(...parts);
    }
  }
  
  if (size === 0) {
    throw new Error("Invalid LUT file: LUT_3D_SIZE not found.");
  }

  const expectedValues = size * size * size * 3;
  if (rawData.length < expectedValues) {
    console.warn(`LUT data incomplete: expected ${expectedValues}, got ${rawData.length}`);
  }

  // Create RGBA data (4 channels for WebGL texture compatibility)
  const data = new Float32Array(size * size * size * 4);
  const uint8Data = new Uint8Array(size * size * size * 4);
  
  for (let i = 0; i < size * size * size; i++) {
    const r = rawData[i * 3] || 0;
    const g = rawData[i * 3 + 1] || 0;
    const b = rawData[i * 3 + 2] || 0;
    
    // Float data
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 1.0;

    // Uint8 data (clamped to 0-1 range then scaled to 0-255)
    uint8Data[i * 4] = Math.max(0, Math.min(255, r * 255));
    uint8Data[i * 4 + 1] = Math.max(0, Math.min(255, g * 255));
    uint8Data[i * 4 + 2] = Math.max(0, Math.min(255, b * 255));
    uint8Data[i * 4 + 3] = 255;
  }
  
  return { size, data, uint8Data };
}

export async function renderLUTToBlob(lutData, imageInput, targetWidth = 1200) {
  // 1. Load the image
  let image;
  if (imageInput instanceof HTMLImageElement) {
    image = imageInput;
  } else if (typeof imageInput === 'string') {
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load image for LUT rendering"));
      img.src = imageInput;
    });
  } else if (imageInput instanceof File || imageInput instanceof Blob) {
    image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };
      img.onerror = () => reject(new Error("Failed to load File/Blob for LUT rendering"));
      img.src = URL.createObjectURL(imageInput);
    });
  } else {
    throw new Error("Invalid image input for LUT rendering");
  }

  // 2. Create offscreen canvas
  const aspect = image.width / image.height;
  const canvasWidth = Math.min(targetWidth, image.width);
  const canvasHeight = Math.round(canvasWidth / aspect);

  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  // 3. Initialize WebGL 2
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false });
  if (!gl) {
    throw new Error("WebGL 2 context could not be created for offscreen LUT rendering.");
  }

  // 4. Compile shaders
  const vsSource = `#version 300 es
    in vec4 aVertexPosition;
    in vec2 aTextureCoord;
    out vec2 vTextureCoord;
    void main() {
      gl_Position = aVertexPosition;
      vTextureCoord = aTextureCoord;
    }
  `;

  const fsSource = `#version 300 es
    precision highp float;
    precision highp sampler3D;
    in vec2 vTextureCoord;
    out vec4 outColor;
    uniform sampler2D uSampler;
    uniform sampler3D uLutSampler;
    void main() {
      vec4 color = texture(uSampler, vTextureCoord);
      vec3 lookup = clamp(color.rgb, 0.0, 1.0);
      vec3 graded = texture(uLutSampler, lookup).rgb;
      outColor = vec4(graded, color.a);
    }
  `;

  const program = createShaderProgram(gl, vsSource, fsSource);
  gl.useProgram(program);

  // 5. Setup geometry & texture coords
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

  // 6. Setup textures
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
  gl.texImage3D(
    gl.TEXTURE_3D, 0, gl.RGBA8, 
    lutData.size, lutData.size, lutData.size, 
    0, gl.RGBA, gl.UNSIGNED_BYTE, lutData.uint8Data
  );
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

  gl.uniform1i(gl.getUniformLocation(program, "uSampler"), 0);
  gl.uniform1i(gl.getUniformLocation(program, "uLutSampler"), 1);

  // 7. Draw
  gl.viewport(0, 0, canvasWidth, canvasHeight);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  // 8. Convert to Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to convert canvas to blob"));
      }
    }, "image/jpeg", 0.9);
  });
}

export function createShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  if (!vertexShader || !fragmentShader) {
    throw new Error("Shader compilation failed. Check console for details.");
  }

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(shaderProgram);
    gl.deleteProgram(shaderProgram);
    throw new Error('Unable to initialize the shader program: ' + info);
  }

  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export const VS_SOURCE = `
  attribute vec4 aVertexPosition;
  attribute vec2 aTextureCoord;
  varying highp vec2 vTextureCoord;
  void main(void) {
    gl_Position = aVertexPosition;
    vTextureCoord = aTextureCoord;
  }
`;

export const FS_SOURCE = `
  precision highp float;
  varying highp vec2 vTextureCoord;
  uniform sampler2D uSampler;
  uniform sampler3D uLutSampler;
  uniform float uSliderPos;
  uniform bool uApplyLut;

  void main(void) {
    vec4 color = texture2D(uSampler, vTextureCoord);
    
    if (vTextureCoord.x > uSliderPos) {
      vec3 lutColor = texture(uLutSampler, color.rgb).rgb;
      gl_FragColor = vec4(lutColor, color.a);
    } else {
      gl_FragColor = color;
    }
  }
`;
