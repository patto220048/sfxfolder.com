'use client';

import React from 'react';
import styles from './terms.module.css';

export default function TermsOfService() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
          <h1 className={styles.title}>Terms of Service</h1>
          <p className={styles.lastUpdated}>Last Updated: April 16, 2026</p>

          <section className={styles.section}>
            <h2>1. Agreement to Terms</h2>
            <p>
              By accessing or using EditerLor (the "Service"), you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>2. License and Use of Resources</h2>
            <p>
              All resources provided on EditerLor (overlays, sound effects, transitions, templates, etc.) are provided with a specific license. Unless otherwise stated:
            </p>
            <ul>
              <li>You may use these resources in both personal and commercial video projects.</li>
              <li>You may not resell, redistribute, or sub-license the resources as standalone files.</li>
              <li>Attribution is appreciated but not required unless specified in the specific resource details.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. User Account</h2>
            <p>
              When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account.
            </p>
          </section>

          <section className={styles.section}>
            <h2>4. Intellectual Property</h2>
            <p>
              The Service and its original content (excluding user-provided content), features, and functionality are and will remain the exclusive property of EditerLor and its licensors. Our trademarks and trade dress may not be used in connection with any product or service without our prior written consent.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Termination</h2>
            <p>
              We may terminate or suspend your account immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Limitation of Liability</h2>
            <p>
              In no event shall EditerLor, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the Service.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Prohibited Uses</h2>
            <p>
              You agree not to use the Service:
            </p>
            <ul>
              <li>For any unlawful purpose or to solicit others to perform or participate in any unlawful acts.</li>
              <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances.</li>
              <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others.</li>
              <li>To upload or transmit viruses or any other type of malicious code that will or may be used in any way that will affect the functionality or operation of the Service.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>8. Changes to Terms</h2>
            <p>
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Contact Us</h2>
            <p>
              If you have any questions about these Terms, please contact us at support@editerlor.com.
            </p>
          </section>
      </div>
    </div>
  );
}
