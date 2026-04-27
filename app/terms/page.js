'use client';

import React from 'react';
import styles from './terms.module.css';

export default function TermsOfService() {
  return (
    <div className={styles.container}>
      <div className={styles.heroGlow} />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.lastUpdated}>Last Updated: April 28, 2026</p>
        </div>

        <div className={styles.grid}>
          <section className={styles.section}>
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using SFXFolder.com (the &quot;Service&quot;), you acknowledge that this is a personal resource collection curated by the owner based on professional experience. By using the Service, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service. These terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. License and Use of Resources</h2>
            <p>
              All resources provided on SFXFolder.com (overlays, sound effects, transitions, templates, etc.) are curated from my personal library and professional tools. Unless otherwise stated:
            </p>
            <ul>
              <li>You may use these resources in both personal and commercial video projects.</li>
              <li>You may not resell, redistribute, or sub-license the resources as standalone files.</li>
              <li>You may not use the resources in a way that allows others to download them as standalone files.</li>
              <li>Attribution is appreciated but not required unless specified in the specific resource details.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Copyright & Commercial Liability</h2>
            <p>
              While I strive to provide high-quality assets that I personally use, <strong>SFXFolder.com does not warrant or guarantee that all resources are free from third-party copyright claims</strong>. 
            </p>
            <p>
              By using these resources in commercial projects, you acknowledge and agree that:
            </p>
            <ul>
              <li>You are solely responsible for verifying the suitability and legal status of any asset for your specific use case.</li>
              <li>SFXFolder.com, its owners, and contributors shall NOT be held liable for any legal disputes, copyright strikes, takedown notices, or financial damages arising from the use of these resources.</li>
              <li>I provide all assets &quot;as is&quot; without any warranty of any kind, express or implied.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Payments and Subscriptions</h2>
            <p>
              Some parts of the Service are billed on a subscription basis (&quot;Subscription(s)&quot;). You will be billed in advance on a recurring and periodic basis (&quot;Billing Cycle&quot;).
            </p>
            <ul>
              <li>At the end of each Billing Cycle, your Subscription will automatically renew under the exact same conditions unless you cancel it or SFXFolder.com cancels it.</li>
              <li>A valid payment method, including PayPal or Credit Card, is required to process the payment for your Subscription.</li>
              <li>Should automatic billing fail to occur for any reason, your access to premium features will be suspended immediately.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>5. Refund Policy</h2>
            <p>
              Due to the digital nature of our products, <strong>all sales are final</strong>. Once a subscription is active or a digital asset is downloaded, we cannot offer refunds. 
            </p>
            <p>
              You may cancel your subscription at any time to avoid future charges, but you will not receive a refund for the current billing period.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. User Accounts</h2>
            <p>
              When you create an account, you must provide information that is accurate, complete, and current. You are responsible for safeguarding the password that you use to access the Service and for any activities or actions under your password.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Intellectual Property</h2>
            <p>
              The Service and its original content (excluding user-provided assets), features, and functionality are and will remain the exclusive property of SFXFolder.com and its licensors. Our trademarks may not be used without our prior written consent.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Prohibited Uses</h2>
            <p>
              You agree not to use the Service for any unlawful purpose, to infringe upon our intellectual property rights, or to upload malicious code that could affect the Service&apos;s functionality.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>10. Disclaimer & Limitation of Liability</h2>
            <p>
              In no event shall SFXFolder.com be liable for any indirect, incidental, special, or consequential damages resulting from your use or inability to use the Service. The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis.
            </p>
          </section>

          <section className={styles.section}>
            <h2>11. Governing Law</h2>
            <p>
              These Terms shall be governed and construed in accordance with the laws of the jurisdiction in which the Service operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section className={styles.section}>
            <h2>12. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at <strong>support@sfxfolder.com</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
