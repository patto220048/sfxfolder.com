"use client";

export default function PluginLayout({ children }) {
  return (
    <div className="plugin-root">
      {children}
      <style jsx global>{`
        /* Hide scrollbars in plugin mode for a cleaner look */
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 10px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
        
        /* Ensure the main container takes full height without global padding */
        body {
          overflow: hidden;
          background-color: var(--background);
        }
      `}</style>
    </div>
  );
}
