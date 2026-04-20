"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { updatePaypalConfig } from "./actions";
import styles from "./page.module.css";
import { Save, AlertCircle } from "lucide-react";

export default function PaypalSettingsClient({ initialConfig }) {
  const [config, setConfig] = useState(initialConfig);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    const toastId = toast.loading("Saving configuration...");
    
    // Ensure all numeric fields are properly parsed and not NaN
    const sanitizedConfig = {
      ...config,
      sandbox: {
        ...config.sandbox,
        monthly_price: parseFloat(config.sandbox.monthly_price) || 0,
        yearly_price: parseFloat(config.sandbox.yearly_price) || 0
      },
      live: {
        ...config.live,
        monthly_price: parseFloat(config.live.monthly_price) || 0,
        yearly_price: parseFloat(config.live.yearly_price) || 0
      }
    };
    
    const result = await updatePaypalConfig(sanitizedConfig);
    
    if (result.success) {
      toast.success("Settings saved successfully!", { id: toastId });
    } else {
      toast.error(result.error, { id: toastId });
    }
    setIsSaving(false);
  };

  const handleNestedChange = (env, field, value) => {
    // If it's a numeric field, handle empty string vs number
    let processedValue = value;
    if (field.includes('price')) {
      processedValue = value === "" ? "" : parseFloat(value);
    }

    setConfig(prev => ({
      ...prev,
      [env]: {
        ...prev[env],
        [field]: processedValue
      }
    }));
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>PayPal Configuration</h1>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className={styles.saveBtn}
        >
          <Save size={18} /> {isSaving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <div className={styles.alertBox}>
        <AlertCircle size={24} className={styles.alertIcon} />
        <div className={styles.alertContent}>
          <strong>Warning:</strong> Ensure your Secret Keys are safely stored in `.env.local` as `PAYPAL_SECRET_SANDBOX` and `PAYPAL_SECRET_LIVE`.
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Active Environment</h2>
        
        <div className={styles.toggleGroup}>
          <label className={`${styles.toggleLabel} ${config.env === "sandbox" ? styles.active : ""}`}>
            <input 
              type="radio" 
              name="env" 
              value="sandbox"
              checked={config.env === "sandbox"}
              onChange={() => setConfig({...config, env: "sandbox"})}
              className={styles.srOnly}
            />
            Sandbox Mode
          </label>

          <label className={`${styles.toggleLabel} ${config.env === "live" ? styles.active : ""}`}>
            <input 
              type="radio" 
              name="env" 
              value="live"
              checked={config.env === "live"}
              onChange={() => setConfig({...config, env: "live"})}
              className={styles.srOnly}
            />
            Live Mode
          </label>
        </div>
      </div>

      <div className={styles.grid}>
        {/* Sandbox Config */}
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Sandbox Settings</h2>
          
          <div className={styles.formGroup}>
            <label>Client ID</label>
            <input 
              type="text" 
              value={config.sandbox.client_id}
              onChange={(e) => handleNestedChange("sandbox", "client_id", e.target.value)}
              placeholder="sb-xxxx"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Monthly Price ($)</label>
            <input 
              type="number" 
              value={config.sandbox.monthly_price}
              onChange={(e) => handleNestedChange("sandbox", "monthly_price", e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Monthly Plan ID</label>
            <input 
              type="text" 
              value={config.sandbox.monthly_plan_id}
              onChange={(e) => handleNestedChange("sandbox", "monthly_plan_id", e.target.value)}
              placeholder="P-xxxx"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Yearly Price ($)</label>
            <input 
              type="number" 
              value={config.sandbox.yearly_price}
              onChange={(e) => handleNestedChange("sandbox", "yearly_price", e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Yearly Plan ID</label>
            <input 
              type="text" 
              value={config.sandbox.yearly_plan_id}
              onChange={(e) => handleNestedChange("sandbox", "yearly_plan_id", e.target.value)}
              placeholder="P-xxxx"
              className={styles.input}
            />
          </div>
        </div>

        {/* Live Config */}
        <div className={styles.card}>
          <h2 className={styles.sectionTitle}>Live Settings</h2>
          
          <div className={styles.formGroup}>
            <label>Client ID</label>
            <input 
              type="text" 
              value={config.live.client_id}
              onChange={(e) => handleNestedChange("live", "client_id", e.target.value)}
              placeholder="live-xxxx"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Monthly Price ($)</label>
            <input 
              type="number" 
              value={config.live.monthly_price}
              onChange={(e) => handleNestedChange("live", "monthly_price", e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Monthly Plan ID</label>
            <input 
              type="text" 
              value={config.live.monthly_plan_id}
              onChange={(e) => handleNestedChange("live", "monthly_plan_id", e.target.value)}
              placeholder="P-xxxx"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Yearly Price ($)</label>
            <input 
              type="number" 
              value={config.live.yearly_price}
              onChange={(e) => handleNestedChange("live", "yearly_price", e.target.value)}
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Yearly Plan ID</label>
            <input 
              type="text" 
              value={config.live.yearly_plan_id}
              onChange={(e) => handleNestedChange("live", "yearly_plan_id", e.target.value)}
              placeholder="P-xxxx"
              className={styles.input}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
