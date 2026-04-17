'use client';

import React from 'react';
import styles from './privacy.module.css';

export default function PrivacyPolicy() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.lastUpdated}>Last Updated: April 16, 2026</p>

          <section className={styles.section}>
            <h2>1. Information We Collect</h2>
            <p>
              We collect information to provide better services to all our users. The types of information we collect include:
            </p>
            <ul>
              <li><strong>Personal Information:</strong> When you register for an account, we collect your email address and username.</li>
              <li><strong>Usage Information:</strong> We collect data about how you interact with our service, such as resources downloaded and pages visited.</li>
              <li><strong>Log Data:</strong> Like many website operators, we collect information that your browser sends whenever you visit our website.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>2. How We Use Information</h2>
            <p>
              We use the information we collect for various purposes, including:
            </p>
            <ul>
              <li>To provide, maintain, and improve our services.</li>
              <li>To manage your account and provide you with customer support.</li>
              <li>To send you technical notices, updates, security alerts, and support messages.</li>
              <li>To monitor and analyze trends, usage, and activities in connection with our Service.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>3. Information Sharing and Disclosure</h2>
            <p>
              We do not share your personal information with companies, organizations, or individuals outside of EditerLor except in the following cases:
            </p>
            <ul>
              <li><strong>With your consent:</strong> We will share personal information with companies, organizations or individuals outside of EditerLor when we have your consent to do so.</li>
              <li><strong>For legal reasons:</strong> We will share personal information if we have a good-faith belief that access, use, preservation or disclosure of the information is reasonably necessary to meet any applicable law, regulation, legal process or enforceable governmental request.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2>4. Data Security</h2>
            <p>
              The security of your data is important to us, but remember that no method of transmission over the Internet, or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Information, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className={styles.section}>
            <h2>5. Cookies</h2>
            <p>
              Cookies are files with small amount of data, which may include an anonymous unique identifier. Cookies are sent to your browser from a web site and stored on your computer's hard drive. We use "cookies" to collect information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
            </p>
          </section>

          <section className={styles.section}>
            <h2>6. Third-Party Services</h2>
            <p>
              Our Service may contain links to other sites that are not operated by us. If you click on a third-party link, you will be directed to that third party's site. We strongly advise you to review the Privacy Policy of every site you visit. We have no control over and assume no responsibility for the content, privacy policies or practices of any third-party sites or services.
            </p>
          </section>

          <section className={styles.section}>
            <h2>7. Children's Privacy</h2>
            <p>
              Our Service does not address anyone under the age of 13. We do not knowingly collect personally identifiable information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with Personal Information, please contact us.
            </p>
          </section>

          <section className={styles.section}>
            <h2>8. Changes to This Privacy Policy</h2>
            <p>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section className={styles.section}>
            <h2>9. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at support@editerlor.com.
            </p>
          </section>
      </div>
    </div>
  );
}
