"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useDispatch } from "react-redux";
import {
  useGetDealersQuery,
  useGetDealerQuery,
  useCreateDealerMutation,
  useUpdateDealerMutation,
  useUpdatePreferencesMutation,
  useUploadAssetMutation,
} from "@/store/api/dealerApi";
import { setSelectedDealer } from "@/store/slices/dealerSlice";

export default function DealerSettingsPage() {
  const dispatch = useDispatch();
  const [dealerId, setDealerId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [logoCornerEnabled, setLogoCornerEnabled] = useState(false);
  const [logoCornerPosition, setLogoCornerPosition] = useState<"left" | "right">("right");
  const [licensePlateEnabled, setLicensePlateEnabled] = useState(false);
  const [logo3dWallEnabled, setLogo3dWallEnabled] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [licensePlateFile, setLicensePlateFile] = useState<File | null>(null);
  const [studioFile, setStudioFile] = useState<File | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const { data: dealers = [], refetch: refetchDealers } = useGetDealersQuery();
  const { data: dealer, refetch: refetchDealer } = useGetDealerQuery(dealerId!, {
    skip: !dealerId,
  });
  const [createDealer] = useCreateDealerMutation();
  const [updateDealer] = useUpdateDealerMutation();
  const [updatePreferences] = useUpdatePreferencesMutation();
  const [uploadAsset] = useUploadAssetMutation();

  useEffect(() => {
    if (dealer && dealerId) {
      setName(dealer.name);
      setEmail(dealer.email);
      if (dealer.preferences) {
        setLogoCornerEnabled(dealer.preferences.logo_corner_enabled);
        setLogoCornerPosition(
          (dealer.preferences.logo_corner_position as "left" | "right") || "right"
        );
        setLicensePlateEnabled(dealer.preferences.license_plate_enabled);
        setLogo3dWallEnabled(dealer.preferences.logo_3d_wall_enabled);
      }
    }
  }, [dealer, dealerId]);

  const handleSelectDealer = (id: number | null) => {
    setDealerId(id);
    if (!id) {
      setName("");
      setEmail("");
      setLogoCornerEnabled(false);
      setLogoCornerPosition("right");
      setLicensePlateEnabled(false);
      setLogo3dWallEnabled(false);
    }
  };

  const handleSaveDealer = async () => {
    setSaveStatus("saving");
    try {
      if (dealerId) {
        await updateDealer({
          id: dealerId,
          body: { name: name || undefined, email: email || undefined },
        }).unwrap();
      } else {
        if (!name.trim() || !email.trim()) {
          setSaveStatus("error");
          return;
        }
        const created = await createDealer({ name: name.trim(), email: email.trim() }).unwrap();
        setDealerId(created.id);
        dispatch(setSelectedDealer(created.id));
        refetchDealers();
      }
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  };

  const handleSavePreferences = async () => {
    if (!dealerId) return;
    setSaveStatus("saving");
    try {
      await updatePreferences({
        id: dealerId,
        body: {
          logo_corner_enabled: logoCornerEnabled,
          logo_corner_position: logoCornerPosition,
          license_plate_enabled: licensePlateEnabled,
          logo_3d_wall_enabled: logo3dWallEnabled,
        },
      }).unwrap();
      refetchDealer();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("error");
    }
  };

  const handleUploadLogo = async () => {
    if (!dealerId || !logoFile) return;
    try {
      await uploadAsset({
        id: dealerId,
        assetType: "logo",
        file: logoFile,
      }).unwrap();
      setLogoFile(null);
      refetchDealer();
    } catch {
      setSaveStatus("error");
    }
  };

  const handleUploadLicensePlate = async () => {
    if (!dealerId || !licensePlateFile) return;
    try {
      await uploadAsset({
        id: dealerId,
        assetType: "license_plate",
        file: licensePlateFile,
      }).unwrap();
      setLicensePlateFile(null);
      refetchDealer();
    } catch {
      setSaveStatus("error");
    }
  };

  const handleUploadStudio = async () => {
    if (!dealerId || !studioFile) return;
    try {
      await uploadAsset({
        id: dealerId,
        assetType: "studio",
        file: studioFile,
      }).unwrap();
      setStudioFile(null);
      refetchDealer();
    } catch {
      setSaveStatus("error");
    }
  };

  const hasLogoAsset = dealer?.assets?.some((a) => a.asset_type === "logo");
  const hasLicensePlateAsset = dealer?.assets?.some((a) => a.asset_type === "license_plate");
  const hasStudioAsset = dealer?.assets?.some((a) => a.asset_type === "studio");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-12 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
            >
              ← Back
            </Link>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-50">
              Dealer Settings
            </h1>
            <p className="mt-1 text-zinc-500">
              Configure branding and studio for your dealership
            </p>
          </div>
        </header>

        <div className="space-y-10">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">Dealer</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Select dealer</label>
                <select
                  value={dealerId ?? ""}
                  onChange={(e) => handleSelectDealer(e.target.value ? Number(e.target.value) : null)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-zinc-100 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">Create new dealer</option>
                  {dealers.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.email})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dealership name"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contact@dealership.com"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  disabled={!!dealerId}
                />
                {dealerId && (
                  <p className="mt-1 text-xs text-zinc-500">Email cannot be changed after creation</p>
                )}
              </div>
              <button
                onClick={handleSaveDealer}
                disabled={saveStatus === "saving"}
                className="rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
              >
                {saveStatus === "saving" ? "Saving..." : dealerId ? "Update dealer" : "Create dealer"}
              </button>
            </div>
          </section>

          {dealerId && (
            <>
              <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Branding options</h2>

                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 p-4">
                    <div>
                      <h3 className="font-medium text-zinc-200">Option 1: Logo in corner</h3>
                      <p className="text-sm text-zinc-500 mt-1">
                        Place your logo in the corner of exterior images
                      </p>
                      <div className="mt-3 flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={logoCornerEnabled}
                            onChange={(e) => setLogoCornerEnabled(e.target.checked)}
                            className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                          />
                          <span className="text-sm text-zinc-300">Enabled</span>
                        </label>
                        <select
                          value={logoCornerPosition}
                          onChange={(e) => setLogoCornerPosition(e.target.value as "left" | "right")}
                          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100"
                        >
                          <option value="left">Left</option>
                          <option value="right">Right</option>
                        </select>
                      </div>
                      <div className="mt-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                          className="text-sm text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-amber-500/20 file:px-3 file:py-1 file:text-amber-400"
                        />
                        {logoFile && (
                          <button
                            onClick={handleUploadLogo}
                            className="mt-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/30"
                          >
                            Upload logo
                          </button>
                        )}
                        {hasLogoAsset && !logoFile && (
                          <p className="mt-2 text-xs text-emerald-400">✓ Logo uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 p-4">
                    <div>
                      <h3 className="font-medium text-zinc-200">Option 2: Custom license plate</h3>
                      <p className="text-sm text-zinc-500 mt-1">
                        Custom license plate with logo on exterior images
                      </p>
                      <label className="mt-3 flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={licensePlateEnabled}
                          onChange={(e) => setLicensePlateEnabled(e.target.checked)}
                          className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-300">Enabled</span>
                      </label>
                      <div className="mt-3">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setLicensePlateFile(e.target.files?.[0] ?? null)}
                          className="text-sm text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-amber-500/20 file:px-3 file:py-1 file:text-amber-400"
                        />
                        {licensePlateFile && (
                          <button
                            onClick={handleUploadLicensePlate}
                            className="mt-2 rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-500/30"
                          >
                            Upload license plate logo
                          </button>
                        )}
                        {hasLicensePlateAsset && !licensePlateFile && (
                          <p className="mt-2 text-xs text-emerald-400">✓ License plate logo uploaded</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4 rounded-lg border border-zinc-800 p-4">
                    <div>
                      <h3 className="font-medium text-zinc-200">Option 3: 3D logo on studio wall</h3>
                      <p className="text-sm text-zinc-500 mt-1">
                        Place 3D logo on the studio wall in processed images
                      </p>
                      <label className="mt-3 flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={logo3dWallEnabled}
                          onChange={(e) => setLogo3dWallEnabled(e.target.checked)}
                          className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                        />
                        <span className="text-sm text-zinc-300">Enabled</span>
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSavePreferences}
                  disabled={saveStatus === "saving"}
                  className="mt-6 rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
                >
                  {saveStatus === "saving" ? "Saving..." : "Save preferences"}
                </button>
              </section>

              <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-zinc-100">Studio upload</h2>
                <p className="text-sm text-zinc-500 mb-4">
                  Upload a custom studio background for your dealership
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setStudioFile(e.target.files?.[0] ?? null)}
                  className="text-sm text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-amber-500/20 file:px-3 file:py-1 file:text-amber-400"
                />
                {studioFile && (
                  <button
                    onClick={handleUploadStudio}
                    className="mt-3 rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 hover:bg-amber-400"
                  >
                    Upload studio
                  </button>
                )}
                {hasStudioAsset && !studioFile && (
                  <p className="mt-3 text-sm text-emerald-400">✓ Custom studio uploaded</p>
                )}
              </section>
            </>
          )}

          {saveStatus === "saved" && (
            <p className="text-emerald-400 text-sm">Settings saved successfully.</p>
          )}
          {saveStatus === "error" && (
            <p className="text-red-400 text-sm">Failed to save. Please try again.</p>
          )}
        </div>
      </div>
    </div>
  );
}
