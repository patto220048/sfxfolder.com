"use client";

import React from "react";
import styles from "./InitialLoader.module.css";

const InitialLoader = ({ isReady }) => {
  return (
    <div className={`${styles.loaderWrapper} ${isReady ? styles.fadeReady : ""}`}>
      <div className={styles.loaderContent}>
        <div className={styles.loader}>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
          <div className={styles.cube}></div>
        </div>
        <p className={styles.loadingText}>Initializing Creative Assets...</p>
      </div>
    </div>
  );
};

export default InitialLoader;
