"use client";

import { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import { HelpCircle, PlayCircle } from "lucide-react";
import { useDealerSetupTour } from "./DealerSetupTour";
import {
  useGetDealersQuery,
  useGetDealerQuery,
  useCreateDealerMutation,
  useUpdateDealerMutation,
  useUpdatePreferencesMutation,
  useUploadAssetMutation,
  useDeleteAssetMutation,
} from "@/store/api/dealerApi";
import { setSelectedDealer } from "@/store/slices/dealerSlice";
import { ImageIcon, Upload, Trash2, CheckCircle } from "lucide-react";

interface DealerSettingsFormProps {
  initialDealerId?: number | null;
  theme?: "light" | "dark";
  compact?: boolean;
  /** Pre-fill dealer email when creating new profile (e.g. logged-in user email) */
  userEmail?: string;
}

const cardBase = "rounded-2xl border border-[var(--border)] bg-[var(--card)]";
const textPrimary = "text-[var(--foreground)]";
const textSecondary = "text-gray-500";
const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3 text-[var(--foreground)] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent";
const labelClass = "block text-sm font-medium text-[var(--foreground)] mb-1.5";

export function DealerSettingsForm({
  initialDealerId = null,
  theme = "dark",
  compact = false,
  userEmail,
}: DealerSettingsFormProps) {
  const dispatch = useDispatch();
  const [dealerId, setDealerId] = useState<number | null>(initialDealerId);
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
  const { startTour } = useDealerSetupTour();

  const { data: dealers = [], refetch: refetchDealers } = useGetDealersQuery(
    { email: userEmail ?? undefined }
  );
  const { data: dealer, refetch: refetchDealer } = useGetDealerQuery(dealerId!, {
    skip: !dealerId,
  });
  const [createDealer] = useCreateDealerMutation();
  const [updateDealer] = useUpdateDealerMutation();
  const [updatePreferences] = useUpdatePreferencesMutation();
  const [uploadAsset] = useUploadAssetMutation();
  const [deleteAsset] = useDeleteAssetMutation();

  useEffect(() => {
    if (initialDealerId && !dealerId) setDealerId(initialDealerId);
  }, [initialDealerId, dealerId]);

  useEffect(() => {
    if (!dealerId && userEmail) setEmail(userEmail);
  }, [dealerId, userEmail]);

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
      setEmail(userEmail ?? "");
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
      await uploadAsset({ id: dealerId, assetType: "logo", file: logoFile }).unwrap();
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
      await uploadAsset({ id: dealerId, assetType: "studio", file: studioFile }).unwrap();
      setStudioFile(null);
      refetchDealer();
    } catch {
      setSaveStatus("error");
    }
  };

  const hasLogoAsset = dealer?.assets?.some((a) => a.asset_type === "logo");
  const hasLicensePlateAsset = dealer?.assets?.some((a) => a.asset_type === "license_plate");
  const hasStudioAsset = dealer?.assets?.some((a) => a.asset_type === "studio");

  const handleDeleteAsset = async (assetId: number) => {
    if (!dealerId) return;
    try {
      await deleteAsset({ id: dealerId, assetId }).unwrap();
      refetchDealer();
    } catch {
      setSaveStatus("error");
    }
  };

  const p = compact ? "p-4" : "p-6";
  const sectionGap = compact ? "space-y-6" : "space-y-10";

  return (
    <div className={sectionGap}>
      {/* Help header + guided tour */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <HelpCircle className="w-4 h-4 shrink-0" />
          <span>
            Setup is optional. You can process images without a dealer profile. When set up, branding is applied automatically.
          </span>
        </div>
        <button
          type="button"
          onClick={startTour}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--background)]/50 transition-colors shrink-0"
        >
          <PlayCircle className="w-4 h-4" />
          Start guided tour
        </button>
      </div>

      {/* Step 1: Create or select dealer */}
      <section className={`${cardBase} ${p}`} data-tour="dealer-profile-section">
        <h2 className="text-lg font-semibold mb-4">Dealer profile</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Select dealer</label>
            <select
              value={dealerId ?? ""}
              onChange={(e) => handleSelectDealer(e.target.value ? Number(e.target.value) : null)}
              className={inputClass}
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
            <label className={labelClass}>Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dealership name"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@dealership.com"
              className={inputClass}
              disabled={!!dealerId}
            />
            {dealerId && (
              <p className="mt-1 text-xs text-gray-500">Email cannot be changed after creation</p>
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

      {/* Step 2: Branding (only when dealer selected) */}
      {dealerId && (
        <>
          <section className={`${cardBase} ${p}`} data-tour="dealer-branding-section">
            <h2 className="text-lg font-semibold mb-2">Branding</h2>
            <p className="text-sm text-gray-500 mb-4">
              Logo and preferences are saved in the database. Used automatically when processing images.
            </p>

            {dealer?.assets && dealer.assets.length > 0 && (
              <div className="mb-6 rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]/50" data-tour="dealer-assets-section">
                <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" /> Uploaded assets
                </h3>
                <div className="flex flex-wrap gap-3">
                  {dealer.assets.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 rounded-lg bg-[var(--card)] px-3 py-2 text-sm border border-[var(--border)]"
                    >
                      <span className="capitalize">{a.asset_type.replace("_", " ")}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteAsset(a.id)}
                        className="text-red-500 hover:text-red-400 text-xs font-medium flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-6">
              {/* Logo in corner */}
              <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]/30">
                <h3 className="font-medium mb-1">Logo in corner</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Place your logo in the corner of exterior images
                </p>
                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={logoCornerEnabled}
                      onChange={(e) => setLogoCornerEnabled(e.target.checked)}
                      className="rounded border-[var(--border)] bg-[var(--background)] text-amber-500 focus:ring-amber-500"
                    />
                    <span className="text-sm">Enabled</span>
                  </label>
                  <select
                    value={logoCornerPosition}
                    onChange={(e) => setLogoCornerPosition(e.target.value as "left" | "right")}
                    className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                    className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-4 file:py-2 file:text-amber-600 file:font-medium file:cursor-pointer cursor-pointer"
                  />
                  {logoFile && (
                    <button
                      onClick={handleUploadLogo}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
                    >
                      Upload logo
                    </button>
                  )}
                  {hasLogoAsset && !logoFile && (
                    <span className="flex items-center gap-1 text-sm text-emerald-500">
                      <CheckCircle className="w-4 h-4" /> Logo uploaded
                    </span>
                  )}
                </div>
              </div>

              {/* License plate */}
              <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]/30">
                <h3 className="font-medium mb-1">Custom license plate</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Custom license plate with logo on exterior images
                </p>
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={licensePlateEnabled}
                    onChange={(e) => setLicensePlateEnabled(e.target.checked)}
                    className="rounded border-[var(--border)] bg-[var(--background)] text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm">Enabled</span>
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLicensePlateFile(e.target.files?.[0] ?? null)}
                    className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-4 file:py-2 file:text-amber-600 file:font-medium file:cursor-pointer cursor-pointer"
                  />
                  {licensePlateFile && (
                    <button
                      onClick={handleUploadLicensePlate}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-amber-400"
                    >
                      Upload license plate logo
                    </button>
                  )}
                  {hasLicensePlateAsset && !licensePlateFile && (
                    <span className="flex items-center gap-1 text-sm text-emerald-500">
                      <CheckCircle className="w-4 h-4" /> License plate uploaded
                    </span>
                  )}
                </div>
              </div>

              {/* 3D wall logo */}
              <div className="rounded-xl border border-[var(--border)] p-4 bg-[var(--background)]/30">
                <h3 className="font-medium mb-1">3D logo on studio wall</h3>
                <p className="text-sm text-gray-500 mb-3">
                  Place 3D logo on the studio wall in processed images
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logo3dWallEnabled}
                    onChange={(e) => setLogo3dWallEnabled(e.target.checked)}
                    className="rounded border-[var(--border)] bg-[var(--background)] text-amber-500 focus:ring-amber-500"
                  />
                  <span className="text-sm">Enabled</span>
                </label>
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

          {/* Step 3: Studio upload */}
          <section className={`${cardBase} ${p}`} data-tour="dealer-studio-section">
            <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5" /> Custom studio
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Upload a custom studio background for your dealership
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setStudioFile(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-2 file:rounded-lg file:border-0 file:bg-amber-500/20 file:px-4 file:py-2 file:text-amber-600 file:font-medium file:cursor-pointer cursor-pointer"
              />
              {studioFile && (
                <button
                  onClick={handleUploadStudio}
                  className="rounded-xl bg-amber-500 px-6 py-2.5 font-bold text-zinc-950 hover:bg-amber-400"
                >
                  Upload studio
                </button>
              )}
              {hasStudioAsset && !studioFile && (
                <span className="flex items-center gap-1 text-sm text-emerald-500">
                  <CheckCircle className="w-4 h-4" /> Custom studio uploaded
                </span>
              )}
            </div>
          </section>
        </>
      )}

      {saveStatus === "saved" && (
        <p className="text-emerald-500 text-sm font-medium">Settings saved successfully.</p>
      )}
      {saveStatus === "error" && (
        <p className="text-red-500 text-sm font-medium">Failed to save. Please try again.</p>
      )}
    </div>
  );
}
