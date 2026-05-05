"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/lib/auth-context";

// Global store to persist status between navigation within the same session
const pluginCacheStore = new Map();

// Initial load from localStorage with Versioning
if (typeof window !== 'undefined') {
  const CACHE_KEY = 'premiere_plugin_cache';
  const VER_KEY = 'premiere_plugin_cache_v';
  const CURRENT_VER = 'v3';

  try {
    if (localStorage.getItem(VER_KEY) !== CURRENT_VER) {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(VER_KEY, CURRENT_VER);
    }

    const saved = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    Object.entries(saved).forEach(([id, status]) => pluginCacheStore.set(id, status));
  } catch (e) {}
}

// Helper to update store and localStorage
const updateCacheStore = (id, status) => {
  if (!id) return;
  const sid = String(id);
  pluginCacheStore.set(sid, status);
  if (typeof window !== 'undefined') {
    try {
      const saved = JSON.parse(localStorage.getItem('premiere_plugin_cache') || '{}');
      saved[sid] = status;
      localStorage.setItem('premiere_plugin_cache', JSON.stringify(saved));
    } catch (e) {}
  }
};

/**
 * Hook to manage resource cache status and communication with Premiere Pro Plugin Shell
 */
export function usePluginCache(resourceId, fileName, fileFormat) {
  const { isPlugin } = useAuth();
  
  // Initialize from global store if available
  const initialStatus = pluginCacheStore.get(resourceId) || 'idle';
  const [downloadStatus, setDownloadStatus] = useState(initialStatus); 
  const [progress, setProgress] = useState(initialStatus === 'cached' ? 100 : 0);
  const [lastError, setLastError] = useState(null);

  const isInsidePlugin = isPlugin || (typeof window !== 'undefined' && window.location.search.includes('mode=plugin'));

  // Function to build proper filename (sync with Shell logic)
  const getDownloadName = useCallback(() => {
    const baseName = (fileName || "download").replace(/\.[^/.]+$/, "");
    const ext = fileFormat ? `.${fileFormat.replace(/^\./, "").toLowerCase()}` : "";
    return `${baseName}${ext}`;
  }, [fileName, fileFormat]);

  // Request status check from Shell
  const checkStatus = useCallback(() => {
    if (isInsidePlugin && resourceId) {
      window.parent.postMessage({
        type: 'CHECK_RESOURCE_STATUS',
        resourceId: resourceId,
        fileName: getDownloadName()
      }, '*');
    }
  }, [isInsidePlugin, resourceId, getDownloadName]);

  // Initial check on mount
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!isInsidePlugin) return;

    const handleMessage = (event) => {
      const { type, resourceId: msgResourceId, exists, progress: dlProgress, error } = event.data;
      
      if (String(msgResourceId) !== String(resourceId)) return;

      switch (type) {
        case 'RESOURCE_STATUS':
          const sid = String(resourceId);
          if (exists) {
            setDownloadStatus('cached');
            setProgress(100);
            updateCacheStore(sid, 'cached');
          } else {
            // If Premiere says it doesn't exist, REMOVE it from cache store
            setDownloadStatus('idle');
            setProgress(0);
            if (pluginCacheStore.has(sid)) {
              pluginCacheStore.delete(sid);
              if (typeof window !== 'undefined') {
                try {
                  const saved = JSON.parse(localStorage.getItem('premiere_plugin_cache') || '{}');
                  delete saved[sid];
                  localStorage.setItem('premiere_plugin_cache', JSON.stringify(saved));
                } catch (e) {}
              }
            }
          }
          break;

        case 'DOWNLOAD_PROGRESS':
          setDownloadStatus('downloading');
          setProgress(parseFloat(dlProgress));
          break;

        case 'DOWNLOAD_COMPLETE':
          setDownloadStatus('cached');
          setProgress(100);
          updateCacheStore(resourceId, 'cached');
          break;

        case 'CLEAR_PLUGIN_CACHE':
          console.log("Hook received CLEAR_PLUGIN_CACHE message");
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
          
        case 'IMPORT_COMPLETE':
          // Optional: handle specific UI feedback after import
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isInsidePlugin, resourceId]);

  const requestImport = useCallback((signedUrl) => {
    if (!isInsidePlugin) return;
    
    window.parent.postMessage({
      type: 'IMPORT_ASSET',
      url: signedUrl,
      fileName: getDownloadName(),
      resourceId: resourceId
    }, '*');
  }, [isInsidePlugin, resourceId, getDownloadName]);

  return {
    downloadStatus,
    progress,
    isInsidePlugin,
    lastError,
    requestImport,
    checkStatus
  };
}
