"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/app/context/ToastContext";

const FavoritesContext = createContext({
  favorites: new Set(),
  categoryFavoriteCounts: {},
  loading: false,
  isFavorited: () => false,
  toggleFavorite: () => Promise.resolve(),
  refreshFavorites: () => Promise.resolve(),
});

export function FavoritesProvider({ children }) {
  const { user, session } = useAuth();
  const { showToast } = useToast();
  const [favoritesMap, setFavoritesMap] = useState(new Map());
  const [loading, setLoading] = useState(false);

  const favorites = useMemo(() => new Set(favoritesMap.keys()), [favoritesMap]);

  const categoryFavoriteCounts = useMemo(() => {
    const counts = {};
    for (const catId of favoritesMap.values()) {
      if (catId) {
        counts[catId] = (counts[catId] || 0) + 1;
      }
    }
    return counts;
  }, [favoritesMap]);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavoritesMap(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const headers = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const res = await fetch(`/api/favorites`, { headers });
      if (!res.ok) throw new Error("Failed to fetch favorites");
      const data = await res.json();
      
      const newMap = new Map();
      (data || []).forEach((item) => {
        const catId = item.resources?.category_id || null;
        newMap.set(item.resource_id, catId);
      });
      setFavoritesMap(newMap);
    } catch (e) {
      console.error("Error fetching favorites:", e);
      showToast("Could not load favorites list.", "error");
    } finally {
      setLoading(false);
    }
  }, [user?.id, session?.access_token, showToast]);

  // Sync favorites when user logs in or out
  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const toggleFavorite = useCallback(async (resourceId, categoryId = null) => {
    if (!user?.id) {
      // Trigger AuthModal from anywhere
      window.dispatchEvent(new CustomEvent("need-auth"));
      return;
    }

    const isFav = favoritesMap.has(resourceId);
    const existingCategoryId = favoritesMap.get(resourceId);

    // Optimistic UI update
    setFavoritesMap((prev) => {
      const next = new Map(prev);
      if (isFav) {
        next.delete(resourceId);
      } else {
        next.set(resourceId, categoryId);
      }
      return next;
    });

    try {
      const headers = {
        "Content-Type": "application/json"
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const method = isFav ? "DELETE" : "POST";
      const res = await fetch(`/api/favorites`, {
        method,
        headers,
        body: JSON.stringify({ resourceId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update favorites");
      }

      showToast(isFav ? "Removed from favorites." : "Added to favorites.", isFav ? "info" : "success");
    } catch (e) {
      console.error("Error toggling favorite:", e);
      showToast("Failed to update favorites.", "error");
      
      // Revert optimistic update on failure
      setFavoritesMap((prev) => {
        const next = new Map(prev);
        if (isFav) {
          next.set(resourceId, existingCategoryId);
        } else {
          next.delete(resourceId);
        }
        return next;
      });
    }
  }, [user?.id, session?.access_token, favoritesMap, showToast]);

  const isFavorited = useCallback((resourceId) => {
    return favoritesMap.has(resourceId);
  }, [favoritesMap]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        categoryFavoriteCounts,
        loading,
        isFavorited,
        toggleFavorite,
        refreshFavorites: fetchFavorites,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  return useContext(FavoritesContext);
}
