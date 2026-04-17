"use client";

import React, { createContext, useContext, useMemo } from 'react';

const SiteDataContext = createContext(null);

/**
 * Provider to supply site-wide data (settings, categories) to client components.
 * This data is typically fetched on the server (Root Layout) and passed here.
 */
export function SiteProvider({ children, initialSettings, initialCategories }) {
  const value = useMemo(() => ({
    settings: initialSettings || {
      site_name: 'EditerLor',
      tagline: 'Free Resources for Video Editors',
      project_version: 'v0.1'
    },
    categories: initialCategories || []
  }), [initialSettings, initialCategories]);

  return (
    <SiteDataContext.Provider value={value}>
      {children}
    </SiteDataContext.Provider>
  );
}

/**
 * Hook to access site settings and categories
 */
export function useSiteData() {
  const context = useContext(SiteDataContext);
  if (!context) {
    throw new Error('useSiteData must be used within a SiteProvider');
  }
  return context;
}
