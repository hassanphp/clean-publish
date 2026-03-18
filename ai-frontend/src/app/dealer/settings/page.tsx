"use client";

import Link from "next/link";
import Layout from "@/components/Layout";
import { DealerSettingsForm } from "@/components/dealer/DealerSettingsForm";
import { useGetMeQuery } from "@/lib/store/apiSlice";

export default function DealerSettingsPage() {
  const { data: me } = useGetMeQuery();
  return (
    <Layout>
      <div className="min-h-screen">
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-12">
            <Link
              href="/create?view=dashboard"
              className="text-sm text-blue-500 hover:text-blue-400 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)]">
              Dealer Settings
            </h1>
            <p className="mt-1 text-gray-500">
              Configure branding and studio for your dealership
            </p>
          </header>

          <DealerSettingsForm theme="dark" compact={false} userEmail={me?.email} />
        </div>
      </div>
    </Layout>
  );
}
