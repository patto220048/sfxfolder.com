"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { getTags } from "@/app/lib/api";
import styles from "./TagInput.module.css";

export default function TagInput({ tags = [], onChange, placeholder = "Thêm tags...", disabled = false }) {
  const [inputValue, setInputValue] = useState("");
  const [allSuggestions, setAllSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const fetched = await getTags();
        setAllSuggestions(fetched || []);
      } catch (e) {
        console.error("Failed to fetch tags for autocomplete:", e);
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = allSuggestions.filter(tag => 
        tag.name.toLowerCase().includes(inputValue.toLowerCase()) &&
        !tags.includes(tag.name)
      );
      setFilteredSuggestions(filtered);
      setShowSuggestions(true);
      setSelectedIndex(-1);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
    }
  }, [inputValue, allSuggestions, tags]);

  const addTag = (tagName) => {
    if (disabled) return;
    const trimmed = tagName.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const removeTag = (indexToRemove) => {
    if (disabled) return;
    onChange(tags.filter((_, index) => index !== indexToRemove));
  };

  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredSuggestions.length) {
        addTag(filteredSuggestions[selectedIndex].name);
      } else {
        addTag(inputValue);
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) && !inputRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.inputWrapper}>
        <div className={styles.tagsContext}>
          {tags.map((tag, index) => (
            <span key={`${tag}-${index}`} className={styles.tagBadge}>
              {tag}
              {!disabled && (
                <button 
                  type="button"
                  onClick={() => removeTag(index)} 
                  className={styles.removeBtn}
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder={tags.length === 0 ? placeholder : ""}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => !disabled && inputValue.trim() && setShowSuggestions(true)}
            disabled={disabled}
          />
        </div>

        {showSuggestions && filteredSuggestions.length > 0 && (
          <div ref={suggestionsRef} className={styles.suggestions}>
            {filteredSuggestions.map((tag, index) => (
              <div
                key={tag.id}
                className={`${styles.suggestionItem} ${index === selectedIndex ? styles.selected : ""}`}
                onClick={() => addTag(tag.name)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={styles.tagName}>{tag.name}</span>
                <span className={styles.tagCount}>{tag.usageCount} resources</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
