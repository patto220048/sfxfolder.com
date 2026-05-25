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
  const { user } = useAuth();
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
      const { data, error } = await supabase
        .from("favorites")
        .select(`
          resource_id,
          resources (
            category_id
          )
        `)
        .eq("user_id", user.id);
      
      if (error) throw error;
      
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
  }, [user?.id, showToast]);

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
      if (isFav) {
        // Delete from database
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("resource_id", resourceId);

        if (error) throw error;
        showToast("Removed from favorites.", "info");
      } else {
        // Insert into database
        const { error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            resource_id: resourceId,
          });

        if (error) throw error;
        showToast("Added to favorites.", "success");
      }
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
  }, [user?.id, favoritesMap, showToast]);

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
