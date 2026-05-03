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
      // Apply LUT (simplified 3D lookup)
      // WebGL 2 supports texture3D directly
      vec3 lutColor = texture(uLutSampler, color.rgb).rgb;
      gl_FragColor = vec4(lutColor, color.a);
    } else {
      gl_FragColor = color;
    }
  }
`;
