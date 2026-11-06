"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LinkQuotesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/contractors");
  }, [router]);

  return (
    <div className="p-8 text-center text-sm text-slate-400">
      Redirecting to Contractors directory...
    </div>
  );
}
