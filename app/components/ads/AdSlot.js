"use client";

import { useEffect, useRef } from 'react';

/**
 * AdSlot Component
 * Safely renders raw HTML containing `<script>` tags by re-injecting them into the DOM
 * so that the browser executes the injected JavaScript.
 */
export default function AdSlot({ htmlContent, className }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !htmlContent) return;

    // Set the HTML content
    const container = containerRef.current;
    container.innerHTML = htmlContent;

    // React's dangerouslySetInnerHTML doesn't execute <script> tags.
    // We need to manually recreate and append them.
    const scripts = container.querySelectorAll('script');
    scripts.forEach((oldScript) => {
      const newScript = document.createElement('script');
      
      // Copy all attributes (like src, async, data-ad-client, etc.)
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });
      
      // Copy the inline script content if any
      if (oldScript.innerHTML) {
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
      }
      
      // Replace the old script with the new, executable one
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }, [htmlContent]);

  if (!htmlContent) return null;

  return (
    <div 
      ref={containerRef} 
      className={className || ''} 
      style={{ display: 'flex', justifyContent: 'center', width: '100%' }}
    />
  );
}
