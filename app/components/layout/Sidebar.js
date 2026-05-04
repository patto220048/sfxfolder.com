/* eslint-disable */
"use client";

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { ChevronRight, Menu, X, User, LogIn, PanelLeftClose, PanelLeftOpen, Settings, CreditCard, Info, Globe, LogOut, Loader2 } from "lucide-react";
import { useSidebar } from "@/app/context/SidebarContext";
import { useAuth } from "@/app/lib/auth-context";
import AuthModal from "@/app/components/auth/AuthModal";



import TreeFolder from "@/app/components/ui/TreeFolder";
import styles from "./Sidebar.module.css";

const MIN_WIDTH = 200;
const MAX_WIDTH = 500;
const DEFAULT_WIDTH = 260;

const Sidebar = memo(function Sidebar({
  categorySlug,
  categoryName,
  folders = [],
  selectedFolderId,
  onSelectFolder,
  primaryColor = "#FFFFFF",
  isPluginSidebar = false
}) {

  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { selectedFolderId: contextFolderId } = useSidebar();
  const isPluginMode = isPluginSidebar || searchParams?.get('mode') === 'plugin' || pathname?.startsWith('/plugins/');
  
  // Auto-hide standard sidebar if we are in plugin mode but this is not the designated plugin sidebar
  if (isPluginMode && !isPluginSidebar) {
    return null;
  }
  
  const urlFolderId = searchParams?.get("folder");
  const effectiveFolderId = selectedFolderId || contextFolderId || urlFolderId;


  const [mobileOpen, setMobileOpen] = useState(false);

  const { user, profile, logout, isPremium, isSyncingProfile, markAwaitingPayment } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isDropdownOpen]);

  const openWebUrl = (url) => {
    if (isPluginMode && typeof window !== 'undefined') {
      if (window.__adobe_cep__ && window.cep && window.cep.util) {
        window.cep.util.openURLInDefaultBrowser(url);
      } else if (window.parent) {
        window.parent.postMessage({ type: 'OPEN_URL', url }, '*');
      }
    } else {
      window.open(url, '_blank');
    }
    setIsDropdownOpen(false);
  };

  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const hasManuallyToggled = useRef(false);
  const sidebarRef = useRef(null);

  // Load width from localStorage and sync CSS variable on mount
  useEffect(() => {
    const savedWidth = localStorage.getItem("sidebarWidth");
    let initialWidth = DEFAULT_WIDTH;
    
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        initialWidth = parsed;
        setWidth(parsed);
      }
    }
    
    const saved = localStorage.getItem("sidebarCollapsed");
    if (saved !== null) {
      // On mobile/narrow screens, we might want to default to expanded even if saved as collapsed
      if (window.innerWidth > 768) {
        setIsCollapsed(saved === "true");
      }
    }

    // Set CSS variable immediately to prevent layout shifts in components that depend on it
    document.documentElement.style.setProperty('--sidebar-width', `${initialWidth}px`);
    
    // Enable transitions immediately — CSS variable is already set
    setIsReady(true);
  }, []);

  // Update CSS variable when width changes during resize
  useEffect(() => {
    if (isResizing && typeof document !== 'undefined') {
      document.documentElement.style.setProperty('--sidebar-width', `${width}px`);
    }
  }, [width, isResizing]);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem("sidebarWidth", width.toString());
    
    // If user dragged to expand from collapsed state
    if (width > 80 && isCollapsed) {
      hasManuallyToggled.current = true;
      setIsCollapsed(false);
      localStorage.setItem("sidebarCollapsed", "false");
    }
  }, [width, isCollapsed]);

  const toggleCollapse = useCallback(() => {
    hasManuallyToggled.current = true;
    const nextState = !isCollapsed;
    setIsCollapsed(nextState);
    localStorage.setItem("sidebarCollapsed", nextState.toString());
  }, [isCollapsed]);

  const resize = useCallback(
    (e) => {
      if (isResizing) {
        let newWidth = e.clientX;
        if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
        if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;
        setWidth(newWidth);
      }
    },
    [isResizing]
  );

  useEffect(() => {
    if (isResizing) {
      window.addEventListener("mousemove", resize);
      window.addEventListener("mouseup", stopResizing);
      // Add class to body to prevent text selection and keep cursor style consistent
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    } else {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
      document.body.style.cursor = "default";
      document.body.style.userSelect = "auto";
    }

    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // Auto-collapse logic for narrow panels
  useEffect(() => {
    if (!isReady || hasManuallyToggled.current) return;

    const checkWidth = () => {
      if (hasManuallyToggled.current) return;

      if (isPluginMode) {
        if (window.innerWidth < 380) {
          setIsCollapsed(true);
        }
      } else {
        // Web mode: use Mini-Sidebar for tablets (600px - 1024px)
        if (window.innerWidth < 1024 && window.innerWidth >= 600) {
          setIsCollapsed(true);
        } else if (window.innerWidth >= 1024) {
          setIsCollapsed(false);
        }
      }
    };

    window.addEventListener("resize", checkWidth);
    checkWidth();

    return () => window.removeEventListener("resize", checkWidth);
  }, [isPluginMode, isReady]);

  return (
    <>
      {/* Mobile toggle - Hidden in plugin mode as we use mini-sidebar instead */}
      {!isPluginMode && (
        <button
          className={styles.mobileToggle}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle sidebar"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      )}

      <aside
        ref={sidebarRef}
        className={`${styles.sidebar} ${(!isPluginMode && mobileOpen) ? styles.open : ""} ${
          isResizing ? styles.isResizing : ""
        } ${isReady ? styles.isReady : ""} ${isPluginSidebar ? styles.isPlugin : ""} ${
          (isCollapsed && (!mobileOpen || isPluginMode)) ? styles.isCollapsed : ""
        }`}
        id="category-sidebar"
        data-lenis-prevent
        style={{ 
          "--cat-color": primaryColor,
          width: mobileOpen ? undefined : `${width}px` 
        }}
      >
        {/* Resize Handle */}
        <div className={styles.resizer} onMouseDown={startResizing} />

        <div className={styles.header}>
          <h3 className={styles.title}>{categoryName || "Folders"}</h3>
          <button 
            className={styles.collapseBtn} 
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>

        <div className={styles.content}>
          {/* "All" option */}
          <button
            className={`${styles.allBtn} ${!selectedFolderId ? styles.allActive : ""}`}
            onClick={() => {
              if (onSelectFolder) {
                onSelectFolder(null);
              } else {
                const params = new URLSearchParams(window.location.search);
                params.delete("folder");
                const targetPath = isPluginMode ? "/plugins/premiere" : `/${categorySlug || ""}`;
                router.push(`${targetPath}?${params.toString()}`);
              }
              setMobileOpen(false);
            }}
          >
            <ChevronRight size={14} />
            <span style={{ flex: 1 }}>All Resources</span>
            {(() => {
              const total = folders.reduce((acc, f) => acc + (f.totalResourceCount || 0), 0);
              return total > 0 ? (
                <span className={styles.allCount}>{total}</span>
              ) : null;
            })()}
          </button>

          <TreeFolder
            folders={folders}
            selectedFolderId={effectiveFolderId}
            isCollapsed={isCollapsed}
            onSelect={(folder) => {
              if (onSelectFolder) {
                onSelectFolder(folder);
              } else {
                // Default navigation logic for Sidebar when used in a Layout
                const params = new URLSearchParams(window.location.search);
                if (folder) {
                  params.set("folder", folder.id);
                } else {
                  params.delete("folder");
                }
                const targetPath = isPluginMode ? "/plugins/premiere" : `/${categorySlug || ""}`;
                router.push(`${targetPath}?${params.toString()}`);
              }
              setMobileOpen(false);
            }}
          />
        </div>

        {/* Plugin Auth Section - Only shown in plugin mode */}
        {isPluginMode && (
          <div className={styles.footer} ref={dropdownRef}>
            {console.log("[Sidebar] Rendering footer. User:", user?.id, "Profile:", profile?.full_name)}
            {user ? (
              <div className={styles.profileContainer}>
                <div className={styles.profileBtnWrapper}>
                    <button 
                    className={`${styles.profileBtn} ${styles.disabledBtn}`}
                    onClick={(e) => {
                      if (isCollapsed) {
                        setIsDropdownOpen(!isDropdownOpen);
                      } else {
                        e.preventDefault(); // Disable navigation on click
                      }
                    }}
                    title={isCollapsed ? "Open Settings" : undefined}
                  >
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} className={styles.avatar} alt="Avatar" />
                    ) : (
                      <User size={18} className={styles.loginIcon} />
                    )}
                    <div className={styles.profileInfo} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={styles.profileName}>{profile?.full_name || user.email?.split('@')[0]}</span>
                      {isPremium && (
                        <span className={styles.premiumBadge} title="Premium Member">PRO</span>
                      )}
                      {isSyncingProfile && (
                        <Loader2 size={12} className={styles.syncSpinner} style={{ animation: 'spin 1s linear infinite' }} />
                      )}
                    </div>
                  </button>
                  <button 
                    className={`${styles.settingsBtn} ${isDropdownOpen ? styles.active : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDropdownOpen(!isDropdownOpen);
                    }}
                    title="Settings"
                  >
                    <Settings size={16} />
                  </button>
                </div>
                
                {isDropdownOpen && (
                  <div className={styles.dropdownMenu}>
                    {isPremium ? (
                      <button className={styles.dropdownItem} onClick={() => openWebUrl(`${window.location.origin}/account/subscription`)}>
                        <CreditCard size={14} /> My Subscription
                      </button>
                    ) : (
                      <button className={styles.dropdownItem} onClick={() => {
                        markAwaitingPayment();
                        openWebUrl(`${window.location.origin}/pricing`);
                      }}>
                        <CreditCard size={14} /> Upgrade to Premium
                      </button>
                    )}
                    <button className={styles.dropdownItem} onClick={() => openWebUrl(`${window.location.origin}/about-us`)}>
                      <Info size={14} /> About Us
                    </button>
                    <button className={styles.dropdownItem} onClick={() => openWebUrl(`${window.location.origin}`)}>
                      <Globe size={14} /> Online Web
                    </button>
                    <button className={styles.dropdownItem} onClick={() => {
                      setIsDropdownOpen(false);
                      logout();
                    }}>
                      <LogOut size={14} /> Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button 
                className={styles.profileBtn}
                onClick={() => setIsAuthModalOpen(true)}
              >
                <LogIn size={18} className={styles.loginIcon} />
                <span className={styles.profileName}>Login / Sync</span>
              </button>
            )}
          </div>
        )}

        {isAuthModalOpen && (
          <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        )}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
});

export default Sidebar;
