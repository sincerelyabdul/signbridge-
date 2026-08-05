import React, { useState } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faArrowRight,
  faBookOpen,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";

type ActivePanel = "student" | "lecturer";

export const LandingPage: React.FC = () => {
  const {
    startSession,
    joinSession,
    sessions,
    selectHistorySession,
    deleteSession,
    user,
  } = useSignBridge();


  const navigate = useNavigate();

  const [activePanel, setActivePanel] = useState<ActivePanel>("student");
  const [panelKey, setPanelKey] = useState(0);
  const [studentCode, setStudentCode] = useState("");
  const [lectureTitle, setLectureTitle] = useState("");
  const [error, setError] = useState("");

  const switchPanel = (panel: ActivePanel) => {
    if (panel === activePanel) return;
    setError("");
    setActivePanel(panel);
    setPanelKey((k) => k + 1);
  };

  const scrollToForms = (panel: ActivePanel) => {
    switchPanel(panel);
    document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" });
  };

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
      const title =
        lectureTitle.trim() ||
        "Lecture " + new Date().toLocaleDateString();
      const id = await startSession(title);
      if (id) navigate(`/lecturer/${id}`);
    }
  };

  const handleSelectHistory = (session: any) => {
    selectHistorySession(session);
    navigate(`/review/${session.id}`);
  };

  const steps = [
    {
      n: "01",
      who: "Lecturer",
      title: "Start a session",
      desc: "Sign in, give your lecture a topic, and get a 6-digit code in seconds.",
    },
    {
      n: "02",
      who: "Students",
      title: "Join with the code",
      desc: "Students open SignBridge in any browser and enter the code — no account, no download.",
    },
    {
      n: "03",
      who: "Everyone",
      title: "Follow along live",
      desc: "Live captions appear as you speak. AI cards explain key terms. Notes are saved automatically.",
    },
  ];

  const outcomes = [
    {
      title: "Captions that keep up",
      desc: "Words appear on screen as fast as they're spoken — no lag, no missed sentences.",
    },
    {
      title: "Hard words, made simple",
      desc: "When a complex term comes up, an explanation card appears automatically. No disruption.",
    },
    {
      title: "Study notes, done for you",
      desc: "At the end of each session, students get a clean summary they can save and review later.",
    },
  ];

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">

      {/* ── Header ── */}
      <Navbar variant="landing" />


      <main className="flex-1 w-full">

        {/* ── Hero ── */}
        <section className="max-w-[620px] mx-auto px-5 sm:px-6 pt-14 pb-12 sm:pt-20 sm:pb-16">
          {/* Trust badge */}
          <p className="text-[11px] text-[var(--text-muted)] mb-5 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            Free to use · No download · Works in any browser
          </p>

          <h1 className="text-[30px] sm:text-[38px] font-bold tracking-tight leading-[1.15] text-[var(--text)] mb-4">
            Never miss what's being<br />said in class.
          </h1>

          <p className="text-[14px] sm:text-[15px] text-[var(--text-muted)] leading-relaxed mb-8 max-w-[480px]">
            SignBridge turns any classroom lecture into live captions and smart
            study notes — right in your browser, the moment the lecturer
            starts speaking.
          </p>

          {/* Hero CTAs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => scrollToForms("student")}
              className="h-10 px-5 bg-[var(--text)] text-[var(--background)] text-[13px] font-semibold rounded-[6px] flex items-center justify-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
            >
              Join a Lecture <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
            </button>
            <button
              onClick={() => scrollToForms("lecturer")}
              className="h-10 px-5 border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] text-[13px] font-semibold rounded-[6px] flex items-center justify-center gap-2 hover:bg-[var(--background)] transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faMicrophone} className="text-xs" />
              Start a Lecture
            </button>
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="border-t border-[var(--border)]" />

        {/* ── How it works ── */}
        <section className="max-w-[620px] mx-auto px-5 sm:px-6 py-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-8">
            How it works
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {steps.map((step) => (
              <div key={step.n} className="space-y-2">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[28px] font-bold text-[var(--border)] leading-none select-none">
                    {step.n}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                    {step.who}
                  </span>
                </div>
                <p className="text-[13px] font-semibold text-[var(--text)]">{step.title}</p>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="border-t border-[var(--border)]" />

        {/* ── What you get ── */}
        <section className="max-w-[620px] mx-auto px-5 sm:px-6 py-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-8">
            What you get
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {outcomes.map((o) => (
              <div key={o.title} className="space-y-1.5">
                <p className="text-[13px] font-semibold text-[var(--text)]">{o.title}</p>
                <p className="text-[12px] text-[var(--text-muted)] leading-relaxed">{o.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="border-t border-[var(--border)]" />

        {/* ── Get started (forms) ── */}
        <section id="get-started" className="max-w-[620px] mx-auto px-5 sm:px-6 py-12">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-muted)] mb-6">
            Get started
          </p>

          {/* Tab switcher */}
          <div className="space-y-0">
            <div className="flex border border-[var(--border)] rounded-t-[8px] overflow-hidden">
              <button
                onClick={() => switchPanel("student")}
                className={`flex-1 h-10 text-[13px] font-semibold transition-colors cursor-pointer border-r border-[var(--border)] ${
                  activePanel === "student"
                    ? "bg-[var(--text)] text-[var(--background)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--background)]"
                }`}
              >
                I'm a Student
              </button>
              <button
                onClick={() => switchPanel("lecturer")}
                className={`flex-1 h-10 text-[13px] font-semibold transition-colors cursor-pointer ${
                  activePanel === "lecturer"
                    ? "bg-[var(--primary)] text-black"
                    : "bg-[var(--surface)] text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--background)]"
                }`}
              >
                I'm a Lecturer
              </button>
            </div>

            <div
              key={panelKey}
              className="animate-panel-fade border border-t-0 border-[var(--border)] rounded-b-[8px] bg-[var(--surface)] p-5 sm:p-6"
            >
              {activePanel === "student" ? (
                <form onSubmit={handleJoin} className="space-y-3">
                  <p className="text-[12px] text-[var(--text-muted)]">
                    Your lecturer will share a 6-digit code — enter it below.
                  </p>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="_ _ _ _ _ _"
                    maxLength={6}
                    value={studentCode}
                    onChange={(e) =>
                      setStudentCode(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    className="w-full px-3 py-3 border border-[var(--border)] rounded-[6px] bg-[var(--background)] text-[var(--text)] font-mono text-center tracking-[0.3em] text-[18px] focus:outline-none focus:border-[var(--primary)] transition-colors"
                  />
                  {error && (
                    <p className="text-red-500 text-[11px] font-medium">{error}</p>
                  )}
                  <button
                    type="submit"
                    className="w-full h-10 bg-[var(--text)] hover:opacity-80 text-[var(--background)] text-[13px] font-semibold rounded-[6px] flex items-center justify-center gap-2 transition-opacity cursor-pointer"
                  >
                    Join Classroom <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleStartClick} className="space-y-3">
                  <p className="text-[12px] text-[var(--text-muted)]">
                    {user
                      ? "Give your session a topic — we'll generate a code your students can use."
                      : "Create a free account to start sessions and share captions with your students."}
                  </p>
                  {user && (
                    <input
                      type="text"
                      placeholder="e.g. Cellular Respiration"
                      value={lectureTitle}
                      onChange={(e) => setLectureTitle(e.target.value)}
                      className="w-full px-3 py-3 border border-[var(--border)] rounded-[6px] bg-[var(--background)] text-[var(--text)] text-[14px] focus:outline-none focus:border-[var(--primary)] transition-colors"
                    />
                  )}
                  <button
                    type="submit"
                    className="w-full h-10 bg-[var(--primary)] hover:opacity-90 text-black text-[13px] font-semibold rounded-[6px] flex items-center justify-center gap-2 transition-opacity cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faMicrophone} className="text-xs" />
                    {user ? "Start Session" : "Create Free Account"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* History */}
          {sessions.length > 0 && !user && (
            <div className="border-t border-[var(--border)] pt-6 mt-6 space-y-3">
              <p className="text-[11px] font-semibold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-1.5">
                <FontAwesomeIcon icon={faBookOpen} className="text-[12px]" />
                Saved Lectures ({sessions.length})
              </p>
              <div className="space-y-1 max-h-52 overflow-y-auto">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex justify-between items-center px-3 py-2.5 border border-[var(--border)] rounded-[6px] hover:bg-[var(--background)] transition-colors"
                  >
                    <button
                      onClick={() => handleSelectHistory(session)}
                      className="flex-1 text-left cursor-pointer min-w-0"
                    >
                      <p className="font-medium text-[13px] text-[var(--text)] truncate">
                        {session.title}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                        {session.date} · {session.code}
                      </p>
                    </button>
                    <button
                      onClick={() => deleteSession(session.id)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-red-500 rounded-[4px] transition-colors cursor-pointer shrink-0 ml-2"
                      aria-label="Delete lecture"
                    >
                      <FontAwesomeIcon icon={faTrashCan} className="text-[13px]" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Footer trust strip ── */}
        <div className="border-t border-[var(--border)]">
          <div className="max-w-[620px] mx-auto px-5 sm:px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <span className="text-[11px] font-bold tracking-tight text-[var(--text-muted)] select-none">
              sign<span className="text-[var(--primary)]">bridge</span>
              <span className="text-[var(--primary)]">.</span>
            </span>
            <p className="text-[11px] text-[var(--text-muted)]">
              Free · No account needed for students · Works without internet
            </p>
          </div>
        </div>

      </main>
    </div>
  );
};
