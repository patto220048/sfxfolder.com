"use client";

import { useState } from "react";
import { X } from "lucide-react";
import styles from "./TagInput.module.css";

export default function TagInput({ tags = [], onChange, placeholder = "Nhập tag và nhấn Enter...", disabled = false }) {
  const [inputValue, setInputValue] = useState("");

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !tags.includes(val)) {
        const newTags = [...tags, val];
        onChange(newTags);
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag if backspace pressed on empty input
      const newTags = tags.slice(0, -1);
      onChange(newTags);
    }
  };

  const removeTag = (indexToRemove) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove);
    onChange(newTags);
  };

  return (
    <div className={`${styles.container} ${disabled ? styles.disabled : ""}`}>
      <div className={styles.tagList}>
        {tags.map((tag, index) => (
          <div key={`${tag}-${index}`} className={styles.tag}>
            <span>{tag}</span>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeTag(index)}
                className={styles.removeBtn}
              >
                <X size={12} />
              </button>
            )}
          </div>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          disabled={disabled}
          className={styles.input}
        />
      </div>
    </div>
  );
}
