/**
 * Media Utilities for file format detection
 */

export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v'];
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'];
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'ico', 'bmp'];
export const FONT_EXTENSIONS = ['ttf', 'otf', 'woff', 'woff2', 'eot'];

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

export const getMediaType = (res) => {
  if (isVideoFormat(res)) return 'video';
  if (isAudioFormat(res)) return 'audio';
  if (isImageFormat(res)) return 'image';
  if (isFontFormat(res)) return 'font';
  return 'other';
};
