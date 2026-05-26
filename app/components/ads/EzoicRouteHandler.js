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
      
      // Sử dụng requestIdleCallback để gọi hiển thị quảng cáo trang mới lúc trình duyệt rảnh rỗi
      const handleShow = () => {
        window.ezstandalone?.showAds();
      };
      
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        window.requestIdleCallback(() => handleShow());
      } else {
        setTimeout(handleShow, 200);
      }
    });
  }, [pathname]);

  return null;
}
