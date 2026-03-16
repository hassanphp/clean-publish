"use client";

import { Suspense } from "react";
import { CreateToolFlow } from "@/components/create/CreateToolFlow";

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <CreateToolFlow />
    </Suspense>
  );
}
