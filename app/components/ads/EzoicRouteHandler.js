"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { runEzoic } from "@/app/lib/ezoic";

export default function EzoicRouteHandler() {
  const pathname = usePathname();

  useEffect(() => {
    runEzoic(() => {
      // Hủy bỏ các vị trí quảng cáo cũ trên trang vừa rời đi
      window.ezstandalone?.destroyPlaceholders();
      
      // Chờ cập nhật giao diện (Next.js DOM render) rồi gọi hiển thị quảng cáo trang mới
      requestAnimationFrame(() => {
        window.ezstandalone?.showAds();
      });
    });
  }, [pathname]);

  return null;
}
