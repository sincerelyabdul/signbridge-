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
  faMagnifyingGlass,
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

  // Navigation View State: "setup" | "history"
  const [activeTab, setActiveTab] = useState<"setup" | "history">("setup");

  // Setup Wizard State: 1 | 2 | 3
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [lectureTitle, setLectureTitle] = useState("");
  const [lecturePrimerText, setLecturePrimerText] = useState("");
  const [keytermsList, setKeytermsList] = useState<CustomTerm[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // History Search Query
  const [searchQuery, setSearchQuery] = useState("");

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

  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.summary && s.summary.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Main App Navbar */}
      <Navbar variant="dashboard" contextLabel="Lecturer Hub" />

      {/* Sub-Header Navigation Tabs */}
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
          {/* View Switcher Tabs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("setup")}
              className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "setup"
                  ? "bg-[var(--primary)] text-black shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--background)]"
              }`}
            >
              <FontAwesomeIcon icon={faRadio} className={`text-xs ${activeTab === "setup" ? "animate-pulse" : ""}`} />
              Live Class Setup
            </button>

            <button
              onClick={() => setActiveTab("history")}
              className={`h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeTab === "history"
                  ? "bg-[var(--primary)] text-black shadow-sm"
                  : "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--background)]"
              }`}
            >
              <FontAwesomeIcon icon={faBookOpen} className="text-xs" />
              Lecture History
              <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                activeTab === "history" ? "bg-black/20 text-black" : "bg-[var(--border)] text-[var(--text-muted)]"
              }`}>
                {sessions.length}
              </span>
            </button>
          </div>

          {/* New Session CTA button when in History view */}
          {activeTab === "history" && (
            <button
              onClick={() => setActiveTab("setup")}
              className="h-8 px-3 rounded-lg bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--primary)] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faPlus} className="text-[11px]" />
              New Lecture
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace Layout */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Active Live Broadcast Banner */}
        {sessions.some((s) => s.isActive) && (
          <div className="mb-6 border border-[var(--primary)]/30 bg-[var(--primary)]/10 rounded-2xl p-5 text-left flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--primary)]"></span>
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--primary)]">
                    Live Broadcast Active
                  </span>
                  <span className="text-[10px] font-mono border border-[var(--primary)]/30 rounded px-1.5 py-0.2 text-[var(--text-muted)] bg-[var(--surface)]">
                    Room Code: {sessions.find((s) => s.isActive)?.code}
                  </span>
                </div>
                <h3 className="text-base font-bold text-[var(--text)] mt-0.5">
                  {sessions.find((s) => s.isActive)?.title}
                </h3>
              </div>
            </div>

            <button
              onClick={() => {
                const live = sessions.find((s) => s.isActive);
                if (live) handleSelectSession(live);
              }}
              className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0"
            >
              <FontAwesomeIcon icon={faRadio} className="text-xs animate-pulse" /> Re-enter Live Classroom
            </button>
          </div>
        )}

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

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* VIEW 1: FULL PAGE LIVE CLASSROOM SETUP WIZARD                     */}
        {/* ───────────────────────────────────────────────────────────────── */}
        {activeTab === "setup" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-6 sm:p-10 space-y-8 text-left shadow-sm">
              
              {/* Progress Header */}
              <div className="space-y-3 border-b border-[var(--border)] pb-6">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[var(--primary)] font-bold flex items-center gap-2 uppercase tracking-wider">
                    <FontAwesomeIcon icon={faRadio} className="animate-pulse text-xs" />
                    Live Classroom Setup Wizard
                  </span>
                  <span className="text-[var(--text-muted)] font-semibold">
                    Step {currentStep} of 3
                  </span>
                </div>

                {/* 3-Segment Progress Bar */}
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`h-2 rounded-full transition-all duration-300 ${
                        currentStep >= step ? "bg-[var(--primary)]" : "bg-[var(--border)]"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* ── STEP 1: Lecture Topic ── */}
              {currentStep === 1 && (
                <form onSubmit={handleStep1Next} className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2.5">
                      <FontAwesomeIcon icon={faBookOpen} className="text-lg text-[var(--primary)]" />
                      Step 1: What are you teaching today?
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Enter your lecture title or select a quick topic preset. Connected students will see this header on their real-time caption display.
                    </p>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    <label className="text-xs uppercase font-bold tracking-wider text-[var(--text-muted)]">
                      Lecture Title / Subject
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={profile.defaultTitle || "e.g. Computer Architecture & Systems"}
                      value={lectureTitle}
                      onChange={(e) => setLectureTitle(e.target.value)}
                      className="w-full px-4 py-3.5 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                      autoFocus
                    />
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-2.5 pt-1">
                    <span className="text-xs uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                      Quick Presets
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {presets.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setLectureTitle(preset)}
                          className={`text-xs px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                            lectureTitle === preset
                              ? "bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--primary)] font-bold shadow-xs"
                              : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)]"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-[var(--primary)]/20"
                    >
                      Next: Add Notes & Slides Context <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 2: Notes & Slides Context / Vocabulary ── */}
              {currentStep === 2 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2.5">
                      <FontAwesomeIcon icon={faFileLines} className="text-lg text-violet-400" />
                      Step 2: Notes & Slides Context
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Paste your lecture outline or notes. Google Gemini AI will automatically extract key concepts and populate your speech recognition bias model.
                    </p>
                  </div>

                  {/* Primer Textarea */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-xs uppercase font-bold tracking-wider text-[var(--text-muted)]">
                        Paste Lecture Notes or Syllabus (Optional)
                      </label>
                      {lecturePrimerText.trim() && (
                        <button
                          type="button"
                          disabled={isExtracting}
                          onClick={handleExtractFromPrimer}
                          className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1 font-semibold cursor-pointer disabled:opacity-60"
                        >
                          {isExtracting ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin className="text-xs" /> Extracting with Gemini AI...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs" /> AI Extract Terms
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={5}
                      placeholder="Paste your lecture notes, slides text, or concept outline here..."
                      value={lecturePrimerText}
                      onChange={(e) => setLecturePrimerText(e.target.value)}
                      className="w-full p-4 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] resize-none leading-relaxed font-sans"
                    />
                  </div>

                  {/* Keyterms Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                        Course Keyterms ({keytermsList.length})
                      </span>
                      {keytermsList.length > 0 && (
                        <span className="text-[10px] font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded border border-[var(--primary)]/20 font-bold">
                          Speech Recognition Biased
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 min-h-[44px] max-h-36 overflow-y-auto p-2.5 border border-[var(--border)] rounded-xl bg-[var(--background)]">
                      {keytermsList.length === 0 ? (
                        <span className="text-xs text-[var(--text-muted)] italic self-center px-2">
                          No custom keyterms added yet. Add terms below or paste lecture notes above to extract automatically.
                        </span>
                      ) : (
                        keytermsList.map((k) => (
                          <span
                            key={k.keyword}
                            className="text-xs font-mono bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] px-3 py-1.5 rounded-lg flex items-center gap-2 shadow-xs"
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
                    <form onSubmit={handleAddKeyterm} className="flex gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="Keyword (e.g. Mitochondria)"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
                      />
                      <button
                        type="submit"
                        className="px-4 h-10 bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--text)] rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <FontAwesomeIcon icon={faPlus} className="text-xs" /> Add Term
                      </button>
                    </form>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="h-12 px-6 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (lecturePrimerText.trim() && keytermsList.length === 0) {
                          await handleExtractFromPrimer();
                        }
                        setCurrentStep(3);
                      }}
                      className="flex-1 h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm shadow-[var(--primary)]/20"
                    >
                      Next: Review & Launch <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Review & Launch ── */}
              {currentStep === 3 && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2.5">
                      <FontAwesomeIcon icon={faMicrophone} className="text-lg text-[var(--primary)]" />
                      Step 3: Ready to Broadcast Live
                    </h2>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                      Review your lecture parameters and launch your live classroom session for connected students.
                    </p>
                  </div>

                  {/* Summary Card */}
                  <div className="p-5 border border-[var(--border)] rounded-2xl bg-[var(--background)] space-y-4">
                    <div className="flex justify-between items-center border-b border-[var(--border)] pb-3">
                      <span className="text-xs font-mono uppercase text-[var(--text-muted)]">Subject / Topic</span>
                      <span className="text-xs font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2.5 py-1 rounded-lg border border-[var(--primary)]/20 font-bold">
                        Ready to Stream
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-[var(--text)]">{lectureTitle}</h3>
                    <div className="grid grid-cols-2 gap-4 pt-1 text-xs text-[var(--text-muted)] font-mono">
                      <div className="p-3 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
                        <span className="block text-[10px] uppercase text-[var(--text-muted)] mb-1">Keyterms Biased</span>
                        <strong className="text-sm text-[var(--text)] font-bold">{keytermsList.length} terms</strong>
                      </div>
                      <div className="p-3 border border-[var(--border)] rounded-xl bg-[var(--surface)]">
                        <span className="block text-[10px] uppercase text-[var(--text-muted)] mb-1">Notes Primer</span>
                        <strong className="text-sm text-[var(--text)] font-bold">
                          {lecturePrimerText.trim() ? "Attached" : "None"}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="h-12 px-6 border border-[var(--border)] rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalLaunch}
                      className="flex-1 h-12 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md shadow-[var(--primary)]/20"
                    >
                      <FontAwesomeIcon icon={faMicrophone} className="text-base" /> Launch Live Classroom
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ───────────────────────────────────────────────────────────────── */}
        {/* VIEW 2: FULL PAGE LECTURE HISTORY                                 */}
        {/* ───────────────────────────────────────────────────────────────── */}
        {activeTab === "history" && (
          <div className="space-y-6">
            {/* Header & Search Controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
              <div>
                <h1 className="text-2xl font-bold text-[var(--text)] flex items-center gap-2.5">
                  <FontAwesomeIcon icon={faBookOpen} className="text-lg text-[var(--primary)]" />
                  Lecture History Archive
                </h1>
                <p className="text-xs text-[var(--text-muted)] mt-1">
                  Access past lecture transcripts, concept card decks, and automated smart summaries.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]"
                />
                <input
                  type="text"
                  placeholder="Search by topic or room code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] transition-colors"
                />
              </div>
            </div>

            {/* Session Cards Grid */}
            {filteredSessions.length === 0 ? (
              <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] py-20 px-6 text-center text-[var(--text-muted)] space-y-4">
                <FontAwesomeIcon icon={faClock} className="text-4xl text-[var(--border)]" />
                <div className="space-y-1">
                  <p className="font-bold text-sm text-[var(--text)]">
                    {searchQuery ? "No matching lectures found" : "No lectures recorded yet"}
                  </p>
                  <p className="text-xs max-w-sm mx-auto leading-relaxed">
                    {searchQuery
                      ? "Try searching for a different keyword or room code."
                      : "Click 'Live Class Setup' above to broadcast your first live lecture."}
                  </p>
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab("setup")}
                    className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" /> Launch New Lecture
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredSessions.map((session) => (
                  <div
                    key={session.id}
                    className={`p-5 border rounded-2xl transition-all text-left flex flex-col justify-between space-y-4 ${
                      session.isActive
                        ? "border-[var(--primary)] bg-[var(--primary)]/5 shadow-sm"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-[10px] font-mono border border-[var(--border)] rounded-md px-2 py-0.5 text-[var(--text-muted)] bg-[var(--background)]">
                          Code: {session.code}
                        </span>
                        {session.isActive ? (
                          <span className="text-[10px] font-mono font-bold bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-ping" />
                            LIVE • RESUME CLASS
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-[var(--text-muted)]">
                            {session.date}
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-base text-[var(--text)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
                        {session.title}
                      </h3>

                      <p className="text-xs text-[var(--text-muted)] font-mono">
                        {session.conceptCards?.length || 0} Concept Cards · {session.transcript?.length || 0} Captions
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <button
                        onClick={() => handleSelectSession(session)}
                        className={`h-9 px-4 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          session.isActive
                            ? "bg-[var(--primary)] text-black hover:bg-[var(--primary-hover)] shadow-xs"
                            : "border border-[var(--border)] hover:border-[var(--primary)] text-[var(--text)] bg-[var(--background)]"
                        }`}
                      >
                        {session.isActive ? "Resume Broadcast" : "View Review Deck"}{" "}
                        <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                      </button>

                      <button
                        onClick={() => deleteSession(session.id)}
                        className="p-2 h-9 w-9 flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer"
                        aria-label="Delete lecture session"
                        title="Delete session"
                      >
                        <FontAwesomeIcon icon={faTrashCan} className="text-xs" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
