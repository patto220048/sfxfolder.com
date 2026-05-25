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
    
    // Check if this is Adsterra code using atOptions
    const isAdsterra = htmlContent.includes('atOptions') || htmlContent.includes('highperformanceformat.com');

    if (isAdsterra) {
      // Clear container and create an isolated iframe
      container.innerHTML = '';
      
      const iframe = document.createElement('iframe');
      iframe.style.border = 'none';
      iframe.style.overflow = 'hidden';
      iframe.style.background = 'transparent';
      iframe.setAttribute('scrolling', 'no');
      
      // Parse width and height from htmlContent
      const widthMatch = htmlContent.match(/'width'\s*:\s*(\d+)/i) || htmlContent.match(/"width"\s*:\s*(\d+)/i) || htmlContent.match(/width="(\d+)"/i) || htmlContent.match(/width:(\d+)px/i);
      const heightMatch = htmlContent.match(/'height'\s*:\s*(\d+)/i) || htmlContent.match(/"height"\s*:\s*(\d+)/i) || htmlContent.match(/height="(\d+)"/i) || htmlContent.match(/height:(\d+)px/i);
      
      const w = widthMatch ? widthMatch[1] : '300';
      const h = heightMatch ? heightMatch[1] : '250';
      
      iframe.style.width = `${w}px`;
      iframe.style.height = `${h}px`;
      
      container.appendChild(iframe);
      
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        iframeDoc.open();
        iframeDoc.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body {
                  margin: 0;
                  padding: 0;
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  background: transparent;
                  overflow: hidden;
                }
              </style>
            </head>
            <body>
              ${htmlContent}
            </body>
          </html>
        `);
        iframeDoc.close();
      } catch (err) {
        console.warn("AdSlot: Failed to write to isolated iframe:", err);
      }
      return;
    }

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
      try {
        if (oldScript.parentNode) {
          oldScript.parentNode.replaceChild(newScript, oldScript);
        }
      } catch (err) {
        console.warn("AdSlot: Script execution failed (possibly due to syntax error in ad code):", err);
      }
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
