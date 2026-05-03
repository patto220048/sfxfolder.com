/**
 * Media Utilities for file format detection
 */

export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'bmp'];
export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];
export const LUT_EXTENSIONS = ['cube', '3dl'];

/**
 * Gets the extension from a file name or format string
 */
export const getExtension = (nameOrFormat) => {
  if (!nameOrFormat) return '';
  // If it's just a format (e.g. "mp4"), return it
  if (!nameOrFormat.includes('.')) return nameOrFormat.toLowerCase().trim();
  // Otherwise extract from filename
  return nameOrFormat.split('.').pop().toLowerCase().trim();
};

export const isVideoFormat = (res) => {
  const format = res?.fileFormat || getExtension(res?.fileName || res?.name);
  return VIDEO_EXTENSIONS.includes(format.toLowerCase());
};

export const isAudioFormat = (res) => {
  const format = res?.fileFormat || getExtension(res?.fileName || res?.name);
  return AUDIO_EXTENSIONS.includes(format.toLowerCase());
};

export const isImageFormat = (res) => {
  const format = res?.fileFormat || getExtension(res?.fileName || res?.name);
  return IMAGE_EXTENSIONS.includes(format.toLowerCase());
};

export const isFontFormat = (res) => {
  const format = res?.fileFormat || getExtension(res?.fileName || res?.name);
  return FONT_EXTENSIONS.includes(format.toLowerCase());
};

export const isLUTFormat = (res) => {
  const format = res?.fileFormat || getExtension(res?.fileName || res?.name);
  return LUT_EXTENSIONS.includes(format.toLowerCase());
};

export const getMediaType = (res) => {
  if (isVideoFormat(res)) return 'video';
  if (isAudioFormat(res)) return 'audio';
  if (isImageFormat(res)) return 'image';
  if (isFontFormat(res)) return 'font';
  if (isLUTFormat(res)) return 'lut';
  return 'other';
};

/**
 * Generates an optimized URL for images or retrieves preview URL for videos.
 * Uses Supabase Image Transformation for images.
 * 
 * @param {Object|string} resource - The resource object or a direct URL string
 * @param {Object} options - Optimization options { width, quality, format, url }
 */
export const getOptimizedUrl = (resource, options = {}) => {
  if (!resource) return "";
  
  // Toggle this based on your Supabase plan (True = Pro, False = Free)
  // If False, it will always return the original URL
  const IS_SUPABASE_PRO = process.env.NEXT_PUBLIC_SUPABASE_TRANSFORM === 'true';

  const { 
    width, 
    quality = 80, 
    format = 'webp',
    url: manualUrl
  } = options;

  // Resolve the URL to optimize
  let urlToOptimize = manualUrl;
  
  if (!urlToOptimize) {
    if (typeof resource === 'string') {
      urlToOptimize = resource;
    } else {
      // It's a resource object
      if (isVideoFormat(resource)) {
        return resource.previewUrl || resource.downloadUrl || resource.fileUrl || "";
      }
      urlToOptimize = resource.downloadUrl || resource.fileUrl || "";
    }
  }

  if (!urlToOptimize) return "";

  // If not Pro or not a Supabase URL, return original
  if (!IS_SUPABASE_PRO || !urlToOptimize.includes(".supabase.co/storage/v1/object/public/")) {
    return urlToOptimize;
  }

  // Strict check for image extensions supported by Supabase Transformation
  const supportedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
  const ext = urlToOptimize.split('.').pop()?.toLowerCase();
  
  if (supportedExtensions.includes(ext)) {
    let transformedUrl = urlToOptimize.replace("/object/public/", "/render/image/public/");
    
    const params = [];
    if (width) params.push(`width=${width}`);
    if (quality) params.push(`quality=${quality}`);
    if (format) params.push(`format=${format}`);
    
    if (params.length > 0) {
      transformedUrl += (transformedUrl.includes("?") ? "&" : "?") + params.join("&");
    }
    return transformedUrl;
  }

  return urlToOptimize;
};
