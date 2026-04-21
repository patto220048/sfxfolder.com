"use client";

import { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";
import { useRouter } from "next/navigation";
import { Check, Crown, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import styles from "./page.module.css";
import { useAuth } from "@/app/lib/auth-context";
import SuccessModal from "@/app/components/ui/SuccessModal";
import UpgradeModal from "@/app/components/ui/UpgradeModal";

export default function PricingClient({ config }) {
  const router = useRouter();
  const { user, profile, isPremium } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const isSandbox = config.env === "sandbox";
  const activeParams = isSandbox ? config.sandbox : config.live;
  
  // Plan detection
  const isMonthlyActive = profile?.subscription_plan === activeParams.monthly_plan_id && profile?.subscription_status === "active";
  const isYearlyActive = profile?.subscription_plan === activeParams.yearly_plan_id && profile?.subscription_status === "active";

  const initialOptions = {
    "client-id": activeParams.client_id,
    currency: "USD",
    intent: "subscription",
    vault: true,
  };

  const handleApprove = async (data, actions) => {
    setIsProcessing(true);
    const toastId = toast.loading("Verifying your subscription...");
    
    try {
      const res = await fetch("/api/paypal/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          subscriptionID: data.subscriptionID,
          paypalEnv: config.env 
        }),
      });

      const result = await res.json();
      
      if (res.ok) {
        // If it was an upgrade, cancel the old subscription
        if (isUpgrading && profile?.subscription_id) {
          try {
            await fetch("/api/paypal/cancel", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscriptionID: profile.subscription_id })
            });
            console.log("Old subscription canceled successfully");
          } catch (cancelErr) {
            console.error("Failed to cancel old subscription automatically:", cancelErr);
          }
        }

        toast.success("Welcome to Premium!", { id: toastId });
        setShowSuccessModal(true);
        setShowUpgradeModal(false);
        setIsUpgrading(false);
      } else {
        throw new Error(result.error || "Verification failed");
      }
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLoginRequest = () => {
    window.dispatchEvent(new CustomEvent("need-auth"));
  };

  const openUpgrade = () => {
    setIsUpgrading(true);
    setShowUpgradeModal(true);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Crown size={48} style={{ marginBottom: "1rem" }} />
        <h1 className={styles.title}>Unlock Premium</h1>
        <p className={styles.subtitle}>
          Get unlimited access to all exclusive resources. Cancel anytime.
        </p>
      </header>

      {isPremium && (
        <div className={styles.statusBadge}>
          <div className={styles.statusInfo}>
            <Crown size={20} />
            <span>You are currently a Premium member. Thank you for your support!</span>
          </div>
          <a 
            href="/account/subscription" 
            className={styles.statusLink}
            style={{ backgroundColor: '#facb11', color: '#000', fontWeight: '900' }}
          >
            Manage Subscription <ExternalLink size={14} />
          </a>
        </div>
      )}

      <PayPalScriptProvider options={initialOptions}>
        <div className={styles.grid}>
          
          {/* Monthly Plan */}
          <div className={`${styles.card} ${isMonthlyActive ? styles.activeCard : ""}`}>
            <div className={styles.cardTitle}>Monthly Plan</div>
            {isMonthlyActive && (
              <div 
                className={styles.currentPlanBadge}
                style={{ backgroundColor: '#000', color: '#fff' }}
              >
                Current Plan
              </div>
            )}
            <div className={styles.price}>
              ${activeParams.monthly_price} <span className={styles.period}>/ mo</span>
            </div>
            <p className={styles.description}>Perfect for short-term projects and testing the waters.</p>
            
            <ul className={styles.features}>
              <li><Check size={20} className={styles.checkIcon}/> Unlimited Downloads</li>
              <li><Check size={20} className={styles.checkIcon}/> Premium Resources</li>
              <li><Check size={20} className={styles.checkIcon}/> Direct Support</li>
              <li><Check size={20} className={styles.checkIcon}/> Cancel Anytime</li>
            </ul>

            <div className={styles.paypalWrapper}>
              {!user ? (
                <button onClick={handleLoginRequest} style={{width: '100%', padding: '12px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontFamily: 'inherit'}}>Log in to Subscribe</button>
              ) : isYearlyActive ? (
                <div className={styles.alreadyClaimed}>Enjoy your Yearly coverage</div>
              ) : isMonthlyActive ? (
                <div className={styles.activePlanContainer}>
                  <div className={styles.activeText}>Active via Monthly Billing</div>
                  <a 
                    href="/account/subscription" 
                    className={styles.manageLink}
                    style={{ borderColor: '#facb11', color: '#facb11', borderStyle: 'solid', borderWidth: '1px' }}
                  >
                    Manage Subscription
                  </a>
                </div>
              ) : (
                <PayPalButtons
                  style={{ layout: "horizontal", color: "black", label: "subscribe" }}
                  createSubscription={(data, actions) => {
                    return actions.subscription.create({
                      plan_id: activeParams.monthly_plan_id,
                    });
                  }}
                  onApprove={handleApprove}
                  disabled={isProcessing || !activeParams.monthly_plan_id}
                />
              )}
            </div>
          </div>

          {/* Yearly Plan */}
          <div className={`${styles.card} ${isYearlyActive ? styles.activeCard : ""}`}>
            <div className={styles.popularBadge}>Best Value</div>
            <div className={styles.cardTitle}>Yearly Plan</div>
            {isYearlyActive && (
              <div 
                className={styles.currentPlanBadge}
                style={{ backgroundColor: '#000', color: '#fff' }}
              >
                Current Plan
              </div>
            )}
            <div className={styles.price}>
              ${activeParams.yearly_price} <span className={styles.period}>/ yr</span>
            </div>
            <p className={styles.description}>Save 25% with our annual billing. Best for dedicated creators.</p>
            
            <ul className={styles.features}>
              <li><Check size={20} className={styles.checkIcon}/> Unlimited Downloads</li>
              <li><Check size={20} className={styles.checkIcon}/> Premium Resources</li>
              <li><Check size={20} className={styles.checkIcon}/> Direct Support</li>
              <li><Check size={20} className={styles.checkIcon}/> Save 25% Annually</li>
            </ul>

            <div className={styles.paypalWrapper}>
              {!user ? (
                <button onClick={handleLoginRequest} style={{width: '100%', padding: '12px', background: 'var(--text-primary)', color: 'var(--bg-primary)', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontFamily: 'inherit'}}>Log in to Subscribe</button>
              ) : isYearlyActive ? (
                <div className={styles.activePlanContainer}>
                  <div className={styles.activeText}>Active via Yearly Billing</div>
                  <a 
                    href="/account/subscription" 
                    className={styles.manageLink}
                    style={{ borderColor: '#facb11', color: '#facb11', borderStyle: 'solid', borderWidth: '1px' }}
                  >
                    Manage Subscription
                  </a>
                </div>
              ) : isMonthlyActive ? (
                <button onClick={openUpgrade} className={styles.upgradeBtn}>Upgrade to Yearly</button>
              ) : (
                <PayPalButtons
                  style={{ layout: "horizontal", color: "black", label: "subscribe" }}
                  createSubscription={(data, actions) => {
                    return actions.subscription.create({
                      plan_id: activeParams.yearly_plan_id,
                    });
                  }}
                  onApprove={handleApprove}
                  disabled={isProcessing || !activeParams.yearly_plan_id}
                />
              )}
            </div>
          </div>

        </div>

        <UpgradeModal 
          isOpen={showUpgradeModal}
          onClose={() => {
            setShowUpgradeModal(false);
            setIsUpgrading(false);
          }}
          currentPlanName="Monthly Plan ($2/mo)"
          expiresAt={profile?.subscription_expires_at}
          paypalOptions={{ planId: activeParams.yearly_plan_id }}
          onApprove={handleApprove}
          isProcessing={isProcessing}
        />

        <SuccessModal 
          isOpen={showSuccessModal} 
          onClose={() => setShowSuccessModal(false)} 
        />
      </PayPalScriptProvider>
    </div>
  );
}

