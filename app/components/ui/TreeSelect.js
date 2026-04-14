"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Folder, FolderOpen, Search, X } from "lucide-react";
import styles from "./TreeSelect.module.css";

/**
 * A custom search-ready tree selection component for hierarchical data.
 * Designed for the "Stark Monochrome" admin theme.
 */
export default function TreeSelect({ 
  options = [], 
  value = "", 
  onChange, 
  placeholder = "Chọn thư mục...",
  disabled = false,
  label = "Gốc / Không có" 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Find the selected option's label
  const selectedOption = useMemo(() => {
    if (!value) return null;
    return options.find(opt => opt.id === value);
  }, [options, value]);

  // Filter options by search term
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => opt.name.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const handleSelect = (id) => {
    onChange(id);
    setIsOpen(false);
    setSearchTerm("");
  };

  const toggleDropdown = () => {
    if (!disabled) setIsOpen(!isOpen);
  };

  return (
    <div className={`${styles.container} ${isOpen ? styles.open : ""} ${disabled ? styles.disabled : ""}`} ref={containerRef}>
      <div className={styles.trigger} onClick={toggleDropdown}>
        <div className={styles.selection}>
          {selectedOption ? (
            <>
              <Folder size={16} className={styles.selectedIcon} />
              <span className={styles.selectedName}>{selectedOption.name}</span>
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <ChevronDown size={16} className={`${styles.chevron} ${isOpen ? styles.chevronRotate : ""}`} />
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Tìm thư mục..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
              className={styles.searchInput}
              onClick={(e) => e.stopPropagation()}
            />
            {searchTerm && (
              <button className={styles.clearSearch} onClick={() => setSearchTerm("")}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.list}>
            {/* Root Option */}
            {!searchTerm && (
              <div 
                className={`${styles.item} ${!value ? styles.active : ""}`}
                onClick={() => handleSelect("")}
              >
                <Folder size={14} className={styles.itemIcon} />
                <span className={styles.itemName}>{label}</span>
              </div>
            )}

            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                // Determine depth for indentation if label contains it, 
                // or use a separate property if available.
                // In our case, opt.label has '——' prefixes currently, 
                // but let's try to parse depth or use the fact that it's hierarchical.
                
                // Assuming opt.label was set with indentation in the parent:
                // `${'—'.repeat(depth)}${folder.name}`
                const dashMatch = opt.label?.match(/^—+/);
                const depth = dashMatch ? dashMatch[0].length : 0;
                
                return (
                  <div 
                    key={opt.id} 
                    className={`${styles.item} ${value === opt.id ? styles.active : ""}`}
                    style={{ paddingLeft: `${16 + depth * 16}px` }}
                    onClick={() => handleSelect(opt.id)}
                  >
                    {depth > 0 ? <FolderOpen size={14} className={styles.itemIcon} /> : <Folder size={14} className={styles.itemIcon} />}
                    <span className={styles.itemName}>{opt.name}</span>
                  </div>
                );
              })
            ) : (
              <div className={styles.noResults}>Không tìm thấy thư mục</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
