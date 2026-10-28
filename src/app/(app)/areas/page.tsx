"use client";

import React from "react";
import { AreaManager } from "@/modules/masters/components/AreaManager";

export default function AreasPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          Campus Areas & Locations
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Dynamic management of facilities, buildings, floors, and rooms for maintenance and task allocation
        </p>
      </div>

      <AreaManager />
    </div>
  );
}
