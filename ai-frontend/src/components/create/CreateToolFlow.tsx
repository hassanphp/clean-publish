"use client";

import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Layout from "@/components/Layout";
import {
  DashboardShell,
  type DashboardSection,
} from "@/components/dashboard/DashboardShell";
import { DashboardOverview } from "@/components/dashboard/DashboardOverview";
import { DashboardProjects } from "@/components/dashboard/DashboardProjects";
import { DashboardDealerProfile } from "@/components/dashboard/DashboardDealerProfile";
import { DashboardDealerSettings } from "@/components/dashboard/DashboardDealerSettings";
import { DashboardAccount } from "@/components/dashboard/DashboardAccount";
import { CreateStudioPicker } from "./CreateStudioPicker";
import { CreateUploadChoice } from "./CreateUploadChoice";
import { ProcessingView } from "./ProcessingView";
import { ResultsGrid } from "@/components/ResultsGrid";
import { useTheme } from "@/context/ThemeContext";
import { useLanguage } from "@/context/LanguageContext";
import { useCredits } from "@/context/CreditsContext";
import { translations } from "@/lib/i18n";
import { STUDIO_PRESETS } from "@/lib/createConstants";
import { processBatch, type ProcessedResult } from "@/lib/api";
import { getCompletedImageCount } from "@/lib/progress";
import {
  useGetMeQuery,
  useGetProjectsQuery,
  useGetProjectImagesQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useUpsertProjectImagesMutation,
} from "@/lib/store/apiSlice";
import { useGetDealersQuery } from "@/store/api/dealerApi";
import { useSelector } from "react-redux";
import type {
  TaskType,
  Order,
  StudioTemplate,
  BrandingConfig,
  CameraAngle,
} from "@/types/create";

function projectToOrder(p: { id: number; title: string; status: string; created_at: string; updated_at: string; thumbnail_url?: string | null }): Order {
  return {
    id: String(p.id),
    projectId: p.id,
    title: p.title,
    vin: "",
    createdAt: p.updated_at || p.created_at,
    status: (p.status === "completed" ? "completed" : p.status === "active" ? "active" : "draft") as Order["status"],
    jobs: [],
    studioId: STUDIO_PRESETS[0].id,
    taskType: "bg-replacement",
    thumbnailUrl: p.thumbnail_url ?? undefined,
  };
}

type ViewState =
  | "dashboard"
  | "project-name"
  | "studio"
  | "upload-choice"
  | "processing"
  | "results";

export function CreateToolFlow() {
  const searchParams = useSearchParams();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const { totalCredits } = useCredits();
  const t = translations[language as keyof typeof translations] || translations.en;

  const { data: me } = useGetMeQuery();
  const isLoggedIn = !!me;
  const { data: projects, isLoading: loadingProjects } = useGetProjectsQuery(undefined, { skip: !isLoggedIn });
  const [createProject, { isLoading: isCreatingProject }] = useCreateProjectMutation();
  const [updateProject] = useUpdateProjectMutation();
  const [deleteProject] = useDeleteProjectMutation();
  const [upsertProjectImages] = useUpsertProjectImagesMutation();

  const [view, setView] = useState<ViewState>("dashboard");
  const [dashboardSection, setDashboardSection] = useState<DashboardSection>("overview");
  const [dealerIdForSettings, setDealerIdForSettings] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);

  const { data: dealers = [] } = useGetDealersQuery(
    { email: me?.email ?? undefined },
    { skip: !isLoggedIn }
  );
  const selectedDealerId = useSelector((s: { dealer?: { selectedDealerId: number | null } }) => s.dealer?.selectedDealerId ?? null);

  const needsImages = currentOrder?.projectId && !(currentOrder?.jobs?.length ?? 0);
  const { data: projectImages } = useGetProjectImagesQuery(currentOrder?.projectId ?? 0, {
    skip: !needsImages || !currentOrder?.projectId,
  });
  const [activeTask, setActiveTask] = useState<TaskType | null>(null);
  const [selectedStudio, setSelectedStudio] = useState<StudioTemplate>(STUDIO_PRESETS[0]);
  const BRANDING_STORAGE_KEY = "carveo-create-branding";

  const loadBrandingFromStorage = (): BrandingConfig => {
    if (typeof window === "undefined") return { logoUrl: null, isEnabled: true, logo3dWallEnabled: true };
    try {
      const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<BrandingConfig> & { logo3dWallEnabled?: boolean };
        return {
          logoUrl: parsed.logoUrl ?? null,
          isEnabled: parsed.isEnabled ?? true,
          logo3dWallEnabled: parsed.logo3dWallEnabled ?? parsed.isEnabled ?? true,
        };
      }
    } catch {
      /* ignore */
    }
    return { logoUrl: null, isEnabled: true, logo3dWallEnabled: true };
  };

  const [branding, setBranding] = useState<BrandingConfig>(loadBrandingFromStorage);

  useEffect(() => {
    try {
      if (branding.logoUrl && branding.logoUrl.length > 400_000) return;
      localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(branding));
    } catch {
      /* quota exceeded or disabled */
    }
  }, [branding]);

  const [projectName, setProjectName] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [streamComplete, setStreamComplete] = useState(false);
  const [targetStudioDescription, setTargetStudioDescription] = useState("");
  const [studioReferenceDataUri, setStudioReferenceDataUri] = useState<string | null>(null);
  const [pipelineVersion, setPipelineVersion] = useState<"11">("11");
  const [previewMode, setPreviewMode] = useState(false);
  const resultsRef = useRef<ProcessedResult[]>([]);
  const dealerId = useSelector((s: { dealer?: { selectedDealerId: number | null } }) => s.dealer?.selectedDealerId ?? null);
  const useDealerSettings = useSelector((s: { dealer?: { useDealerSettings: boolean } }) => s.dealer?.useDealerSettings ?? false);

  useEffect(() => {
    if (searchParams.get("view") === "dashboard") {
      setView("dashboard");
    }
  }, [searchParams]);

  useEffect(() => {
    if (isLoggedIn && projects) {
      setOrders(projects.map(projectToOrder));
    }
  }, [isLoggedIn, projects]);

  useEffect(() => {
    if (needsImages && projectImages?.length && currentOrder) {
      const jobs = projectImages.map((img, i) => ({
        id: `img-${img.id}`,
        originalImage: img.original_url ?? "",
        processedImage: img.processed_url ?? undefined,
        angle: "AUTO" as CameraAngle,
        status: "completed" as const,
      }));
      const updatedOrder = { ...currentOrder, jobs };
      setCurrentOrder(updatedOrder);
      setOrders((o) => o.map((ord) => (ord.id === currentOrder.id ? updatedOrder : ord)));
      setResults(
        projectImages.map((img, i) => ({
          index: i,
          original_b64: img.original_url ?? "",
          processed_b64: img.processed_url ?? "",
          metadata: { view_category: "exterior", components: [], existing_lighting: "unknown", dominant_color: "unknown", suggested_edit_mode: "product-image" },
        }))
      );
      setView("results");
    }
  }, [needsImages, projectImages, currentOrder?.id]);

  const getStudioBase64 = async (studio: StudioTemplate): Promise<string | null> => {
    try {
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${studio.thumbnail}`
          : studio.thumbnail;
      const res = await fetch(url);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read studio image"));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const handleTaskSelect = (task: TaskType) => {
    if (totalCredits <= 0) {
      setError("Insufficient credits. Please purchase more to continue.");
      return;
    }
    setActiveTask(task);
    setCurrentOrder(null);
    setProjectName("");
    setView("project-name");
  };

  const handleOrderSelect = (order: Order) => {
    setCurrentOrder(order);
    if (order.jobs?.length && order.jobs.some((j) => j.processedImage)) {
      setResults(
        order.jobs.map((j, i) => ({
          index: i,
          original_b64: j.originalImage,
          processed_b64: j.processedImage || "",
          metadata: { view_category: "exterior", components: [], existing_lighting: "unknown", dominant_color: "unknown", suggested_edit_mode: "product-image" },
        }))
      );
      setView("results");
    } else {
      setView("studio");
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order?.projectId && isLoggedIn) {
      try {
        await deleteProject(order.projectId).unwrap();
      } catch (err) {
        const anyErr = err as any;
        const status = anyErr?.status ?? anyErr?.originalStatus;
        // During bulk delete, some deletes can race with state refresh; treat "not found" as already deleted.
        if (status === 404) {
          // Continue to remove from local state.
        } else {
          const msg = err instanceof Error ? err.message : "Failed to delete project";
          setError(msg);
          return;
        }
      }
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    if (currentOrder?.id === orderId) setCurrentOrder(null);
  };

  const handleRenameOrder = async (orderId: string, newTitle: string) => {
    const order = orders.find((o) => o.id === orderId);
    if (order?.projectId && isLoggedIn) {
      try {
        await updateProject({ id: order.projectId, title: newTitle }).unwrap();
      } catch {
        /* fallback to local update */
      }
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, title: newTitle } : o))
    );
    if (currentOrder?.id === orderId) setCurrentOrder({ ...currentOrder, title: newTitle });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = (ev.target?.result as string) || null;
        setBranding((prev) => ({ ...prev, logoUrl: dataUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleToggleBranding = () =>
    setBranding((prev) => ({ ...prev, logo3dWallEnabled: !prev.logo3dWallEnabled }));

  const handleProjectNameContinue = async () => {
    if (!projectName.trim()) return;
    const title = projectName.trim();
    setError(null);
    if (isLoggedIn) {
      try {
        const project = await createProject({ title }).unwrap();
        const order: Order = {
          id: String(project.id),
          projectId: project.id,
          title: project.title,
          vin: "",
          createdAt: project.created_at,
          status: "draft",
          jobs: [],
          studioId: selectedStudio.id,
          taskType: activeTask?.id || "bg-replacement",
          branding: { ...branding },
        };
        setCurrentOrder(order);
        setOrders((prev) => [order, ...prev.filter((o) => o.projectId !== project.id)]);
        setView("studio");
      } catch (err: unknown) {
        const msg =
          err && typeof err === "object" && "data" in err && err.data && typeof (err.data as { detail?: string }).detail === "string"
            ? (err.data as { detail: string }).detail
            : err && typeof err === "object" && "status" in err && (err as { status: number }).status === 401
              ? "Please log in again."
              : "Failed to create project. Please try again.";
        setError(msg);
      }
    } else {
      const order: Order = {
        id: crypto.randomUUID(),
        title,
        vin: "",
        createdAt: new Date().toISOString(),
        status: "draft",
        jobs: [],
        studioId: selectedStudio.id,
        taskType: activeTask?.id || "bg-replacement",
        branding: { ...branding },
      };
      setCurrentOrder(order);
      setOrders((prev) => [order, ...prev]);
      setView("studio");
    }
  };

  const handleStudioNext = () => setView("upload-choice");

  const handleUploadComplete = async (uploaded: { angle: CameraAngle; data: string }[]) => {
    const imageBase64s = uploaded.map((u) => u.data);
    setImages(imageBase64s);
    setView("processing");
    setLogs([]);
    setResults([]);
    setError(null);
    setStreamComplete(false);
    resultsRef.current = [];

    const studioB64 = await getStudioBase64(selectedStudio);
    if (!studioB64) {
      setError("Failed to load studio image. Please try again.");
      setView("upload-choice");
      return;
    }
    setStudioReferenceDataUri(studioB64);

    const brandingOptions =
      branding.logoUrl
        ? {
            logo_b64: branding.logoUrl,
            logo_corner_enabled: true,
            logo_corner_position: "right" as const,
            license_plate_enabled: branding.logo3dWallEnabled,
            logo_3d_wall_enabled: branding.logo3dWallEnabled,
          }
        : undefined;

    const payload = {
      images: imageBase64s,
      pipeline_version: pipelineVersion,
      preview: previewMode,
      studio_reference_image: studioB64,
      ...(currentOrder?.projectId && { project_id: currentOrder.projectId }),
      ...(dealerId && { dealer_id: dealerId }),
      // When dealer selected + useDealerSettings: backend loads branding from DB. Else use session branding_options.
      ...(brandingOptions && { branding_options: brandingOptions }),
    };

    try {
      await processBatch(payload, {
        onLog: (msg) => setLogs((prev) => [...prev, msg]),
        onResult: (result) => {
          const next = [...resultsRef.current, result].sort((a, b) => a.index - b.index);
          resultsRef.current = next;
          setResults(next);
        },
        onComplete: async (data) => {
          setStreamComplete(true);
          if (data.target_studio_description)
            setTargetStudioDescription(data.target_studio_description);
          const finalResults = data.results?.length ? data.results : resultsRef.current;
          if (data.status === "completed" && finalResults.length > 0) {
            resultsRef.current = finalResults;
            setResults(finalResults);
            setView("results");
            const jobs = finalResults.map((r) => ({
              id: crypto.randomUUID(),
              originalImage: r.original_b64,
              processedImage: r.processed_b64,
              angle: "AUTO" as CameraAngle,
              status: "completed" as const,
            }));
            const thumbnailUrl = finalResults[0]?.processed_b64;
            const updatedOrder = currentOrder
              ? { ...currentOrder, jobs, status: "completed" as const, thumbnailUrl }
              : null;
            if (updatedOrder) {
              setOrders((o) =>
                o.map((ord) => (ord.id === currentOrder?.id ? updatedOrder : ord))
              );
              setCurrentOrder(updatedOrder);
              if (updatedOrder.projectId && isLoggedIn) {
                try {
                  await upsertProjectImages({
                    projectId: updatedOrder.projectId,
                    images: finalResults.map((r, i) => ({
                      image_index: i,
                      original_url: r.original_b64,
                      processed_url: r.processed_b64,
                      status: "completed",
                    })),
                  }).unwrap();
                } catch {
                  /* ignore */
                }
              }
            }
          } else if (data.status === "failed") {
            setError(data.error ?? "Processing failed");
          } else if (resultsRef.current.length > 0) {
            setView("results");
          }
        },
        onError: (msg) => setError(msg),
      });
      if (resultsRef.current.length > 0) setView("results");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        msg.includes("fetch") || msg.includes("Failed to fetch")
          ? "Cannot reach the backend. Ensure it's running."
          : msg
      );
    }
  };

  const handleBackToUpload = () => setView("upload-choice");
  const handleReset = () => {
    setView("dashboard");
    setImages([]);
    setLogs([]);
    setResults([]);
    setError(null);
    setStreamComplete(false);
    setCurrentOrder(null);
    setTargetStudioDescription("");
    setStudioReferenceDataUri(null);
  };

  const themeVal = theme === "dark" ? "dark" : "light";

  if (view === "dashboard") {
    const renderDashboardContent = () => {
      switch (dashboardSection) {
        case "overview":
          return (
            <DashboardOverview
              onTaskSelect={handleTaskSelect}
              orders={orders}
              totalCredits={totalCredits}
              selectedStudio={selectedStudio}
              branding={branding}
              onLogoUpload={handleLogoUpload}
              onToggleBranding={handleToggleBranding}
              t={t}
              theme={themeVal}
              isLoggedIn={isLoggedIn}
              hasNoDealer={isLoggedIn && dealers.length === 0}
              onSetupDealer={() => setDashboardSection("dealer-settings")}
            />
          );
        case "projects":
          return (
            <DashboardProjects
              orders={orders}
              loadingProjects={isLoggedIn && loadingProjects}
              onOrderSelect={handleOrderSelect}
              onDeleteOrder={handleDeleteOrder}
              onRenameOrder={handleRenameOrder}
              onTaskSelect={handleTaskSelect}
              t={t}
              theme={themeVal}
            />
          );
        case "dealer-profile":
          return (
            <DashboardDealerProfile
              dealers={dealers}
              selectedDealerId={selectedDealerId}
              theme={themeVal}
              onNavigateToSettings={(dealerId?: number) => {
                setDealerIdForSettings(dealerId ?? null);
                setDashboardSection("dealer-settings");
              }}
            />
          );
        case "dealer-settings":
          return (
            <DashboardDealerSettings
              theme={themeVal}
              hasDealers={dealers.length > 0}
              initialDealerId={dealerIdForSettings}
              userEmail={me?.email ?? undefined}
            />
          );
        case "account":
          return <DashboardAccount user={me ?? null} theme={themeVal} />;
        default:
          return null;
      }
    };

    return (
      <Layout>
        <DashboardShell
          section={dashboardSection}
          onSectionChange={setDashboardSection}
          theme={themeVal}
          isLoggedIn={isLoggedIn}
          hasDealerAccess={true}
        >
          {renderDashboardContent()}
        </DashboardShell>
      </Layout>
    );
  }

  if (view === "project-name") {
    return (
      <Layout>
        <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12">
          <h2 className="text-2xl md:text-4xl font-black mb-6 text-[var(--foreground)]">
            Name your project
          </h2>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="e.g. BMW 3 Series"
            className="w-full max-w-md px-4 py-3 rounded-xl bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-6"
          />
          {error && (
            <p className="max-w-md mb-4 text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-4">
            <button
              onClick={() => setView("dashboard")}
              disabled={isCreatingProject}
              className="px-6 py-3 rounded-xl border border-[var(--border)] bg-[var(--card)] font-medium disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleProjectNameContinue}
              disabled={!projectName.trim() || isCreatingProject}
              className="px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
            >
              {isCreatingProject ? "Creating…" : "Continue"}
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === "studio") {
    return (
      <Layout>
        <div className="min-h-screen px-4 py-8">
          <CreateStudioPicker
            selectedStudio={selectedStudio}
            onSelect={setSelectedStudio}
            onNext={handleStudioNext}
            t={t}
            theme={themeVal}
          />
          <div className="mt-6 flex items-center justify-center sm:justify-end">
            <label className="flex items-center gap-3 text-sm font-semibold text-[var(--foreground)]">
              <input
                type="checkbox"
                checked={previewMode}
                onChange={(e) => setPreviewMode(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Preview mode (lower cost, lower quality)
            </label>
          </div>
        </div>
      </Layout>
    );
  }

  if (view === "upload-choice") {
    return (
      <Layout>
        <div className="min-h-screen px-4 py-8">
          <CreateUploadChoice
            onUploadComplete={handleUploadComplete}
            onBack={() => setView("studio")}
            t={t}
            theme={themeVal}
          />
        </div>
      </Layout>
    );
  }

  if (view === "processing") {
    const completedCount = Math.max(getCompletedImageCount(logs), results.length);
    const themeVal = theme === "dark" ? "dark" : "light";
    return (
      <Layout>
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
            <ProcessingView
              logs={logs}
              totalImages={images.length}
              completedCount={completedCount}
              resultsCount={results.length}
              streamComplete={streamComplete}
              error={error}
              onViewResults={() => setView("results")}
              onStartOver={handleReset}
              t={t}
              theme={themeVal}
            />
          </div>
        </div>
      </Layout>
    );
  }

  if (view === "results") {
    return (
      <Layout>
        <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Results</h2>
              <button
                onClick={handleReset}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-6 py-2.5 font-medium"
              >
                Process more
              </button>
            </div>
            <ResultsGrid
              results={results}
              pipelineVersion={pipelineVersion}
              targetStudioDescription={targetStudioDescription}
              studioReferenceDataUri={studioReferenceDataUri}
              onResultUpdate={(updated) => {
                setResults((prev) =>
                  prev.map((r) => (r.index === updated.index ? updated : r))
                );
              }}
            />
          </div>
        </div>
      </Layout>
    );
  }

  return null;
}
