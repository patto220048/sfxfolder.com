'use client';

import { useCallback } from 'react';
import { getResources, getFolders, getCategoryBySlug, getCategoryTags } from '@/app/lib/api';

const CACHE_KEY = 'plugin_data_v1';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const MAX_CATEGORIES = 5;

export function usePluginDataCache() {
  const getFullCache = useCallback(() => {
    if (typeof window === 'undefined') return {};
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.error('Failed to parse plugin cache', e);
      return {};
    }
  }, []);

  const saveFullCache = useCallback((cache) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.error('Failed to save plugin cache', e);
      // If quota exceeded, clear and try again (basic strategy)
      if (e.name === 'QuotaExceededError') {
        localStorage.removeItem(CACHE_KEY);
      }
    }
  }, []);

  const getCachedData = useCallback((categorySlug) => {
    const cache = getFullCache();
    const data = cache[categorySlug];
    
    if (!data) return null;
    
    // Check if expired
    const now = Date.now();
    if (now - data.timestamp > CACHE_TTL) {
      return null;
    }
    
    return data;
  }, [getFullCache]);

  const setCachedData = useCallback((categorySlug, data) => {
    const cache = getFullCache();
    
    // Add timestamp
    cache[categorySlug] = {
      ...data,
      timestamp: Date.now()
    };
    
    // Manage cache size: remove oldest if exceeds MAX_CATEGORIES
    const slugs = Object.keys(cache);
    if (slugs.length > MAX_CATEGORIES) {
      const sortedSlugs = slugs.sort((a, b) => cache[a].timestamp - cache[b].timestamp);
      const oldestSlug = sortedSlugs[0];
      delete cache[oldestSlug];
    }
    
    saveFullCache(cache);
  }, [getFullCache, saveFullCache]);

  const isCacheStale = useCallback((categorySlug) => {
    const cache = getFullCache();
    const data = cache[categorySlug];
    if (!data) return true;
    
    const now = Date.now();
    return (now - data.timestamp > CACHE_TTL);
  }, [getFullCache]);

  const prefetchCategory = useCallback(async (categorySlug) => {
    if (typeof window === 'undefined') return;
    
    // Skip if we already have valid cache
    if (!isCacheStale(categorySlug)) return;

    try {
      // Basic prefetch using standardized API functions
      const [resources, folders, categoryInfo, tags] = await Promise.all([
        getResources({ categorySlug, limit: 50 }),
        getFolders(categorySlug),
        getCategoryBySlug(categorySlug),
        getCategoryTags(categorySlug)
      ]);

      if (resources && folders && categoryInfo) {
        setCachedData(categorySlug, {
          resources,
          folders,
          categoryInfo,
          tags,
        });
        
        console.log(`[Prefetch] Success for ${categorySlug}`);
      }
    } catch (e) {
      console.warn(`[Prefetch] Failed for ${categorySlug}`, e);
    }
  }, [isCacheStale, setCachedData]);

  return {
    getCachedData,
    setCachedData,
    isCacheStale,
    prefetchCategory
  };
}
