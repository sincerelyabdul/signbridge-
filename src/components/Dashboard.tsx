import React, { useState } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { Mic, Settings, LogOut, BookOpen, Trash2, Calendar, Clock, ShieldAlert } from "lucide-react";

export const Dashboard: React.FC = () => {
  const {
    user,
    profile,
    sessions,
    startSession,
    selectHistorySession,
    deleteSession,
    logout
  } = useSignBridge();

  const navigate = useNavigate();
  const [lectureTitle, setLectureTitle] = useState("");

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = lectureTitle.trim() || profile.defaultTitle || "Science Lecture";
    const id = await startSession(title);
    if (id) {
      navigate(`/lecturer/${id}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleSelectSession = (session: any) => {
    selectHistorySession(session);
    if (session.isActive) {
      navigate(`/lecturer/${session.id}`);
    } else {
      navigate(`/review/${session.id}`);
    }
  };

  const isDemoUser = user?.id === "mock_user_id";

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">

      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center bg-[var(--surface)] sticky top-0 z-30">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <span className="font-bold text-xl sm:text-2xl tracking-tight select-none shrink-0">
            sign<span className="text-[var(--primary)]">bridge</span><span className="text-[var(--primary)] font-black text-2xl sm:text-3xl">.</span>
          </span>
          <span className="h-4 w-px bg-[var(--border)] hidden sm:block shrink-0"></span>
          <span className="text-[10px] px-2 py-0.5 border border-[var(--border)] text-[var(--text-muted)] rounded font-mono uppercase hidden sm:block shrink-0">
            Lecturer Hub
          </span>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-right hidden md:block">
            <span className="text-xs font-semibold block text-[var(--text)]">{profile.fullName}</span>
            <span className="text-[9px] text-[var(--text-muted)] block font-mono">{profile.institution}</span>
          </div>

          <div className="h-6 w-px bg-[var(--border)] hidden md:block"></div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/settings")}
              className="h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
              title="Settings & Vocabulary"
            >
              <Settings size={15} />
            </button>
            <button
              onClick={handleLogout}
              className="h-9 w-9 flex items-center justify-center border border-[var(--border)] rounded-lg hover:bg-red-500 hover:text-white hover:border-red-500 text-[var(--text-muted)] transition-colors cursor-pointer"
              title="Log Out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8 items-start">

        {/* Left column (1/3): Start a Lecture */}
        <div className="space-y-5">

          {/* Demo Alert if bypassed */}
          {isDemoUser && (
            <div className="border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 rounded-xl p-4 text-xs leading-relaxed flex gap-2.5 items-start text-left">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <strong className="block mb-0.5">Demo Bypass Active</strong>
                <span>Database connections and logins are running in local-only mock mode. Changes will reset on reload.</span>
              </div>
            </div>
          )}

          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-[var(--text)] flex items-center gap-2">
              <Mic size={18} className="text-[var(--primary)]" />
              Launch Classroom
            </h2>
            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Name your lecture to start. Students can join the live feed instantly using the session code.
            </p>

            <form onSubmit={handleStart} className="space-y-3 pt-1">
              <div className="space-y-1">
                <label className="text-[9px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Lecture Topic</label>
                <input
                  type="text"
                  placeholder={profile.defaultTitle || "e.g. Organic Chemistry"}
                  value={lectureTitle}
                  onChange={(e) => setLectureTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                />
              </div>

              <button
                type="submit"
                className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Mic size={15} /> Start Live Session
              </button>
            </form>
          </div>
        </div>

        {/* Right columns (2/3): Session History */}
        <div className="md:col-span-2">
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left flex flex-col min-h-[350px] md:min-h-[400px]">
            <div className="border-b border-[var(--border)] pb-3 mb-4 flex justify-between items-center">
              <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
                <BookOpen size={14} /> Lecture History ({sessions.length})
              </h2>
            </div>

            {sessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] py-12">
                <Clock size={32} className="stroke-1 mb-2 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold">No lectures recorded yet</p>
                <p className="text-[10px] mt-1 text-center">Your live-transcribed lectures and summaries will populate here.</p>
              </div>
            ) : (
              <div className="space-y-2.5 overflow-y-auto max-h-[55vh] pr-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={`flex justify-between items-center p-3.5 border rounded-lg hover:bg-[var(--background)] transition-all group ${
                      session.isActive
                        ? "border-[var(--primary)] bg-[var(--primary)]/5"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    <button
                      onClick={() => handleSelectSession(session)}
                      className="flex-1 text-left cursor-pointer min-w-0 pr-2"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[var(--text)] group-hover:text-[var(--primary)] transition-colors truncate">
                          {session.title}
                        </h4>
                        <span className="text-[10px] font-mono border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-muted)] shrink-0">
                          {session.code}
                        </span>
                        {session.isActive && (
                          <span className="text-[9px] font-mono font-bold bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-ping" />
                            LIVE • RESUME CLASS
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[var(--text-muted)] font-mono flex-wrap">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> {session.date}
                        </span>
                        <span className="hidden sm:inline">•</span>
                        <span className="hidden sm:inline">{session.conceptCards.length} concept cards generated</span>
                      </div>
                    </button>

                    <button
                      onClick={() => deleteSession(session.id)}
                      className="p-2 h-9 w-9 flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      aria-label="Delete saved session"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
