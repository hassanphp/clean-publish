"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  login,
  processBatch,
  type ProcessedResult,
  adminGetFlags,
  adminSetFlag,
  adminListFeedback,
  adminCreateFeedback,
  adminUpdateFeedback,
  adminDatasetStats,
  adminDownloadDataset,
  adminSmokeTest,
  type FeedbackItem,
} from "@/lib/api";
import {
  FlaskConical,
  MessageSquare,
  Database,
  LogIn,
  LogOut,
  Play,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Settings2,
  FileImage,
  Sparkles,
  Copy,
} from "lucide-react";

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

type Tab = "tests" | "feedback" | "dataset";

export default function AdminHome() {
  const [email, setEmail] = useState("dealer@domain.com");
  const [password, setPassword] = useState("Admin@321");
  const [token, setToken] = useState<string>("");
  const [tab, setTab] = useState<Tab>("tests");
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [pipeline, setPipeline] = useState<"11" | "6" | "7">("11");
  const [preview, setPreview] = useState(true);
  const [studio, setStudio] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<ProcessedResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [flags, setFlags] = useState<Record<string, string | null>>({});

  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackTitle, setFeedbackTitle] = useState("");
  const [feedbackContent, setFeedbackContent] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("quality");
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [datasetDays, setDatasetDays] = useState(7);
  const [datasetStats, setDatasetStats] = useState<{
    last_n_days: number;
    count: number;
    total_completed: number;
  } | null>(null);
  const [datasetLoading, setDatasetLoading] = useState(false);
  const [smokeInfo, setSmokeInfo] = useState<{ message: string; scripts: string[] } | null>(null);

  const showToast = useCallback((type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const onLogin = useCallback(async () => {
    try {
      const t = await login(email, password);
      setToken(t);
      try {
        setFlags(await adminGetFlags(t));
        showToast("success", "Logged in");
      } catch (flagsErr) {
        showToast("error", (flagsErr as Error).message);
      }
    } catch (e) {
      showToast("error", (e as Error).message);
    }
  }, [email, password, showToast]);

  const onLogout = useCallback(() => {
    setToken("");
    setTab("tests");
  }, []);

  const canRun = useMemo(() => !!token && !!studio && images.length > 0, [token, studio, images]);

  const onRun = useCallback(async () => {
    if (!canRun || !studio) return;
    setBusy(true);
    setLogs([]);
    setResults([]);
    try {
      const studioB64 = await readAsDataURL(studio);
      const imgs = await Promise.all(images.map(readAsDataURL));
      await processBatch(
        {
          images: imgs,
          studio_reference_data_uri: studioB64,
          pipeline_version: pipeline,
          preview,
        },
        token,
        {
          onLog: (m) => setLogs((l) => [...l, m]),
          onResult: (r) => setResults((rs) => [...rs, r]),
          onComplete: () => {
            setBusy(false);
            showToast("success", "Processing complete");
          },
          onError: (m) => {
            setLogs((l) => [...l, `ERROR: ${m}`]);
            setBusy(false);
            showToast("error", m);
          },
        }
      );
    } catch (e) {
      setBusy(false);
      showToast("error", (e as Error).message);
    }
  }, [canRun, studio, images, token, pipeline, preview, showToast]);

  useEffect(() => {
    if (token && tab === "feedback") {
      setFeedbackLoading(true);
      adminListFeedback(token)
        .then(setFeedback)
        .catch(() => setFeedback([]))
        .finally(() => setFeedbackLoading(false));
    }
  }, [token, tab]);

  useEffect(() => {
    if (token && tab === "dataset") {
      setDatasetLoading(true);
      adminDatasetStats(token, datasetDays)
        .then(setDatasetStats)
        .catch(() => setDatasetStats(null))
        .finally(() => setDatasetLoading(false));
    }
  }, [token, tab, datasetDays]);

  const onAddFeedback = useCallback(async () => {
    if (!token || !feedbackTitle.trim() || !feedbackContent.trim()) return;
    try {
      await adminCreateFeedback(
        token,
        feedbackTitle.trim(),
        feedbackContent.trim(),
        feedbackCategory
      );
      setFeedbackTitle("");
      setFeedbackContent("");
      adminListFeedback(token).then(setFeedback);
      showToast("success", "Feedback added");
    } catch (e) {
      showToast("error", (e as Error).message);
    }
  }, [token, feedbackTitle, feedbackContent, feedbackCategory, showToast]);

  const onResolveFeedback = useCallback(
    async (id: number, status: string) => {
      if (!token) return;
      try {
        await adminUpdateFeedback(token, id, { status });
        adminListFeedback(token).then(setFeedback);
        showToast("success", "Feedback updated");
      } catch (e) {
        showToast("error", (e as Error).message);
      }
    },
    [token, showToast]
  );

  const onDownloadDataset = useCallback(async () => {
    if (!token) return;
    try {
      const blob = await adminDownloadDataset(token, datasetDays);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `carveo-dataset-${datasetDays}d.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("success", "Dataset downloaded");
    } catch (e) {
      showToast("error", (e as Error).message);
    }
  }, [token, datasetDays, showToast]);

  const onSmokeTest = useCallback(async () => {
    if (!token) return;
    try {
      const info = await adminSmokeTest(token);
      setSmokeInfo(info);
    } catch (e) {
      setSmokeInfo({ message: (e as Error).message, scripts: [] });
    }
  }, [token]);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    showToast("success", "Copied to clipboard");
  }, [showToast]);

  const navItems: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "tests", label: "Tests", icon: <FlaskConical className="w-5 h-5" /> },
    { id: "feedback", label: "Feedback", icon: <MessageSquare className="w-5 h-5" /> },
    { id: "dataset", label: "Dataset", icon: <Database className="w-5 h-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white shrink-0 flex flex-col">
        <div className="p-6 border-b border-slate-700">
          <h1 className="text-lg font-bold tracking-tight">Carveo Admin</h1>
          <p className="text-xs text-slate-400 mt-0.5">Super Admin Panel</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                tab === item.id
                  ? "bg-sky-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {item.icon}
              <span className="font-medium">{item.label}</span>
              <ChevronRight className="w-4 h-4 ml-auto opacity-70" />
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-slate-700">
          {token ? (
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          ) : null}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8 max-w-6xl">
          {/* Auth card - shown when not logged in */}
          {!token && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 mb-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-slate-100">
                  <LogIn className="w-6 h-6 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Authentication</h2>
                  <p className="text-sm text-slate-500">
                    Sign in with a SUPERADMIN_EMAILS account to access the panel
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
                  <input
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    className="w-64 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                  />
                </div>
                <button
                  onClick={onLogin}
                  className="px-6 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 transition-colors flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Sign in
                </button>
              </div>
            </div>
          )}

          {token && (
            <>
              {/* Page header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-slate-900">
                  {tab === "tests" ? "Pipeline Tests" : tab === "feedback" ? "Feedback" : "Dataset"}
                </h2>
                <p className="text-slate-500 mt-1">
                  {tab === "tests" &&
                    "Run process-batch, manage feature flags, and view smoke test instructions"}
                  {tab === "feedback" && "Track issues, quality notes, and ideas for the team"}
                  {tab === "dataset" && "Export original + processed image pairs from daily processing"}
                </p>
              </div>

              {/* Tests tab */}
              {tab === "tests" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-lg bg-sky-100">
                        <Play className="w-5 h-5 text-sky-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Process Batch</h3>
                        <p className="text-sm text-slate-500">Run V11/V6/V7 with studio + car images</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Pipeline
                          </label>
                          <select
                            value={pipeline}
                            onChange={(e) => setPipeline(e.target.value as "11" | "6" | "7")}
                            className="px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                          >
                            <option value="11">V11 (OpenAI)</option>
                            <option value="6">V6 (Fal)</option>
                            <option value="7">V7 (Replicate)</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer mt-8">
                          <input
                            type="checkbox"
                            checked={preview}
                            onChange={(e) => setPreview(e.target.checked)}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                          />
                          <span className="text-sm font-medium text-slate-700">Preview mode</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Studio reference
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setStudio(e.target.files?.[0] || null)}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-medium file:cursor-pointer hover:file:bg-sky-100"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Car images
                        </label>
                        <input
                          multiple
                          type="file"
                          accept="image/*"
                          onChange={(e) => setImages(Array.from(e.target.files || []))}
                          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-sky-50 file:text-sky-700 file:font-medium file:cursor-pointer hover:file:bg-sky-100"
                        />
                        {images.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1">{images.length} file(s) selected</p>
                        )}
                      </div>
                      <button
                        disabled={!canRun || busy}
                        onClick={onRun}
                        className="w-full py-3 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                      >
                        {busy ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            Processing…
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run process-batch
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="p-2.5 rounded-lg bg-amber-100">
                        <Settings2 className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Feature Flags</h3>
                        <p className="text-sm text-slate-500">Toggle pipeline behavior</p>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {[
                        { k: "enforce_4_3", label: "Enforce 4:3 aspect ratio" },
                        { k: "center_on_turntable", label: "Center car on turntable" },
                        { k: "color_lock_strict", label: "Stricter color preservation" },
                      ].map(({ k, label }) => {
                        const v = (flags?.[k] ?? "true") as string;
                        const checked = (v ?? "true").toString().toLowerCase() !== "false";
                        return (
                          <label
                            key={k}
                            className="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
                          >
                            <span className="text-sm font-medium text-slate-700">{label}</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={async (e) => {
                                const val = e.target.checked ? "true" : "false";
                                try {
                                  await adminSetFlag(token, k, val);
                                  setFlags((f) => ({ ...f, [k]: val }));
                                  showToast("success", "Flag updated");
                                } catch {
                                  showToast("error", `Failed to set ${k}`);
                                }
                              }}
                              className="rounded border-slate-300 text-sky-600 focus:ring-sky-500 w-4 h-4"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-lg bg-emerald-100">
                        <FlaskConical className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Smoke Test</h3>
                        <p className="text-sm text-slate-500">CLI instructions for V11 smoke test</p>
                      </div>
                    </div>
                    <button
                      onClick={onSmokeTest}
                      className="mb-4 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Show instructions
                    </button>
                    {smokeInfo && (
                      <div className="relative">
                        <pre className="text-xs bg-slate-100 p-4 rounded-lg overflow-auto max-h-40 font-mono text-slate-700">
                          {smokeInfo.message}
                          {smokeInfo.scripts?.length
                            ? `\n\nScripts: ${smokeInfo.scripts.join(", ")}`
                            : ""}
                        </pre>
                        <button
                          onClick={() => copyToClipboard(smokeInfo.message)}
                          className="absolute top-2 right-2 p-1.5 rounded bg-white border border-slate-200 hover:bg-slate-50"
                        >
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="p-2.5 rounded-lg bg-violet-100">
                        <FileImage className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">Results</h3>
                        <p className="text-sm text-slate-500">
                          {results.length} image(s) processed
                        </p>
                      </div>
                    </div>
                    <div className="space-y-6">
                      {results.map((r) => (
                        <div
                          key={r.index}
                          className="grid grid-cols-2 gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50"
                        >
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Original</p>
                            {r.original_b64 && (
                              <img
                                src={r.original_b64}
                                alt=""
                                className="w-full rounded-lg border border-slate-200"
                              />
                            )}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-slate-500 mb-2">Processed</p>
                            {r.processed_b64 && (
                              <img
                                src={r.processed_b64}
                                alt=""
                                className="w-full rounded-lg border border-slate-200"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                      {results.length === 0 && (
                        <p className="text-sm text-slate-500 py-8 text-center">
                          Run a batch to see results
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback tab */}
              {tab === "feedback" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Add feedback</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Title
                        </label>
                        <input
                          value={feedbackTitle}
                          onChange={(e) => setFeedbackTitle(e.target.value)}
                          placeholder="e.g. Glow ring too strong on exterior"
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Content
                        </label>
                        <textarea
                          value={feedbackContent}
                          onChange={(e) => setFeedbackContent(e.target.value)}
                          placeholder="Describe the issue or idea..."
                          rows={4}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Category
                        </label>
                        <select
                          value={feedbackCategory}
                          onChange={(e) => setFeedbackCategory(e.target.value)}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                        >
                          <option value="quality">Quality</option>
                          <option value="bug">Bug</option>
                          <option value="feature">Feature</option>
                          <option value="dataset">Dataset</option>
                        </select>
                      </div>
                      <button
                        onClick={onAddFeedback}
                        disabled={!feedbackTitle.trim() || !feedbackContent.trim()}
                        className="px-6 py-2.5 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        Add feedback
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-900 mb-4">Feedback list</h3>
                    {feedbackLoading ? (
                      <p className="text-slate-500 py-8 text-center">Loading…</p>
                    ) : (
                      <div className="space-y-4">
                        {feedback.map((f) => (
                          <div
                            key={f.id}
                            className="p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
                          >
                            <div className="flex justify-between items-start gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-slate-900">{f.title}</span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      f.category === "bug"
                                        ? "bg-red-100 text-red-700"
                                        : f.category === "feature"
                                        ? "bg-blue-100 text-blue-700"
                                        : f.category === "dataset"
                                        ? "bg-violet-100 text-violet-700"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {f.category || "—"}
                                  </span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      f.status === "resolved"
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-amber-100 text-amber-700"
                                    }`}
                                  >
                                    {f.status}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 mt-2">{f.content}</p>
                                <p className="text-xs text-slate-400 mt-2">
                                  {f.created_by} · {f.created_at}
                                </p>
                              </div>
                              {f.status === "open" && (
                                <button
                                  onClick={() => onResolveFeedback(f.id, "resolved")}
                                  className="shrink-0 px-3 py-1.5 text-sm font-medium text-sky-600 hover:bg-sky-50 rounded-lg transition-colors flex items-center gap-1"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  Resolve
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                        {feedback.length === 0 && (
                          <p className="text-slate-500 py-8 text-center">No feedback yet</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Dataset tab */}
              {tab === "dataset" && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-2xl">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-lg bg-violet-100">
                      <Database className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">Dataset export</h3>
                      <p className="text-sm text-slate-500">
                        Original + processed pairs from JobImages (daily processing)
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Last N days
                        </label>
                        <input
                          type="number"
                          value={datasetDays}
                          onChange={(e) => setDatasetDays(Number(e.target.value) || 7)}
                          min={1}
                          max={90}
                          className="w-24 px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none"
                        />
                      </div>
                      <button
                        onClick={() =>
                          adminDatasetStats(token, datasetDays)
                            .then(setDatasetStats)
                            .catch(() => setDatasetStats(null))
                        }
                        className="mt-6 px-4 py-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 font-medium text-slate-700 transition-colors flex items-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                      </button>
                    </div>
                    {datasetLoading ? (
                      <p className="text-slate-500">Loading stats…</p>
                    ) : datasetStats ? (
                      <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-slate-900">
                            {datasetStats.count}
                          </span>
                          <span className="text-slate-600">
                            completed in last {datasetStats.last_n_days} days
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">
                          {datasetStats.total_completed} total in database
                        </p>
                      </div>
                    ) : null}
                    <button
                      onClick={onDownloadDataset}
                      className="w-full py-3 rounded-lg bg-sky-600 text-white font-medium hover:bg-sky-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      Download JSON manifest
                    </button>
                    <p className="text-xs text-slate-500">
                      Manifest: id, project_id, image_index, original_url, processed_url,
                      metadata, created_at
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 ${
            toast.type === "success"
              ? "bg-emerald-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="font-medium">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
