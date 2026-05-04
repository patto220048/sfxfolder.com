'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Loader2, Check, X } from "lucide-react";
import styles from './contact.module.css';
import { toast } from 'react-hot-toast';
import Script from 'next/script';

export default function ContactPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const turnstileRef = useRef(null);

  useEffect(() => {
    let widgetId = null;

    const renderWidget = () => {
      if (window.turnstile && turnstileRef.current && !widgetId) {
        console.log('Attempting to render Turnstile...');
        try {
          widgetId = window.turnstile.render(turnstileRef.current, {
            sitekey: '0x4AAAAAADE0L-TzAgbapf_f',
            callback: (token) => {
              console.log('Turnstile: Verification successful');
              setTurnstileToken(token);
            },
            'error-callback': (err) => {
              console.error('Turnstile: Error', err);
            },
            'expired-callback': () => {
              console.log('Turnstile: Token expired');
              setTurnstileToken(null);
            },
            theme: 'dark',
          });
        } catch (err) {
          console.error('Turnstile: Render error', err);
        }
      }
    };

    const checkInterval = setInterval(() => {
      if (window.turnstile) {
        renderWidget();
        clearInterval(checkInterval);
      }
    }, 100);
    
    return () => {
      clearInterval(checkInterval);
      if (window.turnstile && widgetId) {
        window.turnstile.remove(widgetId);
      }
    };
  }, []);

  // Function called when turnstile expires or errors
  const resetTurnstile = () => {
    if (window.turnstile && turnstileRef.current) {
      window.turnstile.reset(turnstileRef.current);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Form submission triggered');
    
    if (!turnstileToken) {
      console.log('Submission blocked: No Turnstile token');
      toast.error('Please complete the security check.');
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData(e.target);
    const payload = {
      name: formData.get('name'),
      email: formData.get('email'),
      message: formData.get('message'),
      _honeypot: formData.get('_honeypot'),
      turnstileToken: turnstileToken, // Send token to server
    };

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setShowSuccess(true);
        e.target.reset();
        resetTurnstile();
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Submit error:', error);
      toast.error(error.message || 'Something went wrong. Please try again.');
      resetTurnstile();
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <div className={styles.container}>
      <div className={styles.heroGlow} />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Contact Us</h1>
          <p className={styles.subtitle}>Get in touch with the SFXFolder team</p>
        </div>

        <div className={styles.mainContent}>
          <section className={styles.section}>
            <div className={styles.sectionHeaderCentered}>
              <h2>
                <MessageSquare size={18} />
                Inquiry
              </h2>
            </div>
            <p className={styles.centeredText}>
              Have a question about our resources, or need help with a subscription? 
              Fill out the form and we&apos;ll get back to you as soon as possible.
            </p>
            <form className={styles.form} onSubmit={handleSubmit}>
              <Script 
                src="https://challenges.cloudflare.com/turnstile/v0/api.js" 
                strategy="afterInteractive"
              />
              
              {/* Honeypot field - hidden from users */}
              <input 
                type="text" 
                name="_honeypot" 
                style={{ display: 'none' }} 
                tabIndex="-1" 
                autoComplete="off" 
              />
              <div className={styles.formGroup}>
                <label htmlFor="name">Name</label>
                <input type="text" id="name" name="name" className={styles.input} required placeholder="Your name" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input type="email" id="email" name="email" className={styles.input} required placeholder="your@email.com" />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="message">Message</label>
                <textarea id="message" name="message" className={styles.textarea} required placeholder="How can we help?"></textarea>
              </div>

              {/* Turnstile Widget */}
              <div className={styles.captchaContainer}>
                <div ref={turnstileRef} />
              </div>

              <button 
                type="submit" 
                className={styles.submitBtn} 
                disabled={isSubmitting || !turnstileToken}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className={styles.spin} />
                    Sending...
                  </>
                ) : (
                  'Send Message'
                )}
              </button>
            </form>
          </section>
        </div>
      </div>
      {/* Success Modal */}
      {showSuccess && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <button className={styles.closeModal} onClick={() => setShowSuccess(false)}>
              <X size={20} />
            </button>
            <div className={styles.modalIcon}>
              <Check size={40} />
            </div>
            <h3>Message Sent!</h3>
            <p>Thank you for reaching out. Our team will get back to you within 24-48 hours.</p>
            <button className={styles.modalBtn} onClick={() => setShowSuccess(false)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
