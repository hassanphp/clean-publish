"use client"
import { useCallback, useMemo, useRef, useState } from "react"
import { login, processBatch, type ProcessedResult } from "@/lib/api"

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export default function AdminHome() {
  const [email, setEmail] = useState("dealer@domain.com")
  const [password, setPassword] = useState("Admin@321")
  const [token, setToken] = useState<string>("")
  const [pipeline, setPipeline] = useState<"11" | "6" | "7">("11")
  const [preview, setPreview] = useState(true)
  const [studio, setStudio] = useState<File | null>(null)
  const [images, setImages] = useState<File[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [results, setResults] = useState<ProcessedResult[]>([])
  const [busy, setBusy] = useState(false)

  const onLogin = useCallback(async () => {
    const t = await login(email, password)
    setToken(t)
  }, [email, password])

  const canRun = useMemo(() => !!token && !!studio && images.length > 0, [token, studio, images])

  const onRun = useCallback(async () => {
    if (!canRun || !studio) return
    setBusy(true); setLogs([]); setResults([])
    const studioB64 = await readAsDataURL(studio)
    const imgs = await Promise.all(images.map(readAsDataURL))
    await processBatch(
      { images: imgs, studio_reference_data_uri: studioB64, pipeline_version: pipeline, preview },
      token,
      {
        onLog: (m) => setLogs((l) => [...l, m]),
        onResult: (r) => setResults((rs) => [...rs, r]),
        onComplete: () => setBusy(false),
        onError: (m) => setLogs((l) => [...l, `ERROR: ${m}`]),
      }
    )
  }, [canRun, studio, images, token, pipeline, preview])

  return (
    <main>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Admin Panel – Test Runner (MVP)</h1>
      <p style={{ opacity: 0.8, marginBottom: 16 }}>Authenticate to the backend, select studio + images, and stream results.</p>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Auth</h2>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
            <button onClick={onLogin} disabled={!!token} style={{ padding: '8px 12px' }}>{token ? 'Logged in' : 'Login'}</button>
          </div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>Config</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
            <label>Pipeline:&nbsp;
              <select value={pipeline} onChange={(e) => setPipeline(e.target.value as any)}>
                <option value="11">V11</option>
                <option value="6">V6</option>
                <option value="7">V7</option>
              </select>
            </label>
            <label>Preview:&nbsp;<input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /></label>
          </div>
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            <label>Studio reference (image): <input type="file" accept="image/*" onChange={(e) => setStudio(e.target.files?.[0] || null)} /></label>
            <label>Car images (1..N): <input multiple type="file" accept="image/*" onChange={(e) => setImages(Array.from(e.target.files || []))} /></label>
          </div>
          <div style={{ marginTop: 8 }}>
            <button disabled={!canRun || busy} onClick={onRun} style={{ padding: '8px 12px' }}>{busy ? 'Running…' : 'Run'}</button>
          </div>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, minHeight: 200 }}>
          <h3 style={{ marginTop: 0 }}>Logs</h3>
          <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12 }}>
            {logs.map((l, i) => (<div key={i}>{l}</div>))}
          </div>
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>Results</h3>
          <div style={{ display: 'grid', gap: 12 }}>
            {results.map((r) => (
              <div key={r.index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, alignItems: 'start' }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Original</div>
                  {r.original_b64 && <img src={r.original_b64} style={{ maxWidth: '100%', borderRadius: 6 }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Processed</div>
                  {r.processed_b64 && <img src={r.processed_b64} style={{ maxWidth: '100%', borderRadius: 6 }} />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
