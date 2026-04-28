"use client";

import Image from "next/image";
import { Headphones, Sparkles, Zap, ChevronDown } from "lucide-react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import styles from "./about-us.module.css";

export default function AboutUsClient({ aboutPageSchema, socialLinks = [], contactEmail, siteName = "SFXFOLDER" }) {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
    offset: ["start start", "end end"],
  });

  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -50]);

  const creatorY = useTransform(scrollYProgress, [0.1, 0.4], [0, 80]);
  const missionImageY = useTransform(scrollYProgress, [0.5, 0.8], [-50, 50]);

  const fadeInUp = {
    initial: { opacity: 0, y: 60 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-150px" },
    transition: { duration: 1.2, ease: [0.22, 1, 0.36, 1] }
  };

  const staggerContainer = {
    initial: {},
    whileInView: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } }
  };

  return (
    <div 
      className={styles.container} 
      ref={targetRef}
      onContextMenu={(e) => e.preventDefault()}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageSchema) }}
      />

      {/* Scroll Progress Bar */}
      <motion.div className={styles.progressBar} style={{ scaleX }} />

      {/* Hero Section with Parallax/Fade */}
      <motion.section 
        className={styles.hero}
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
      >
        <div className={styles.heroGlow} />
        <motion.span 
          className={styles.subtitle}
          initial={{ opacity: 0, letterSpacing: "0.5em" }}
          animate={{ opacity: 1, letterSpacing: "0.2em" }}
          transition={{ duration: 1.5 }}
        >
          Our Mission
        </motion.span>
        <motion.h1 
          className={styles.title}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          Curating the Sound <br /> of Your Vision
        </motion.h1>
        <motion.p 
          className={styles.bioText} 
          style={{ maxWidth: '650px' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1 }}
        >
          SFXFolder was born with a single mission: <strong>simplifying your SFX search</strong>. We provide professional-grade resources that don&apos;t cost a fortune or come with copyright headaches.
        </motion.p>
        
        <motion.div 
          className={styles.scrollIndicator}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
        >
          <ChevronDown size={24} className={styles.bounce} />
        </motion.div>
      </motion.section>

      {/* Bio Section with Scroll Trigger */}
      <motion.section 
        className={styles.profileSection}
        {...fadeInUp}
      >
        <motion.div className={styles.imageWrapper} style={{ y: creatorY }}>
          <Image 
            src="/assets/creator.png" 
            alt="Creator of SFXFolder" 
            fill
            sizes="(max-width: 768px) 100vw, 400px"
            priority
          />
        </motion.div>
        <div className={styles.bioContent}>
          <motion.h2 
            className={styles.bioTitle}
            variants={fadeInUp}
          >
            Meet the Creator
          </motion.h2>
          <motion.p 
            className={styles.bioText}
            variants={fadeInUp}
          >
            Hi, I&apos;m a professional video editor with over a decade of experience in the industry. 
            Throughout my career, I&apos;ve spent countless hours scouring the web for the perfect sound effect or the right LUT to make a scene pop.
          </motion.p>
          <motion.p 
            className={styles.bioText}
            variants={fadeInUp}
          >
            I realized that while there are thousands of &quot;free&quot; resources out there, very few meet the standards of a professional workflow. 
            SFXFolder is my personal collection — hand-picked, edited, and organized for editors who value their time and quality.
          </motion.p>
        </div>
      </motion.section>

      {/* Mission Grid with Stagger */}
      <motion.section 
        className={styles.missionGrid}
        variants={staggerContainer}
        initial="initial"
        whileInView="whileInView"
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.div className={styles.missionCard} variants={fadeInUp}>
          <Zap className={styles.cardIcon} size={32} />
          <h3 className={styles.cardTitle}>Instant Access</h3>
          <p className={styles.cardDescription}>
            No complex sign-ups or hidden fees. Just high-quality assets ready for your next project, instantly.
          </p>
        </motion.div>
        <motion.div className={styles.missionCard} variants={fadeInUp}>
          <Headphones className={styles.cardIcon} size={32} />
          <h3 className={styles.cardTitle}>Pro-Grade Quality</h3>
          <p className={styles.cardDescription}>
            Every asset is tested in real-world editing environments to ensure it meets professional standards.
          </p>
        </motion.div>
        <motion.div className={styles.missionCard} variants={fadeInUp}>
          <Sparkles className={styles.cardIcon} size={32} />
          <h3 className={styles.cardTitle}>Curated Selection</h3>
          <p className={styles.cardDescription}>
            We don&apos;t believe in quantity over quality. We only host assets that actually make a difference in your edit.
          </p>
        </motion.div>
      </motion.section>

      {/* Visual Break with Parallax */}
      <section className={styles.visualSection}>
        <div className={styles.imageReveal}>
          <motion.div 
            style={{ y: missionImageY, height: '120%', position: 'absolute', top: '-10%', left: 0, right: 0 }}
          >
            <Image 
              src="/assets/mission-hero.png" 
              alt="Professional Editing Workspace" 
              fill
              sizes="100vw"
              className={styles.parallaxImage}
            />
          </motion.div>
        </div>
        <div className={styles.visualOverlay} />
      </section>

      {/* Philosophy Section */}
      <motion.section 
        className={styles.bioContent} 
        style={{ textAlign: 'center', alignItems: 'center' }}
        {...fadeInUp}
      >
        <h2 className={styles.bioTitle}>Our Philosophy</h2>
        <p className={styles.bioText} style={{ maxWidth: '800px' }}>
          We believe that creativity shouldn&apos;t be limited by a budget. By providing the tools that professionals use for free, 
          we aim to level the playing field for creators everywhere. Whether you&apos;re making your first YouTube video or 
          editing a feature film, SFXFolder is here to support your journey.
        </p>
      </motion.section>

      {/* Connect Section */}
      <motion.section 
        className={styles.connect}
        {...fadeInUp}
      >
        <h2 className={styles.connectTitle}>Stay Connected</h2>
        <div className={styles.socialLinks}>
          {socialLinks.length > 0 ? (
            socialLinks.map((link, index) => {
              const cleanName = link.name.split(' / ')[0].toUpperCase();
              return (
                <a 
                  key={index} 
                  href={link.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={styles.socialLink}
                >
                  {cleanName}
                </a>
              );
            })
          ) : (
            <>
              <a href="#" className={styles.socialLink}>TWITTER</a>
              <a href="#" className={styles.socialLink}>INSTAGRAM</a>
              <a href="#" className={styles.socialLink}>YOUTUBE</a>
            </>
          )}
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} className={styles.socialLink}>
              EMAIL
            </a>
          )}
        </div>
        
        <motion.div 
          className={styles.copyright}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          © {new Date().getFullYear()} {siteName.toUpperCase()} — ALL RIGHTS RESERVED
        </motion.div>
      </motion.section>
    </div>
  );
}
