import React, { useState } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faKey,
  faEnvelope,
  faUser,
  faShieldHalved,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";


export const AuthPage: React.FC = () => {
  const { login, signup } = useSignBridge();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);

  // Inputs
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  // States
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (isSignUp) {
        if (!name.trim()) {
          setError("Name is required");
          setLoading(false);
          return;
        }
        const res = await signup(email, password, name);
        if (res.success) {
          navigate("/dashboard");
        } else {
          setError(res.error || "Failed to sign up");
        }
      } else {
        const res = await login(email, password);
        if (res.success) {
          navigate("/dashboard");
        } else {
          setError(res.error || "Failed to log in");
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">

      {/* Top bar */}
      <Navbar variant="auth" onBack={() => navigate("/")} />


      {/* Centered card */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
        <div className="max-w-md w-full border border-[var(--border)] rounded-xl bg-[var(--surface)] p-6 sm:p-8 text-left space-y-6">

          {/* Title */}
          <div className="space-y-1.5 text-center">
            <span className="font-bold text-3xl tracking-tight select-none">
              sign<span className="text-[var(--primary)]">bridge</span><span className="text-[var(--primary)] font-black text-4xl">.</span>
            </span>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {isSignUp ? "Create a lecturer account" : "Log in to your lecturer account"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Full Name</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Albus Dumbledore"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                  />
                  <FontAwesomeIcon icon={faUser} className="absolute left-3 top-3.5 text-xs text-[var(--text-muted)]" />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Email Address</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="teacher@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                />
                <FontAwesomeIcon icon={faEnvelope} className="absolute left-3 top-3.5 text-xs text-[var(--text-muted)]" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Password</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                />
                <FontAwesomeIcon icon={faKey} className="absolute left-3 top-3.5 text-xs text-[var(--text-muted)]" />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs leading-relaxed flex gap-2 items-start">
                <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 shrink-0 text-xs" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <><FontAwesomeIcon icon={faSpinner} spin className="text-xs" /> Processing...</>
              ) : (
                isSignUp ? "Create Lecturer Account" : "Sign In"
              )}
            </button>
          </form>

          {/* Toggle link */}
          <div className="text-center pt-1">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
              className="text-xs text-[var(--primary)] hover:underline cursor-pointer"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
