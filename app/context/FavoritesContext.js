"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useAuth } from "@/app/lib/auth-context";
import { supabase } from "@/app/lib/supabase";
import { useToast } from "@/app/context/ToastContext";

const FavoritesContext = createContext({
  favorites: new Set(),
  loading: false,
  isFavorited: () => false,
  toggleFavorite: () => Promise.resolve(),
  refreshFavorites: () => Promise.resolve(),
});

export function FavoritesProvider({ children }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [favorites, setFavorites] = useState(new Set());
  const [loading, setLoading] = useState(false);

  const fetchFavorites = useCallback(async () => {
    if (!user?.id) {
      setFavorites(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("resource_id")
        .eq("user_id", user.id);
      
      if (error) throw error;
      
      setFavorites(new Set((data || []).map((item) => item.resource_id)));
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

  const toggleFavorite = useCallback(async (resourceId) => {
    if (!user?.id) {
      // Trigger AuthModal from anywhere
      window.dispatchEvent(new CustomEvent("need-auth"));
      return;
    }

    const isFav = favorites.has(resourceId);

    // Optimistic UI update
    setFavorites((prev) => {
      const next = new Set(prev);
      if (isFav) {
        next.delete(resourceId);
      } else {
        next.add(resourceId);
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
      setFavorites((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.add(resourceId);
        } else {
          next.delete(resourceId);
        }
        return next;
      });
    }
  }, [user?.id, favorites, showToast]);

  const isFavorited = useCallback((resourceId) => {
    return favorites.has(resourceId);
  }, [favorites]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
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
