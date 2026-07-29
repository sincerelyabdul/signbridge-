import React, { useState } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faBookOpen,
  faTrashCan,
  faClock,
  faShieldHalved,
  faArrowRight,
  faArrowLeft,
  faPlus,
  faXmark,
  faRadio,
  faChevronRight,
  faFileLines,
  faWandMagicSparkles,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";
import type { CustomTerm } from "../context/SignBridgeContext";
import { parseLecturePrimer } from "../services/geminiService";

export const Dashboard: React.FC = () => {
  const {
    user,
    profile,
    sessions,
    startSession,
    selectHistorySession,
    deleteSession,
  } = useSignBridge();

  const navigate = useNavigate();

  // Setup Wizard State: 1 | 2 | 3
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [lectureTitle, setLectureTitle] = useState("");
  const [lecturePrimerText, setLecturePrimerText] = useState("");
  const [keytermsList, setKeytermsList] = useState<CustomTerm[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Preset topic pills
  const presets = [
    "Introduction to Metabolism",
    "Cellular Biology & ATP",
    "Organic Chemistry",
    "Human Anatomy",
    "Computer Systems & Architecture",
  ];

  // Step 1 -> Step 2
  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle.trim()) {
      setLectureTitle(profile.defaultTitle || "General Lecture");
    }
    setCurrentStep(2);
  };

  // Add custom keyterm manually
  const handleAddKeyterm = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newKeyword.trim();
    if (!clean) return;

    if (!keytermsList.some((k) => k.keyword.toLowerCase() === clean.toLowerCase())) {
      setKeytermsList((prev) => [
        ...prev,
        {
          keyword: clean,
          definition: newDefinition.trim() || "Course terminology.",
          details: "Added during setup.",
        },
      ]);
    }
    setNewKeyword("");
    setNewDefinition("");
  };

  // Extract keyterms from primer text using Gemini AI
  const handleExtractFromPrimer = async () => {
    if (!lecturePrimerText.trim() || isExtracting) return;
    setIsExtracting(true);
    try {
      const res = await parseLecturePrimer(lecturePrimerText, lectureTitle);
      if (res.extractedVocab && res.extractedVocab.length > 0) {
        setKeytermsList((prev) => {
          const merged = [...prev, ...res.extractedVocab];
          return merged.filter(
            (v, i, self) =>
              i === self.findIndex((t) => t.keyword.toLowerCase() === v.keyword.toLowerCase())
          );
        });
      }
    } catch (e) {
      console.error("Failed to extract terms with Gemini AI:", e);
    } finally {
      setIsExtracting(false);
    }
  };

  // Remove keyterm
  const handleRemoveKeyterm = (termToRemove: string) => {
    setKeytermsList((prev) => prev.filter((k) => k.keyword !== termToRemove));
  };

  // Final Launch
  const handleFinalLaunch = async () => {
    const title = lectureTitle.trim() || profile.defaultTitle || "General Science Lecture";
    const id = await startSession(title, keytermsList, lecturePrimerText);
    if (id) {
      navigate(`/lecturer/${id}`);
    }
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
      <Navbar variant="dashboard" contextLabel="Lecturer Hub" />

      {/* Main Workspace Layout (2-Column Grid) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Demo Mode Alert Banner */}
        {isDemoUser && (
          <div className="mb-6 border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 rounded-xl p-4 text-xs leading-relaxed flex gap-2.5 items-start text-left">
            <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 shrink-0 text-sm" />
            <div>
              <strong className="block mb-0.5">Demo Mode Active</strong>
              <span>Running in local preview mode.</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

          {/* ── LEFT COLUMN (6/12): Live Classroom Setup Wizard ── */}
          <div className="lg:col-span-6 space-y-6">
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 sm:p-8 space-y-6 text-left shadow-sm">
              
              {/* Progress Header */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] font-mono">
                  <span className="text-[var(--primary)] font-bold flex items-center gap-1.5 uppercase tracking-wider">
                    <FontAwesomeIcon icon={faRadio} className="animate-pulse text-[11px]" />
                    Live Classroom Setup
                  </span>
                  <span className="text-[var(--text-muted)] font-semibold">
                    Step {currentStep} of 3
                  </span>
                </div>

                {/* 3-Segment Progress Bar */}
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        currentStep >= step ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* ── STEP 1: Lecture Topic ── */}
              {currentStep === 1 && (
                <form onSubmit={handleStep1Next} className="space-y-6">
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
                      <FontAwesomeIcon icon={faBookOpen} className="text-sm text-[var(--primary)]" />
                      Step 1: Lecture Topic
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      What topic are you teaching today? Students will see this on their caption screen.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                      Lecture Title / Subject
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={profile.defaultTitle || "e.g. Computer Science Lecture"}
                      value={lectureTitle}
                      onChange={(e) => setLectureTitle(e.target.value)}
                      className="w-full px-4 py-3 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                      autoFocus
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                      Quick Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {presets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLectureTitle(preset)}
                          className={`text-xs px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                            lectureTitle === preset
                              ? "bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--primary)] font-bold"
                              : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)]"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    Next: Add Notes & Slides Context <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                  </button>
                </form>
              )}

              {/* ── STEP 2: Notes & Slides Context / Vocabulary ── */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
                      <FontAwesomeIcon icon={faFileLines} className="text-sm text-violet-400" />
                      Step 2: Notes & Slides Context
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Paste lecture notes or slides outline. Key terms will be highlighted for students in real-time.
                    </p>
                  </div>

                  {/* Primer Textarea */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                        Paste Lecture Notes or Terms (Optional)
                      </label>
                      {lecturePrimerText.trim() && (
                        <button
                          type="button"
                          disabled={isExtracting}
                          onClick={handleExtractFromPrimer}
                          className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-60"
                        >
                          {isExtracting ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className="text-[10px]" /> Extracting with Gemini AI...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[10px]" /> Extract Terms
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={3}
                      placeholder="e.g. Photosynthesis: Process by which green plants convert light energy into chemical energy..."
                      value={lecturePrimerText}
                      onChange={(e) => setLecturePrimerText(e.target.value)}
                      className="w-full p-3 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] resize-none"
                    />
                  </div>

                  {/* Keyterms Section */}
                  <div className="space-y-3 pt-1">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                      Course Keyterms ({keytermsList.length})
                    </span>

                    <div className="flex flex-wrap gap-2 min-h-[36px] max-h-28 overflow-y-auto pr-1">
                      {keytermsList.length === 0 ? (
                        <span className="text-xs text-[var(--text-muted)] italic self-center">
                          No custom keyterms added yet. Add terms below to assist student comprehension.
                        </span>
                      ) : (
                        keytermsList.map((k) => (
                          <span
                            key={k.keyword}
                            className="text-xs font-mono bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] px-2.5 py-1 rounded-lg flex items-center gap-1.5"
                          >
                            {k.keyword}
                            <button
                              type="button"
                              onClick={() => handleRemoveKeyterm(k.keyword)}
                              className="hover:text-red-400 cursor-pointer transition-colors"
                            >
                              <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Quick Add Form */}
                    <form onSubmit={handleAddKeyterm} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Keyword (e.g. Mitochondria)"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        type="submit"
                        className="px-3.5 h-9 bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--text)] rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                      >
                        <FontAwesomeIcon icon={faPlus} className="text-[12px]" /> Add
                      </button>
                    </form>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="h-11 px-4 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="flex-1 h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      Next: Review & Launch <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Review & Launch ── */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-bold text-[var(--text)] flex items-center gap-2">
                      <FontAwesomeIcon icon={faMicrophone} className="text-sm text-[var(--primary)]" />
                      Step 3: Ready to Broadcast
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Review your lecture setup and launch your live classroom session.
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="p-4 border border-[var(--border)] rounded-xl bg-[var(--background)] space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-mono uppercase text-[var(--text-muted)]">Topic</span>
                      <span className="text-[10px] font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded border border-[var(--primary)]/20">
                        Ready
                      </span>
                    </div>
                    <p className="font-bold text-sm text-[var(--text)]">{lectureTitle}</p>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center gap-4">
                      <span>Keyterms: {keytermsList.length}</span>
                      <span>Notes Primer: {lecturePrimerText.trim() ? "Attached" : "None"}</span>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="h-11 px-4 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalLaunch}
                      className="flex-1 h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md shadow-[var(--primary)]/20"
                    >
                      <FontAwesomeIcon icon={faMicrophone} className="text-sm" /> Launch Live Classroom
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN (6/12): Lecture History ── */}
          <div className="lg:col-span-6 space-y-6">
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 sm:p-8 text-left shadow-sm space-y-5 flex flex-col min-h-[450px]">
              <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
                  <FontAwesomeIcon icon={faBookOpen} className="text-xs text-[var(--primary)]" />
                  Lecture History ({sessions.length})
                </h3>
              </div>

              {sessions.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-6 text-[var(--text-muted)] space-y-3">
                  <FontAwesomeIcon icon={faClock} className="text-3xl text-[var(--border)]" />
                  <p className="font-bold text-xs text-[var(--text)]">No lectures recorded yet</p>
                  <p className="text-[11px] max-w-xs leading-relaxed">
                    Complete the setup wizard on the left to launch your first live lecture session.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[60vh] pr-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className={`group flex items-center gap-3.5 p-4 border rounded-xl transition-all ${
                        session.isActive
                          ? "border-[var(--primary)] bg-[var(--primary)]/5"
                          : "border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface)]"
                      }`}
                    >
                      <button
                        onClick={() => handleSelectSession(session)}
                        className="flex-1 text-left cursor-pointer min-w-0 space-y-1.5"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-sm text-[var(--text)] group-hover:text-[var(--primary)] transition-colors truncate">
                            {session.title}
                          </h4>
                          <span className="text-[9px] font-mono border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-muted)] shrink-0">
                            {session.code}
                          </span>
                          {session.isActive && (
                            <span className="text-[9px] font-mono font-bold bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-ping" />
                              LIVE • RESUME CLASS
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-[var(--text-muted)] font-mono">
                          {session.date} · {session.conceptCards?.length || 0} concept cards generated
                        </p>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleSelectSession(session)}
                          className="h-8 px-2.5 text-[10px] font-semibold border border-[var(--border)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-colors cursor-pointer flex items-center gap-1"
                        >
                          View <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                        </button>
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="p-1.5 h-8 w-8 flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors cursor-pointer"
                          aria-label="Delete session"
                        >
                          <FontAwesomeIcon icon={faTrashCan} className="text-[12px]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};
