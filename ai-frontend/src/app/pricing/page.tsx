"use client";

import React, { useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout";
import { useTheme } from "@/context/ThemeContext";
import { useCreateCheckoutMutation, useGetMeQuery } from "@/lib/store/apiSlice";
import { Check } from "lucide-react";

const PLAN_IDS: Record<string, string> = { Starter: "starter", Growth: "growth", Pro: "pro" };

export default function PricingPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { data: user } = useGetMeQuery(undefined, { skip: typeof window === "undefined" });
  const [createCheckout, { isLoading }] = useCreateCheckoutMutation();
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async (planName: string) => {
    const planId = PLAN_IDS[planName];
    if (!planId || !user) return;
    setError(null);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const { url } = await createCheckout({
        plan_id: planId,
        success_url: `${base}/create?view=dashboard`,
        cancel_url: `${base}/pricing`,
      }).unwrap();
      if (url) window.location.href = url;
    } catch (e: unknown) {
      const err = e as { data?: { detail?: string }; status?: number; error?: string };
      const msg =
        err?.data?.detail ??
        err?.error ??
        (e instanceof Error ? e.message : "Checkout failed");
      setError(msg);
    }
  };

  const plans = [
    {
      name: "Starter",
      price: 99,
      images: 300,
      features: [
        "Studio generation",
        "Image enhancement",
        "Logo branding",
        "High-res downloads",
      ],
    },
    {
      name: "Growth",
      price: 299,
      images: 1000,
      popular: true,
      features: [
        "Everything in Starter",
        "Priority processing",
        "Extended studio selection",
      ],
    },
    {
      name: "Pro",
      price: 699,
      images: 3000,
      features: [
        "Everything in Growth",
        "Highest priority",
        "Custom branding options",
        "Multi-location use",
      ],
    },
  ];

  return (
    <Layout>
      <div
        className={`min-h-screen py-24 px-4 ${isDark ? "bg-black text-white" : "bg-gray-50 text-gray-900"}`}
      >
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-center">
              {error}
            </div>
          )}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-black mb-4">Simple, Transparent Pricing</h1>
            <p className="text-xl opacity-70">
              Choose the plan that fits your studio needs.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 ${plan.popular ? "border-blue-500 ring-2 ring-blue-500/20" : isDark ? "border-white/10" : "border-gray-200"} ${isDark ? "bg-zinc-900" : "bg-white"}`}
              >
                {plan.popular && (
                  <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-500 text-white mb-4">
                    POPULAR
                  </span>
                )}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-4xl font-black">${plan.price}</span>
                  <span className="opacity-70">/month</span>
                </div>
                <p className="text-sm opacity-70 mb-6">{plan.images} images included</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {user ? (
                  <button
                    onClick={() => handleBuy(plan.name)}
                    disabled={isLoading}
                    className={`block w-full py-3 text-center font-bold rounded-xl transition-colors disabled:opacity-50 ${plan.popular ? "bg-blue-600 text-white hover:bg-blue-700" : isDark ? "bg-white/10 hover:bg-white/20" : "bg-gray-900 text-white hover:bg-gray-800"}`}
                  >
                    {isLoading ? "Loading…" : "Buy Credits"}
                  </button>
                ) : (
                  <Link
                    href="/?auth=1"
                    className={`block w-full py-3 text-center font-bold rounded-xl transition-colors ${plan.popular ? "bg-blue-600 text-white hover:bg-blue-700" : isDark ? "bg-white/10 hover:bg-white/20" : "bg-gray-900 text-white hover:bg-gray-800"}`}
                  >
                    Sign in to Buy
                  </Link>
                )}
              </div>
            ))}
          </div>

          <p className="text-center mt-12 opacity-70">
            Need a custom plan? <Link href="/contact" className="text-blue-500 hover:underline">Contact our sales team</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
