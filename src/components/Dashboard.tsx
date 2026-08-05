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
  faFlask,
  faAtom,
  faLaptopCode,
  faLanguage,
  faHeartPulse,
  faCalculator,
  faLeaf,
  faGlobe,
  faCheckCircle,
  faCircleNotch,
  faRocket,
  faLayerGroup,
  faHashtag,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";
import type { CustomTerm } from "../context/SignBridgeContext";
import { parseLecturePrimer } from "../services/geminiService";

// ─── Category grid config ────────────────────────────────────────────────────
const TOPIC_CATEGORIES = [
  { label: "Biology & Life Sci", icon: faLeaf,      color: "text-emerald-500",  bg: "bg-emerald-500/10  border-emerald-500/20",  active: "bg-emerald-500/20 border-emerald-500" },
  { label: "Chemistry",          icon: faFlask,     color: "text-purple-400",   bg: "bg-purple-400/10   border-purple-400/20",   active: "bg-purple-400/20  border-purple-400"  },
  { label: "Physics",            icon: faAtom,      color: "text-blue-400",     bg: "bg-blue-400/10     border-blue-400/20",     active: "bg-blue-400/20    border-blue-400"    },
  { label: "Computer Science",   icon: faLaptopCode,color: "text-cyan-400",     bg: "bg-cyan-400/10     border-cyan-400/20",     active: "bg-cyan-400/20    border-cyan-400"    },
  { label: "Languages & Lit",    icon: faLanguage,  color: "text-rose-400",     bg: "bg-rose-400/10     border-rose-400/20",     active: "bg-rose-400/20    border-rose-400"    },
  { label: "Health & Medicine",  icon: faHeartPulse,color: "text-red-400",      bg: "bg-red-400/10      border-red-400/20",      active: "bg-red-400/20     border-red-400"     },
  { label: "Mathematics",        icon: faCalculator,color: "text-amber-400",    bg: "bg-amber-400/10    border-amber-400/20",    active: "bg-amber-400/20   border-amber-400"   },
  { label: "Geography & Earth",  icon: faGlobe,     color: "text-teal-400",     bg: "bg-teal-400/10     border-teal-400/20",     active: "bg-teal-400/20    border-teal-400"    },
];

// ─── Stepper component ────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: "Topic" },
  { num: 2, label: "Context" },
  { num: 3, label: "Launch" },
];

const Stepper: React.FC<{ current: number }> = ({ current }) => (
  <div className="flex items-center gap-0 w-full">
    {STEPS.map((step, i) => {
      const done   = current > step.num;
      const active = current === step.num;
      return (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300 ${
              done   ? "bg-[var(--primary)] border-[var(--primary)] text-black"
              : active ? "border-[var(--primary)] bg-[var(--primary)]/15 text-[var(--primary)]"
              : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)]"
            }`}>
              {done
                ? <FontAwesomeIcon icon={faCheckCircle} className="text-sm" />
                : step.num
              }
            </div>
            <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${
              active ? "text-[var(--primary)]" : done ? "text-[var(--text-muted)]" : "text-[var(--border)]"
            }`}>{step.label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mb-5 mx-2 rounded-full transition-all duration-500 ${
              current > step.num ? "bg-[var(--primary)]" : "bg-[var(--border)]"
            }`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
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

  // Navigation View State
  const [activeTab, setActiveTab] = useState<"setup" | "history">("setup");

  // Setup Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [lectureTitle, setLectureTitle]     = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lecturePrimerText, setLecturePrimerText] = useState("");
  const [keytermsList, setKeytermsList]     = useState<CustomTerm[]>([]);
  const [newKeyword, setNewKeyword]         = useState("");
  const [isExtracting, setIsExtracting]     = useState(false);
  const [isLaunching, setIsLaunching]       = useState(false);

  // History Search
  const [searchQuery, setSearchQuery] = useState("");

  // Step navigation
  const goToStep = (step: 1 | 2 | 3) => setCurrentStep(step);

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle.trim()) {
      setLectureTitle(profile.defaultTitle || "General Lecture");
    }
    goToStep(2);
  };

  const handleCategorySelect = (label: string) => {
    if (selectedCategory === label) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(label);
      setLectureTitle(label);
    }
  };

  const handleAddKeyterm = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault?.();
    const clean = newKeyword.trim();
    if (!clean) return;
    if (!keytermsList.some((k) => k.keyword.toLowerCase() === clean.toLowerCase())) {
      setKeytermsList((prev) => [
        ...prev,
        { keyword: clean, definition: "Course terminology.", details: "Added during setup." },
      ]);
    }
    setNewKeyword("");
  };

  const handleExtractFromPrimer = async () => {
    if (!lecturePrimerText.trim() || isExtracting) return;
    setIsExtracting(true);
    try {
      const res = await parseLecturePrimer(lecturePrimerText, lectureTitle);
      if (res.extractedVocab?.length > 0) {
        setKeytermsList((prev) => {
          const merged = [...prev, ...res.extractedVocab];
          return merged.filter(
            (v, i, self) => i === self.findIndex((t) => t.keyword.toLowerCase() === v.keyword.toLowerCase())
          );
        });
      }
    } catch (e) {
      console.error("Failed to extract terms with Gemini AI:", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRemoveKeyterm = (term: string) => {
    setKeytermsList((prev) => prev.filter((k) => k.keyword !== term));
  };

  const handleFinalLaunch = async () => {
    setIsLaunching(true);
    const title = lectureTitle.trim() || profile.defaultTitle || "General Science Lecture";
    try {
      const id = await startSession(title, keytermsList, lecturePrimerText);
      if (id) navigate(`/lecturer/${id}`);
    } finally {
      setIsLaunching(false);
    }
  };

  const handleSelectSession = (session: any) => {
    selectHistorySession(session);
    if (session.isActive) navigate(`/lecturer/${session.id}`);
    else navigate(`/review/${session.id}`);
  };

  const isDemoUser = user?.id === "mock_user_id";
  const liveSession = sessions.find((s) => s.isActive);
  const filteredSessions = sessions.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.summary && s.summary.toLowerCase().includes(q))
    );
  });

  const firstName = profile.fullName?.split(" ")[0] || "Lecturer";

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      <Navbar variant="dashboard" contextLabel="Lecturer Hub" />

      {/* ── Sub-nav: sits flush under the fixed Navbar (top-12) ── */}
      <div className="sticky top-12 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-md px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-12 gap-3">

          {/* Tab group */}
          <div className="flex items-center h-full">
            {(["setup", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative h-full px-4 text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer border-b-2 ${
                  activeTab === tab
                    ? "border-[var(--primary)] text-[var(--primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border)]"
                }`}
              >
                <FontAwesomeIcon
                  icon={tab === "setup" ? faRadio : faBookOpen}
                  className={`text-[11px] ${tab === "setup" && activeTab === "setup" ? "animate-pulse" : ""}`}
                />
                <span className="hidden sm:inline">{tab === "setup" ? "Live Class Setup" : "Lecture History"}</span>
                <span className="sm:hidden">{tab === "setup" ? "Setup" : "History"}</span>
                {tab === "history" && sessions.length > 0 && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                    activeTab === "history"
                      ? "bg-[var(--primary)] text-black"
                      : "bg-[var(--border)] text-[var(--text-muted)]"
                  }`}>{sessions.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {activeTab === "history" && (
              <button
                onClick={() => setActiveTab("setup")}
                className="h-8 px-3.5 rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[11px]" />
                <span className="hidden sm:inline">New Lecture</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main ── */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Live Broadcast Banner */}
        {liveSession && (
          <div className="border border-[var(--primary)]/40 bg-[var(--primary)]/8 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="relative shrink-0">
                <span className="flex h-4 w-4">
                  <span className="animate-broadcast-ring absolute inline-flex h-full w-full rounded-full bg-[var(--primary)] opacity-60" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-[var(--primary)]" />
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="shimmer-text text-[10px] font-mono font-black uppercase tracking-widest">
                    Live Broadcast Active
                  </span>
                  <span className="text-[10px] font-mono border border-[var(--border)] rounded px-2 py-0.5 text-[var(--text-muted)] bg-[var(--surface)]">
                    Room: {liveSession.code}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[var(--text)] mt-0.5">{liveSession.title}</h3>
              </div>
            </div>
            <button
              onClick={() => handleSelectSession(liveSession)}
              className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs flex items-center gap-2 transition-all cursor-pointer shadow-sm shrink-0 animate-launch-pulse"
            >
              <FontAwesomeIcon icon={faRadio} className="text-xs" /> Re-enter Classroom
            </button>
          </div>
        )}

        {/* Demo Banner */}
        {isDemoUser && (
          <div className="border border-yellow-500/20 bg-yellow-500/8 text-yellow-500 rounded-xl p-4 text-xs leading-relaxed flex gap-2.5 items-start text-left">
            <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 shrink-0 text-sm" />
            <div><strong className="block mb-0.5">Demo Mode Active</strong> Running in local preview mode. Sign in to save sessions.</div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  VIEW 1: LIVE CLASS SETUP WIZARD                              */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "setup" && (
          <div className="max-w-3xl mx-auto space-y-6">

            {/* ── Hero header ── */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-[var(--text)] tracking-tight leading-tight">
                  Good {getGreeting()}, <span className="text-[var(--primary)]">{firstName}</span>
                </h1>
                <p className="text-xs text-[var(--text-muted)] mt-1">Configure and launch your live classroom broadcast.</p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-[var(--text-muted)] shrink-0">
                <FontAwesomeIcon icon={faLayerGroup} className="text-[var(--primary)]" />
                <span>{sessions.length} lecture{sessions.length !== 1 ? "s" : ""} recorded</span>
              </div>
            </div>

            {/* ── Wizard Card ── */}
            <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] shadow-sm overflow-hidden">

              {/* Card header with stepper */}
              <div className="px-6 sm:px-10 pt-8 pb-6 border-b border-[var(--border)] bg-[var(--background)]/40">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[var(--primary)] flex items-center gap-2">
                    <FontAwesomeIcon icon={faRadio} className="animate-pulse" />
                    Live Classroom Setup
                  </span>
                </div>
                <Stepper current={currentStep} />
              </div>

              {/* Card body */}
              <div className="px-6 sm:px-10 py-8">

                {/* ── STEP 1: Topic ── */}
                {currentStep === 1 && (
                  <form key="step1" onSubmit={handleStep1Next} className="space-y-7 animate-step-enter">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[var(--text)]">
                        What are you teaching today?
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                        Enter your lecture title or pick a subject category. Students will see this on their caption display.
                      </p>
                    </div>

                    {/* Title Input */}
                    <div className="space-y-2">
                      <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                        Lecture Title / Subject
                      </label>
                      <div className="relative">
                        <FontAwesomeIcon icon={faHashtag} className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]" />
                        <input
                          type="text"
                          placeholder={profile.defaultTitle || "e.g. Computer Architecture & Systems"}
                          value={lectureTitle}
                          onChange={(e) => {
                            setLectureTitle(e.target.value);
                            setSelectedCategory(null);
                          }}
                          className="w-full pl-10 pr-4 py-4 border-2 border-[var(--border)] focus:border-[var(--primary)] rounded-xl bg-[var(--background)] text-[var(--text)] text-sm font-semibold outline-none transition-all"
                          autoFocus
                        />
                      </div>
                      {profile.defaultTitle && !lectureTitle && (
                        <button
                          type="button"
                          onClick={() => setLectureTitle(profile.defaultTitle)}
                          className="text-[10px] text-[var(--primary)] hover:underline font-semibold cursor-pointer"
                        >
                          Use my default: "{profile.defaultTitle}"
                        </button>
                      )}
                    </div>

                    {/* Category Grid */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)] block">
                        Or pick a subject category
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {TOPIC_CATEGORIES.map((cat) => {
                          const isActive = selectedCategory === cat.label;
                          return (
                            <button
                              key={cat.label}
                              type="button"
                              onClick={() => handleCategorySelect(cat.label)}
                              className={`group flex flex-col items-center gap-2 p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-center ${
                                isActive
                                  ? `${cat.active} shadow-sm scale-[1.02]`
                                  : `${cat.bg} hover:scale-[1.02] hover:shadow-sm`
                              }`}
                            >
                              <FontAwesomeIcon icon={cat.icon} className={`text-lg ${cat.color}`} />
                              <span className={`text-[10px] font-bold leading-tight ${
                                isActive ? cat.color : "text-[var(--text-muted)] group-hover:text-[var(--text)]"
                              }`}>{cat.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!lectureTitle.trim() && !selectedCategory}
                      className="w-full py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-black rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-md shadow-[var(--primary)]/20 group"
                    >
                      Continue to Notes &amp; Context
                      <FontAwesomeIcon icon={faArrowRight} className="text-xs group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </form>
                )}

                {/* ── STEP 2: Notes & Vocabulary ── */}
                {currentStep === 2 && (
                  <div key="step2" className="space-y-6 animate-step-enter">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[var(--text)] flex items-center gap-2.5">
                        <FontAwesomeIcon icon={faFileLines} className="text-violet-400 text-lg" />
                        Notes & Vocabulary Context
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                        Paste your lecture notes so Gemini AI can extract key terms and bias the speech model toward your content.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                      {/* Left: Paste Notes */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                            Lecture Notes / Syllabus
                          </label>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">
                            {lecturePrimerText.length} chars
                          </span>
                        </div>
                        <textarea
                          rows={9}
                          placeholder="Paste your lecture outline, notes, or slide text here...&#10;&#10;Gemini AI will automatically extract all key concepts and populate your vocabulary list →"
                          value={lecturePrimerText}
                          onChange={(e) => setLecturePrimerText(e.target.value)}
                          className="w-full p-4 border-2 border-[var(--border)] focus:border-violet-400/60 rounded-xl bg-[var(--background)] text-[var(--text)] text-xs outline-none resize-none leading-relaxed transition-all font-sans"
                        />
                        <button
                          type="button"
                          disabled={!lecturePrimerText.trim() || isExtracting}
                          onClick={handleExtractFromPrimer}
                          className="w-full h-10 rounded-xl border-2 border-violet-400/30 bg-violet-400/10 hover:bg-violet-400/20 text-violet-400 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isExtracting ? (
                            <>
                              <FontAwesomeIcon icon={faSpinner} spin />
                              Gemini AI Extracting...
                            </>
                          ) : (
                            <>
                              <FontAwesomeIcon icon={faWandMagicSparkles} />
                              Extract Key Terms with AI
                            </>
                          )}
                        </button>
                      </div>

                      {/* Right: Keyterms */}
                      <div className="space-y-2 flex flex-col">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                            Speech Recognition Keyterms
                          </label>
                          {keytermsList.length > 0 && (
                            <span className="text-[10px] font-mono text-[var(--primary)] bg-[var(--primary)]/10 px-2 py-0.5 rounded border border-[var(--primary)]/20 font-bold">
                              {keytermsList.length} biased
                            </span>
                          )}
                        </div>

                        {/* Tag cloud area */}
                        <div className="flex-1 min-h-[180px] p-3 border-2 border-[var(--border)] rounded-xl bg-[var(--background)] overflow-y-auto">
                          {keytermsList.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8">
                              <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[var(--border)] text-lg" />
                              </div>
                              <p className="text-xs text-[var(--text-muted)]">
                                Paste notes and click<br />
                                <strong className="text-violet-400">Extract with AI</strong> or add terms below
                              </p>
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 content-start">
                              {keytermsList.map((k) => (
                                <span
                                  key={k.keyword}
                                  className="animate-tag-pop text-xs font-mono bg-[var(--primary)]/10 border border-[var(--primary)]/25 text-[var(--primary)] px-3 py-1.5 rounded-lg flex items-center gap-1.5"
                                >
                                  {k.keyword}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveKeyterm(k.keyword)}
                                    className="hover:text-red-400 cursor-pointer transition-colors ml-0.5"
                                    aria-label={`Remove ${k.keyword}`}
                                  >
                                    <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Inline chip input */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Add term (e.g. Mitochondria) + Enter"
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddKeyterm(e)}
                            className="flex-1 px-3.5 py-2.5 border-2 border-[var(--border)] focus:border-[var(--primary)] rounded-xl bg-[var(--background)] text-[var(--text)] text-xs outline-none transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddKeyterm()}
                            className="px-3.5 h-10 border-2 border-[var(--border)] hover:border-[var(--primary)] rounded-xl text-[var(--text-muted)] hover:text-[var(--primary)] transition-all cursor-pointer"
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Step 2 nav: mobile = stacked (Back top, CTA bottom) | desktop = side by side */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-3 border-t border-[var(--border)] mt-2">
                      {/* Back — full outlined button on mobile, ghost on desktop */}
                      <button
                        type="button"
                        onClick={() => goToStep(1)}
                        className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] sm:border-0 sm:hover:bg-[var(--background)] transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
                      </button>
                      {/* Primary CTA */}
                      <button
                        type="button"
                        onClick={async () => {
                          if (lecturePrimerText.trim() && keytermsList.length === 0) {
                            await handleExtractFromPrimer();
                          }
                          goToStep(3);
                        }}
                        className="w-full sm:flex-1 h-11 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-black rounded-xl text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-sm shadow-[var(--primary)]/20 group"
                      >
                        Review &amp; Launch
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Review & Launch ── */}
                {currentStep === 3 && (
                  <div key="step3" className="space-y-7 animate-step-enter">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-[var(--text)] flex items-center gap-2.5">
                        <FontAwesomeIcon icon={faRocket} className="text-[var(--primary)] text-lg" />
                        Ready to Go Live
                      </h2>
                      <p className="text-xs text-[var(--text-muted)] mt-1.5 leading-relaxed">
                        Review your session configuration. A room code will be generated when you launch.
                      </p>
                    </div>

                    {/* Pre-flight Checklist */}
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--background)] divide-y divide-[var(--border)] overflow-hidden">
                      {/* Topic */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        <FontAwesomeIcon icon={faCheckCircle} className="text-[var(--primary)] text-base shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block mb-0.5">Subject / Topic</span>
                          <p className="text-sm font-bold text-[var(--text)] truncate">{lectureTitle || profile.defaultTitle || "General Lecture"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(1)}
                          className="text-[10px] text-[var(--primary)] hover:underline font-semibold cursor-pointer shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Notes */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        <FontAwesomeIcon
                          icon={lecturePrimerText.trim() ? faCheckCircle : faCircleNotch}
                          className={`text-base shrink-0 ${lecturePrimerText.trim() ? "text-[var(--primary)]" : "text-[var(--border)]"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block mb-0.5">Lecture Notes Primer</span>
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {lecturePrimerText.trim()
                              ? `${lecturePrimerText.length} characters attached`
                              : <span className="text-[var(--text-muted)] font-normal italic">None — optional</span>
                            }
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="text-[10px] text-[var(--primary)] hover:underline font-semibold cursor-pointer shrink-0"
                        >
                          Edit
                        </button>
                      </div>

                      {/* Keyterms */}
                      <div className="flex items-center gap-4 px-5 py-4">
                        <FontAwesomeIcon
                          icon={keytermsList.length > 0 ? faCheckCircle : faCircleNotch}
                          className={`text-base shrink-0 ${keytermsList.length > 0 ? "text-[var(--primary)]" : "text-[var(--border)]"}`}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-muted)] block mb-0.5">Speech Recognition Keyterms</span>
                          {keytermsList.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {keytermsList.slice(0, 6).map((k) => (
                                <span key={k.keyword} className="text-[10px] font-mono bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] px-2 py-0.5 rounded">
                                  {k.keyword}
                                </span>
                              ))}
                              {keytermsList.length > 6 && (
                                <span className="text-[10px] text-[var(--text-muted)] font-mono self-center">
                                  +{keytermsList.length - 6} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-[var(--text-muted)] font-normal italic">No keyterms — optional</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => goToStep(2)}
                          className="text-[10px] text-[var(--primary)] hover:underline font-semibold cursor-pointer shrink-0"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Step 3 nav: mobile = stacked (Back top, Go Live bottom) | desktop = side by side */}
                    <div className="flex flex-col sm:flex-row gap-2.5 pt-4 border-t border-[var(--border)] mt-2">
                      {/* Back — full outlined button on mobile */}
                      <button
                        type="button"
                        onClick={() => goToStep(2)}
                        className="w-full sm:w-auto h-11 px-5 rounded-xl text-xs font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] sm:border-0 sm:hover:bg-[var(--background)] transition-colors cursor-pointer flex items-center justify-center gap-2 shrink-0"
                      >
                        <FontAwesomeIcon icon={faArrowLeft} className="text-xs" /> Back
                      </button>

                      {/* Primary launch CTA — highest visual weight on the page */}
                      <button
                        type="button"
                        onClick={handleFinalLaunch}
                        disabled={isLaunching}
                        className="w-full sm:flex-1 py-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-black font-black rounded-xl text-base flex items-center justify-center gap-3 transition-all cursor-pointer relative overflow-hidden animate-launch-pulse"
                      >
                        {isLaunching ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin className="text-lg" />
                            <span>Starting Session...</span>
                          </>
                        ) : (
                          <>
                            <span className="relative flex h-5 w-5 shrink-0">
                              <span className="animate-broadcast-ring absolute inline-flex h-full w-full rounded-full bg-black/30" />
                              <FontAwesomeIcon icon={faMicrophone} className="relative text-base" />
                            </span>
                            <span>Go Live — Launch Classroom</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════ */}
        {/*  VIEW 2: LECTURE HISTORY                                       */}
        {/* ══════════════════════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <div className="space-y-5 animate-fade-in">

            {/* ── History header: stacked on mobile, row on sm+ ── */}
            <div className="space-y-3">
              {/* Top row: title + session count */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 border border-[var(--primary)]/20 flex items-center justify-center shrink-0">
                    <FontAwesomeIcon icon={faBookOpen} className="text-[var(--primary)] text-xs" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-bold text-[var(--text)] whitespace-nowrap">Lecture Archive</h2>
                    <p className="text-[10px] text-[var(--text-muted)] font-mono">
                      {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                      {sessions.reduce((t, s) => t + (s.conceptCards?.length || 0), 0) > 0 && (
                        <> &middot; {sessions.reduce((t, s) => t + (s.conceptCards?.length || 0), 0)} cards</>
                      )}
                    </p>
                  </div>
                </div>

                {/* Stat chips — hidden on very small screens */}
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  {sessions.some(s => s.summary) && (
                    <span className="text-[10px] font-mono bg-violet-400/10 border border-violet-400/20 text-violet-400 px-2 py-1 rounded-lg flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[9px]" />
                      AI Summaries
                    </span>
                  )}
                  {sessions.some(s => s.isActive) && (
                    <span className="text-[10px] font-mono bg-[var(--primary)]/10 border border-[var(--primary)]/20 text-[var(--primary)] px-2 py-1 rounded-lg flex items-center gap-1.5 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-ping inline-block" />
                      Live Now
                    </span>
                  )}
                </div>
              </div>

              {/* Search — full width on mobile */}
              <div className="relative">
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none"
                />
                <input
                  type="text"
                  placeholder="Search by topic, room code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-[var(--border)] rounded-xl bg-[var(--surface)] text-[var(--text)] text-xs outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/10 transition-all placeholder:text-[var(--text-muted)]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer transition-colors"
                    aria-label="Clear search"
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-xs" />
                  </button>
                )}
              </div>
            </div>

            {/* Session List */}
            {filteredSessions.length === 0 ? (
              <div className="border border-dashed border-[var(--border)] rounded-2xl bg-[var(--surface)] py-16 px-6 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-[var(--background)] border border-[var(--border)] mx-auto flex items-center justify-center">
                  <FontAwesomeIcon icon={searchQuery ? faMagnifyingGlass : faClock} className="text-2xl text-[var(--border)]" />
                </div>
                <div className="space-y-1.5">
                  <p className="font-bold text-sm text-[var(--text)]">
                    {searchQuery ? `No results for "${searchQuery}"` : "No lectures yet"}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] max-w-xs mx-auto leading-relaxed">
                    {searchQuery
                      ? "Try a different keyword or room code."
                      : "Your recorded lectures will appear here after your first broadcast."}
                  </p>
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab("setup")}
                    className="h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-bold rounded-xl text-xs inline-flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" /> Launch First Lecture
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSessions.map((session, idx) => (
                  <div
                    key={session.id}
                    className={`group flex flex-col sm:flex-row sm:items-center gap-4 p-5 border rounded-2xl transition-all text-left ${
                      session.isActive
                        ? "border-[var(--primary)]/50 bg-[var(--primary)]/5 shadow-sm"
                        : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]/40 hover:shadow-sm"
                    }`}
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    {/* Left: Date timeline dot */}
                    <div className="hidden sm:flex flex-col items-center gap-1 shrink-0 w-12 self-stretch">
                      <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${session.isActive ? "bg-[var(--primary)] animate-pulse" : "bg-[var(--border)]"}`} />
                      {idx < filteredSessions.length - 1 && (
                        <div className="flex-1 w-px bg-[var(--border)] mt-1" />
                      )}
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono border border-[var(--border)] rounded px-2 py-0.5 text-[var(--text-muted)] bg-[var(--background)]">
                          {session.code}
                        </span>
                        {session.isActive ? (
                          <span className="text-[10px] font-mono font-bold bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-ping" />
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">{session.date}</span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-[var(--text)] truncate">{session.title}</h3>

                      <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faLayerGroup} className="text-[9px]" />
                          {session.conceptCards?.length || 0} cards
                        </span>
                        <span className="w-px h-3 bg-[var(--border)]" />
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faFileLines} className="text-[9px]" />
                          {session.transcript?.length || 0} captions
                        </span>
                        {session.summary && (
                          <>
                            <span className="w-px h-3 bg-[var(--border)]" />
                            <span className="flex items-center gap-1">
                              <FontAwesomeIcon icon={faWandMagicSparkles} className="text-[9px] text-violet-400" />
                              AI Summary
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions — clear hierarchy: primary fills, secondary ghost, destructive icon-only */}
                    <div className="flex items-center gap-2 sm:shrink-0">
                      {session.isActive ? (
                        /* Active session: filled primary = highest urgency */
                        <button
                          onClick={() => handleSelectSession(session)}
                          className="h-9 px-4 text-xs font-bold rounded-lg bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                        >
                          Resume <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                        </button>
                      ) : (
                        /* Completed session: low-weight outlined ghost */
                        <button
                          onClick={() => handleSelectSession(session)}
                          className="h-9 px-4 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)] transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          View Deck <FontAwesomeIcon icon={faChevronRight} className="text-[10px]" />
                        </button>
                      )}
                      {/* Destructive: icon-only, lowest visual weight until hovered */}
                      <button
                        onClick={() => deleteSession(session.id)}
                        className="h-9 w-9 flex items-center justify-center rounded-lg text-[var(--border)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        aria-label="Delete session"
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

// ─── Utility ─────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
