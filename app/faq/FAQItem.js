"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./page.module.css";

export default function FAQItem({ faq }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${styles.faqItem} ${isOpen ? styles.active : ""}`}>
      <button 
        className={styles.questionBtn} 
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className={styles.question}>
          <span className={styles.qIcon}>Q.</span>
          <h3 className={styles.qText}>{faq.question}</h3>
        </div>
        <ChevronDown 
          size={20} 
          className={`${styles.chevron} ${isOpen ? styles.chevronRotated : ""}`} 
        />
      </button>
      <div className={`${styles.answerWrapper} ${isOpen ? styles.expanded : ""}`}>
        <p className={styles.answer}>{faq.answer}</p>
      </div>
    </div>
  );
}
