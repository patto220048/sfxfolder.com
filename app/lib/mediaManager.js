/**
 * Global Media Manager — ensures only one audio/video plays at a time.
 * Also manages independent volume settings for different media categories.
 */

let activeMedia = null;
let activeCallback = null;
let activeType = null;
let activeMediaId = null;

// Settings structure
const settings = {
  video: { volume: 0.5, muted: false },
  audio: { volume: 0.5, muted: false }
};

const listeners = new Set();

if (typeof window !== 'undefined') {
  // Legacy migration and loading
  ['video', 'audio'].forEach(type => {
    const savedVol = localStorage.getItem(`SFXFolder.com_${type}_volume`);
    if (savedVol !== null) {
      settings[type].volume = parseFloat(savedVol);
    } else if (type === 'video') {
      // Fallback for legacy global volume
      const legacyVol = localStorage.getItem('SFXFolder.com_volume');
      if (legacyVol !== null) settings.video.volume = parseFloat(legacyVol);
    }

    const savedMuted = localStorage.getItem(`SFXFolder.com_${type}_muted`);
    if (savedMuted !== null) {
      settings[type].muted = savedMuted === 'true';
    } else if (type === 'video') {
      // Fallback for legacy global muted
      const legacyMuted = localStorage.getItem('SFXFolder.com_muted');
      if (legacyMuted !== null) settings.video.muted = legacyMuted === 'true';
    }
  });
}

function notify() {
  listeners.forEach(cb => cb({ ...settings, activeMediaId }));
}

export const mediaManager = {
  /**
   * Register a listener for setting changes
   * @param {Function} callback 
   * @returns {Function} unsubscribe function
   */
  subscribe(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },

  /**
   * Register and play a media element. Stops any currently playing media first.
   * @param {HTMLAudioElement|HTMLVideoElement} element
   * @param {string} type - 'video' or 'audio'
   * @param {Function} onStopped - callback when this media is stopped by another
   * @param {string} id - unique resource ID
   */
  play(element, type = 'video', onStopped, id = null) {
    // 1. Stop currently active media if it's a different element or different resource ID
    if (activeMedia && (activeMedia !== element || activeMediaId !== id)) {
      try {
        if (activeMedia && activeMedia !== element) {
          activeMedia.pause();
          activeMedia.currentTime = 0;
          if (activeCallback) activeCallback();
        } else if (activeMedia === element && activeMediaId !== id) {
          // Same element but different resource (Singleton being reused)
          activeMedia.pause(); // Ensure previous is paused before swapping
          if (activeCallback) activeCallback();
        }
      } catch (_) {
        // ignore if already disposed
      }
    }

    // 2. Set as active
    activeMedia = element;
    activeCallback = onStopped;
    activeType = type;
    activeMediaId = id;

    // 3. Apply global volume settings for this type
    this.applySettings(element, type);
    
    // 4. Notify subscribers of ID change
    notify();
  },

  /**
   * Apply current global volume/muted settings to an element
   * @param {HTMLAudioElement|HTMLVideoElement} element 
   * @param {string} type - 'video' or 'audio'
   */
  applySettings(element, type = 'video') {
    if (!element || !settings[type]) return;
    element.volume = settings[type].volume;
    element.muted = settings[type].muted;
  },

  /**
   * Unregister a media element (e.g., on pause or unmount).
   * @param {HTMLAudioElement|HTMLVideoElement} element
   */
  stop(element) {
    if (activeMedia === element) {
      activeMedia = null;
      activeCallback = null;
      activeType = null;
      activeMediaId = null;
      notify();
    }
  },

  /**
   * Stop all media and clear state (useful for route changes).
   */
  stopAll() {
    if (activeMedia) {
      try {
        activeMedia.pause();
        // Important: clear src to stop background loading
        if (activeMedia instanceof HTMLAudioElement || activeMedia instanceof HTMLVideoElement) {
          activeMedia.src = "";
          activeMedia.load();
        }
      } catch (_) {
        // ignore errors
      }
    }
    
    if (activeCallback) activeCallback();
    
    activeMedia = null;
    activeCallback = null;
    activeType = null;
    activeMediaId = null;
    notify();
  },

  /**
   * Check if a specific element is the currently active media.
   * @param {HTMLAudioElement|HTMLVideoElement} element
   * @returns {boolean}
   */
  isActive(element) {
    return activeMedia === element;
  },

  /**
   * Global Volume Controls
   */
  getVolume(type = 'video') { 
    return settings[type]?.volume ?? 0.5; 
  },
  
  setVolume(val, type = 'video') {
    if (!settings[type]) return;
    settings[type].volume = Math.max(0, Math.min(1, val));
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`SFXFolder.com_${type}_volume`, settings[type].volume);
    }
    
    // Update active media instantly if types match
    if (activeMedia && activeType === type) {
      activeMedia.volume = settings[type].volume;
    }
    
    notify();
  },

  getMuted(type = 'video') { 
    return settings[type]?.muted ?? false; 
  },
  
  setMuted(val, type = 'video') {
    if (!settings[type]) return;
    settings[type].muted = val;
    
    if (typeof window !== 'undefined') {
      localStorage.setItem(`SFXFolder.com_${type}_muted`, settings[type].muted);
    }
    
    // Update active media instantly if types match
    if (activeMedia && activeType === type) {
      activeMedia.muted = settings[type].muted;
    }
    
    notify();
  },

  /**
   * Get the singleton audio instance for sounds.
   * This prevents creating hundreds of Audio objects.
   */
  getSharedAudio() {
    initAudioElements();
    return activeAudio;
  },

  /**
   * Preload an audio URL using the background audio channel.
   * Does not interrupt the currently playing activeAudio channel.
   * @param {string} id 
   * @param {string} src 
   */
  preload(id, src) {
    initAudioElements();
    if (!id || !src) return;

    // If it's already active or already preloaded, skip
    if (activeMediaId === id || preloadedId === id) return;

    preloadedId = id;
    preloadedSrc = src;

    try {
      const normalizedUrl = new URL(src, window.location.href).href;
      const currentSrc = preloadAudio.src ? new URL(preloadAudio.src, window.location.href).href : "";
      if (currentSrc !== normalizedUrl) {
        preloadAudio.src = src;
        preloadAudio.load();
      }
    } catch (e) {
      preloadAudio.src = src;
      preloadAudio.load();
    }
  },

  /**
   * Retrieve preloaded audio. Swaps active and background audio channels
   * to enable instantaneous playback.
   * @param {string} id 
   * @returns {HTMLAudioElement}
   */
  getPreloadedAudio(id) {
    initAudioElements();
    if (id && preloadedId === id) {
      // Pause background loading if active on preloadAudio
      preloadAudio.pause();

      // Swap active and background audio roles
      const temp = activeAudio;
      activeAudio = preloadAudio;
      preloadAudio = temp;

      // Clear preloaded state
      preloadedId = null;
      preloadedSrc = null;
    }
    return activeAudio;
  },

  /**
   * Check if a specific resource ID is currently playing
   * @param {string} id 
   * @returns {boolean}
   */
  isIdActive(id) {
    return activeMediaId === id;
  },

  /**
   * Get the currently active resource ID
   * @returns {string|null}
   */
  getActiveId() {
    return activeMediaId;
  }
};

let audioPrimary = null;
let audioSecondary = null;
let activeAudio = null;
let preloadAudio = null;
let preloadedId = null;
let preloadedSrc = null;

function initAudioElements() {
  if (typeof window === 'undefined') return;
  if (!audioPrimary) {
    audioPrimary = new Audio();
    audioPrimary.preload = "auto";
    audioPrimary.addEventListener('ended', () => {
      if (activeCallback && activeAudio === audioPrimary) activeCallback();
      mediaManager.stop(audioPrimary);
    });
  }
  if (!audioSecondary) {
    audioSecondary = new Audio();
    audioSecondary.preload = "auto";
    audioSecondary.addEventListener('ended', () => {
      if (activeCallback && activeAudio === audioSecondary) activeCallback();
      mediaManager.stop(audioSecondary);
    });
  }
  if (!activeAudio) activeAudio = audioPrimary;
  if (!preloadAudio) preloadAudio = audioSecondary;
}


