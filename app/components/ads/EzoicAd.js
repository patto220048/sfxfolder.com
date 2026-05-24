"use client";

import { useEffect, useState } from "react";
import { runEzoic } from "@/app/lib/ezoic";

export default function EzoicAd({ id }) {
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    setIsRendered(true);
    
    // Khi component được chèn vào DOM (Mount)
    runEzoic(() => {
      window.ezstandalone?.showAds(id);
    });

    // Khi component bị gỡ khỏi DOM (Unmount)
    return () => {
      runEzoic(() => {
        window.ezstandalone?.destroyPlaceholders(id);
      });
    };
  }, [id]);

  return (
    <div className="ezoic-ad-container" style={{ display: "flex", justifyContent: "center", width: "100%" }}>
      {isRendered && <div id={`ezoic-pub-ad-placeholder-${id}`} />}
    </div>
  );
}
