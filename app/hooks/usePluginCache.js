"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/lib/auth-context";

// Global store to persist status between navigation within the same session
const pluginCacheStore = new Map();

// Initial load from localStorage with Versioning
if (typeof window !== 'undefined') {
  const CACHE_KEY = 'premiere_plugin_cache';
  const VER_KEY = 'premiere_plugin_cache_v';
  const CURRENT_VER = 'v4'; 

  try {
    const savedVer = localStorage.getItem(VER_KEY);
    if (savedVer !== CURRENT_VER) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(VER_KEY, CURRENT_VER);
    }
  } catch (e) {
    console.error("Cache initialization error:", e);
  }
}

// Helper to update store and localStorage
const updateCacheStore = (id, status) => {
  if (!id) return;
  const sid = String(id);
  pluginCacheStore.set(sid, status);
  if (typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(localStorage.getItem('premiere_plugin_cache') || '{}');
      if (status === 'cached') {
        saved[sid] = 'cached';
      } else {
        delete saved[sid];
      }
      localStorage.setItem('premiere_plugin_cache', JSON.stringify(saved));
    } catch (e) {}
  }
};

/**
 * Hook to manage resource cache status and communication with Premiere Pro Plugin Shell
 */
export function usePluginCache(resourceId, fileName, fileFormat) {
  const { isPlugin } = useAuth();
  
  const [downloadStatus, setDownloadStatus] = useState('idle'); 
  const [progress, setProgress] = useState(0);
  const [lastError, setLastError] = useState(null);

  const isInsidePlugin = isPlugin || (typeof window !== 'undefined' && window.location.search.includes('mode=plugin'));

  const getDownloadName = useCallback(() => {
    const baseName = (fileName || "download").replace(/\.[^/.]+$/, "");
    const ext = fileFormat ? `.${fileFormat.replace(/^\./, "").toLowerCase()}` : "";
    return `${baseName}${ext}`;
  }, [fileName, fileFormat]);

  const checkStatus = useCallback(() => {
    if (isInsidePlugin && resourceId) {
      window.parent.postMessage({
        type: 'CHECK_RESOURCE_STATUS',
        resourceId: resourceId,
        fileName: getDownloadName()
      }, '*');
    }
  }, [isInsidePlugin, resourceId, getDownloadName]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!isInsidePlugin) return;

    const handleMessage = (event) => {
      // Safety check: ensure event data exists
      if (!event.data) return;
      
      const { type, resourceId: msgResourceId, exists, progress: dlProgress, error } = event.data;
      
      // If resourceId is provided in message, check if it matches current one
      if (msgResourceId && String(msgResourceId) !== String(resourceId)) return;

      switch (type) {
        case 'RESOURCE_STATUS':
          if (exists) {
            setDownloadStatus('cached');
            setProgress(100);
            updateCacheStore(resourceId, 'cached');
          } else {
            setDownloadStatus('idle');
            setProgress(0);
            updateCacheStore(resourceId, 'idle');
          }
          break;

        case 'DOWNLOAD_PROGRESS':
          setDownloadStatus('downloading');
          setProgress(parseFloat(dlProgress) || 0);
          break;

        case 'DOWNLOAD_COMPLETE':
          setDownloadStatus('cached');
          setProgress(100);
          updateCacheStore(resourceId, 'cached');
          break;

        case 'CLEAR_PLUGIN_CACHE':
          if (typeof window !== 'undefined') {
            localStorage.removeItem('premiere_plugin_cache');
            localStorage.removeItem('premiere_plugin_cache_v');
            window.location.reload();
          }
          break;

        case 'DOWNLOAD_ERROR':
          setDownloadStatus('idle');
          setLastError(error);
          break;
      }
    };

    // Use window instead of window.parent for cross-origin safety
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isInsidePlugin, resourceId, checkStatus]);

  const downloadResource = (url) => {
    if (isInsidePlugin) {
      window.parent.postMessage({
        type: 'IMPORT_ASSET',
        url: url,
        fileName: getDownloadName(),
        resourceId: resourceId
      }, '*');
    }
  };

  const importAsset = () => {
    if (isInsidePlugin) {
      window.parent.postMessage({
        type: 'IMPORT_ASSET',
        fileName: getDownloadName(),
        resourceId: resourceId
      }, '*');
    }
  };

  return {
    downloadStatus,
    progress,
    lastError,
    downloadResource,
    importAsset,
    checkStatus,
    isInsidePlugin // Export this so components can use it
  };
}
