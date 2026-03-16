"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Mail, Lock, User, Car, CheckCircle, ArrowRight, Zap, Eye, EyeOff } from "lucide-react";
import { loginAction, registerAction } from "@/app/actions/auth";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: "login" | "register";
  title?: string;
  description?: string;
}

type Tab = "login" | "register";
type LoginMode = "password" | "magic";

const inputCls = `w-full px-4 py-3 bg-black border border-white/10 rounded-xl text-white placeholder-gray-500
  focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all`;

const Field: React.FC<{
  icon: React.ReactNode;
  type?: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  min?: number;
  max?: number;
  rightEl?: React.ReactNode;
}> = ({ icon, type = "text", placeholder, value, onChange, required, min, max, rightEl }) => (
  <div className="relative">
    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">{icon}</div>
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      required={required}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} pl-11 ${rightEl ? "pr-11" : ""}`}
    />
    {rightEl && <div className="absolute right-4 top-1/2 -translate-y-1/2">{rightEl}</div>}
  </div>
);

const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultTab = "login",
  title = "Save Your Work",
  description = "Create a free account to download your high-quality studio photos.",
}) => {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [loginMode, setLoginMode] = useState<LoginMode>("password");

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [username, setUsername] = useState("");
  const [inventory, setInventory] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  const reset = () => {
    setError(null);
    setDone(null);
    setEmail("");
    setPassword("");
    setConfirmPw("");
    setUsername("");
    setInventory("");
    setLoading(false);
  };

  const switchTab = (t: Tab) => {
    reset();
    setTab(t);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (loginMode === "magic") {
        setError("Magic link is not available. Please use password sign in.");
        setLoading(false);
        return;
      }
      const result = await loginAction(email, password);
      if (!result.ok) throw new Error(result.error);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirmPw) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!username.trim()) {
      setError("Please enter a username.");
      return;
    }
    setLoading(true);
    try {
      const result = await registerAction(email, password, username.trim());
      if (!result.ok) throw new Error(result.error);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[-1]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent" />

              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {done ? (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-5 text-green-400">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-3">You&apos;re all set</h2>
                  <p className="text-gray-400 text-sm leading-relaxed mb-6">{done}</p>
                  <button
                    onClick={onClose}
                    className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-bold rounded-xl transition-colors border border-white/10"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex border-b border-white/8">
                    {(["login", "register"] as Tab[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => switchTab(t)}
                        className={`flex-1 py-4 text-sm font-bold tracking-wide uppercase transition-colors ${tab === t ? "text-white border-b-2 border-blue-500 -mb-px" : "text-gray-500 hover:text-gray-300"}`}
                      >
                        {t === "login" ? "Sign In" : "Create Account"}
                      </button>
                    ))}
                  </div>

                  <div className="p-6 md:p-8">
                    {tab === "login" && (
                      <>
                        <div className="flex items-center gap-2 p-1 bg-white/5 rounded-xl mb-6">
                          {(["password", "magic"] as LoginMode[]).map((m) => (
                            <button
                              key={m}
                              onClick={() => {
                                setLoginMode(m);
                                setError(null);
                              }}
                              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${loginMode === m ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "text-gray-400 hover:text-gray-200"}`}
                            >
                              {m === "password" ? (
                                <>
                                  <Lock className="w-3.5 h-3.5" /> Password
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5" /> Magic Link
                                </>
                              )}
                            </button>
                          ))}
                        </div>

                        <form onSubmit={handleLogin} className="space-y-4">
                          <Field
                            icon={<Mail className="w-4 h-4" />}
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={setEmail}
                            required
                          />

                          {loginMode === "password" && (
                            <Field
                              icon={<Lock className="w-4 h-4" />}
                              type={showPw ? "text" : "password"}
                              placeholder="Password"
                              value={password}
                              onChange={setPassword}
                              required
                              rightEl={
                                <button
                                  type="button"
                                  onClick={() => setShowPw((p) => !p)}
                                  className="text-gray-500 hover:text-white transition-colors"
                                >
                                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                              }
                            />
                          )}

                          {loginMode === "magic" && (
                            <p className="text-xs text-gray-500 -mt-1">
                              Magic link is not available. Please use password sign in.
                            </p>
                          )}

                          {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                              {error}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {loading ? (
                              "Please wait…"
                            ) : loginMode === "password" ? (
                              <>
                                <span>Sign In</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            ) : (
                              <>
                                <Zap className="w-4 h-4" />
                                <span>Send Magic Link</span>
                              </>
                            )}
                          </button>
                        </form>

                        <p className="mt-5 text-center text-xs text-gray-500">
                          No account?{" "}
                          <button
                            onClick={() => switchTab("register")}
                            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                          >
                            Create one
                          </button>
                        </p>
                      </>
                    )}

                    {tab === "register" && (
                      <>
                        <p className="text-gray-400 text-sm mb-5">
                          Set up your dealership account in seconds.
                        </p>
                        <form onSubmit={handleRegister} className="space-y-4">
                          <Field
                            icon={<User className="w-4 h-4" />}
                            placeholder="Username / Dealership name"
                            value={username}
                            onChange={setUsername}
                            required
                          />
                          <Field
                            icon={<Mail className="w-4 h-4" />}
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={setEmail}
                            required
                          />
                          <Field
                            icon={<Lock className="w-4 h-4" />}
                            type={showPw ? "text" : "password"}
                            placeholder="Password (min 8 characters)"
                            value={password}
                            onChange={setPassword}
                            required
                            rightEl={
                              <button
                                type="button"
                                onClick={() => setShowPw((p) => !p)}
                                className="text-gray-500 hover:text-white transition-colors"
                              >
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            }
                          />
                          <Field
                            icon={<Lock className="w-4 h-4" />}
                            type={showConfirm ? "text" : "password"}
                            placeholder="Confirm password"
                            value={confirmPw}
                            onChange={setConfirmPw}
                            required
                            rightEl={
                              <button
                                type="button"
                                onClick={() => setShowConfirm((p) => !p)}
                                className="text-gray-500 hover:text-white transition-colors"
                              >
                                {showConfirm ? (
                                  <EyeOff className="w-4 h-4" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                            }
                          />

                          <div>
                            <label className="block text-xs text-gray-500 font-semibold uppercase tracking-wider mb-2">
                              <Car className="w-3.5 h-3.5 inline mr-1.5" /> Car inventory size
                            </label>
                            <div className="flex flex-wrap gap-2">
                              {[
                                ["0–30", "15"],
                                ["31–60", "45"],
                                ["61–100", "80"],
                                ["101–250", "175"],
                                ["251+", "300"],
                              ].map(([label, val]) => (
                                <button
                                  key={val}
                                  type="button"
                                  onClick={() => setInventory(val)}
                                  className={`px-4 py-2 rounded-full text-xs font-bold border transition-all ${inventory === val ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20" : "bg-white/5 text-gray-400 border-white/10 hover:border-white/25"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                              {error}
                            </div>
                          )}

                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {loading ? (
                              "Creating account…"
                            ) : (
                              <>
                                <span>Create Account</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </form>

                        <p className="mt-5 text-center text-xs text-gray-500">
                          Already have an account?{" "}
                          <button
                            onClick={() => switchTab("login")}
                            className="text-blue-400 hover:text-blue-300 font-semibold transition-colors"
                          >
                            Sign in
                          </button>
                        </p>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AuthModal;
