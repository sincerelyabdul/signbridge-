import React, { useState } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { Mic, ArrowRight, Moon, Sun, BookOpen, Trash2, LogIn, LayoutGrid } from "lucide-react";

export const LandingPage: React.FC = () => {
  const {
    startSession,
    joinSession,
    sessions,
    selectHistorySession,
    deleteSession,
    theme,
    toggleTheme,
    user
  } = useSignBridge();

  const navigate = useNavigate();

  const [studentCode, setStudentCode] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [error, setError] = useState("");

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!studentCode.trim()) {
      setError("Please enter a session code");
      return;
    }
    const cleanCode = studentCode.replace(/\s+/g, "");
    const res = await joinSession(cleanCode);
    if (res.success) {
      if (res.isActive) {
        navigate(`/student/${cleanCode}`);
      } else {
        navigate(`/review/${res.sessionId}`);
      }
    } else {
      setError(res.error || "Invalid session code. Try a 6-digit code.");
    }
  };

  const handleStartClick = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate("/auth");
    } else {
      const title = lectureTitle.trim() || "Biology Lecture " + new Date().toLocaleDateString();
      const id = await startSession(title);
      if (id) {
        navigate(`/lecturer/${id}`);
      }
    }
  };

  const handleSelectHistory = (session: any) => {
    selectHistorySession(session);
    navigate(`/review/${session.id}`);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-[var(--surface)] sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="font-bold text-xl sm:text-2xl tracking-tight select-none">
            sign<span className="text-[var(--primary)]">bridge</span><span className="text-[var(--primary)] font-black text-2xl sm:text-3xl">.</span>
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {user ? (
            <button
              onClick={() => navigate("/dashboard")}
              className="h-10 px-3 border border-[var(--border)] rounded-lg hover:bg-[var(--background)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">Lecturer Dashboard</span>
            </button>
          ) : (
            <button
              onClick={() => navigate("/auth")}
              className="h-10 px-3 border border-[var(--border)] rounded-lg hover:bg-[var(--background)] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogIn size={14} />
              <span className="hidden sm:inline">Lecturer Sign In</span>
            </button>
          )}

          <button
            onClick={toggleTheme}
            className="h-10 w-10 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
            aria-label="Toggle Theme"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
        {/* Left Side: Pitch and Details */}
        <div className="space-y-6 sm:space-y-8">
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-[var(--text)] leading-tight text-left">
              Real-time educational accessibility, designed for inclusion.
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-muted)] text-left leading-relaxed">
              SignBridge AI converts classroom lectures into accessible digital experiences.
              DHH students receive live captions and real-time visual cue cards to simplify
              terminology, operating online or offline.
            </p>
          </div>

          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 space-y-5">
            <h3 className="font-semibold text-xs tracking-wider uppercase text-[var(--text-muted)] text-left">
              Core Capabilities
            </h3>
            <ul className="space-y-4 text-left">
              {[
                {
                  title: "Live Captions",
                  desc: "Ultra-low latency speech transcription directly in the web browser."
                },
                {
                  title: "Context-Aware AI Cards",
                  desc: "Concept explanations and visual cue cards appear automatically as the lecturer speaks."
                },
                {
                  title: "Smart Lecture Summaries",
                  desc: "Instantly generates structured markdown summaries at the end of class for revisions."
                }
              ].map((item) => (
                <li key={item.title} className="flex gap-3 items-start text-sm">
                  <div className="w-5 h-5 mt-0.5 rounded-full flex items-center justify-center border border-[var(--border)] text-[var(--primary)] shrink-0 text-xs">
                    ✓
                  </div>
                  <div>
                    <strong className="text-[var(--text)] block">{item.title}</strong>
                    <span className="text-[var(--text-muted)] text-xs">{item.desc}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Right Side: Action Forms */}
        <div className="space-y-5">
          {/* Student Panel */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left">
            <h2 className="text-lg sm:text-xl font-semibold mb-1.5">Join a Lecture</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Enter the 6-digit session code provided by your instructor to view live captions.
            </p>
            <form onSubmit={handleJoin} className="space-y-3">
              <input
                type="text"
                inputMode="numeric"
                placeholder="e.g. 123456"
                maxLength={6}
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-full px-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] font-mono text-center tracking-widest text-lg focus:outline-none focus:border-[var(--primary)] transition-colors"
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                type="submit"
                className="w-full h-11 bg-[var(--text)] hover:bg-[var(--text-muted)] text-[var(--background)] font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                Join Classroom <ArrowRight size={16} />
              </button>
            </form>
          </div>

          {/* Lecturer Panel */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left">
            <h2 className="text-lg sm:text-xl font-semibold mb-1.5">Start a Lecture</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4">
              Create a new session. We'll automatically generate a code for your students to join.
            </p>
            <form onSubmit={handleStartClick} className="space-y-3">
              <input
                type="text"
                placeholder="Lecture Topic (e.g. Cellular Respiration)"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                className="w-full px-3 py-3 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
              />
              <button
                type="submit"
                className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Mic size={16} /> {user ? "Start Session" : "Log In to Start"}
              </button>
            </form>
          </div>

          {/* History Panel */}
          {sessions.length > 0 && !user && (
            <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left">
              <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] mb-3 flex items-center gap-2">
                <BookOpen size={14} /> Saved Lectures ({sessions.length})
              </h2>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex justify-between items-center p-3 border border-[var(--border)] rounded-lg hover:bg-[var(--background)] transition-colors group"
                  >
                    <button
                      onClick={() => handleSelectHistory(session)}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <h4 className="font-medium text-sm text-[var(--text)] truncate">{session.title}</h4>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{session.date} • Code: {session.code}</p>
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                      aria-label="Delete lecture"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
