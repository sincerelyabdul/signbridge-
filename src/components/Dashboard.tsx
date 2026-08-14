import React, { useState } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faBookOpen,
  faTrashCan,
  faShieldHalved,
  faArrowRight,
  faArrowLeft,
  faPlus,
  faXmark,
  faRadio,
  faChevronRight,
  faFileLines,
  faSpinner,
  faMagnifyingGlass,
  faFlask,
  faAtom,
  faLaptopCode,
  faLanguage,
  faHeartPulse,
  faCalculator,
  faLeaf,
  faCloudArrowUp,
  faDownload,
  faGlobe,
  faCheckCircle,
  faTag,
  faExclamationTriangle,
  faEye,
  faKeyboard,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";
import type { CustomTerm } from "../context/SignBridgeContext";
import { parseLecturePrimer } from "../services/geminiService";
import { extractTextFromFile, sanitizeDocxTextIfNeeded } from "../utils/fileParser";

// ─── Category grid config ─────────────────────────────────────────────────────
const TOPIC_CATEGORIES = [
  { label: "Biology & Life Sci", icon: faLeaf },
  { label: "Chemistry", icon: faFlask },
  { label: "Physics", icon: faAtom },
  { label: "Computer Science", icon: faLaptopCode },
  { label: "Languages & Lit", icon: faLanguage },
  { label: "Health & Medicine", icon: faHeartPulse },
  { label: "Mathematics", icon: faCalculator },
  { label: "Geography & Earth", icon: faGlobe },
];

// ─── Stepper ──────────────────────────────────────────────────────────────────
const STEPS = [
  { num: 1, label: "Topic" },
  { num: 2, label: "Notes & Vocab" },
  { num: 3, label: "Launch" },
];

const Stepper: React.FC<{ current: number }> = ({ current }) => (
  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-4 mb-6 text-xs">
    {STEPS.map((step, i) => {
      const done = current > step.num;
      const active = current === step.num;
      return (
        <React.Fragment key={step.num}>
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-semibold border ${
                done || active
                  ? "bg-[var(--primary)] border-[var(--primary)] text-black"
                  : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)]"
              }`}
            >
              {done ? <FontAwesomeIcon icon={faCheckCircle} className="text-[11px]" /> : step.num}
            </span>
            <span className={`font-medium ${active ? "text-[var(--text)] font-semibold" : "text-[var(--text-muted)]"}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && <span className="text-[var(--border)] font-mono mx-1.5">/</span>}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const { user, profile, sessions, startSession, selectHistorySession, deleteSession } = useSignBridge();
  const navigate = useNavigate();

  // Navigation
  const [activeTab, setActiveTab] = useState<"setup" | "history">("setup");

  // Setup Wizard State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  const [lectureTitle, setLectureTitle] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [lecturePrimerText, setLecturePrimerText] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [keytermsList, setKeytermsList] = useState<CustomTerm[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [newKeywordDef, setNewKeywordDef] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  // History state
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // ── File Upload ───────────────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);
    setIsExtracting(true);
    try {
      const extractedText = await extractTextFromFile(file);
      setLecturePrimerText(extractedText);
      if (extractedText.trim()) {
        const res = await parseLecturePrimer(extractedText, lectureTitle);
        if (res.extractedVocab?.length > 0) {
          setKeytermsList((prev) => {
            const merged = [...prev, ...res.extractedVocab];
            return merged.filter((v, i, self) => i === self.findIndex((t) => t.keyword.toLowerCase() === v.keyword.toLowerCase()));
          });
        }
      }
    } catch (_) {}
    setIsExtracting(false);
  };

  // ── Sample Template Download ──────────────────────────────────────────────────
  const handleDownloadSampleTemplate = () => {
    const sampleContent = `# ${lectureTitle || "Lecture Title: Introduction to Computer Science"}

## Course Overview & Objectives
In this lecture, we explore core concepts in Algorithms, Data Structures, and System Architecture.

## Key Vocabulary & Definitions

### Retrieval Augmented Generation (RAG)
- **Definition**: A technique that enhances Large Language Models by fetching external documents before generating responses.
- **Aliases**: RAG, GenAI Search, External Memory

### Photosynthesis
- **Definition**: The process by which green plants and organisms synthesize nutrients from carbon dioxide and water using sunlight.
- **Aliases**: Plant energy conversion

### Overfitting
- **Definition**: When a statistical model fits exactly against its training data, resulting in poor performance on unseen test data.
- **Aliases**: Over-training, High Variance
`;
    const blob = new Blob([sampleContent], { type: "text/markdown;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${(lectureTitle || "lesson").toLowerCase().replace(/\s+/g, "_")}_template.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const goToStep = (step: 1 | 2 | 3) => setCurrentStep(step);

  // ── Step 1 ────────────────────────────────────────────────────────────────────
  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lectureTitle.trim()) setLectureTitle(profile.defaultTitle || "General Lecture");
    goToStep(2);
  };

  // FIX #1: Category sets tag context ONLY — never overwrites a typed title
  const handleCategorySelect = (label: string) => {
    if (selectedCategory === label) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(label);
      // Only auto-fill title if the lecturer hasn't typed one yet
      if (!lectureTitle.trim()) {
        setLectureTitle(label);
      }
    }
  };

  // ── Step 2 ────────────────────────────────────────────────────────────────────
  // FIX #2: Manual keyterms now require a definition
  const handleAddKeyterm = (e?: React.FormEvent | React.KeyboardEvent) => {
    if (e) e.preventDefault?.();
    const clean = newKeyword.trim();
    const def = newKeywordDef.trim();
    if (!clean || !def) return;
    if (!keytermsList.some((k) => k.keyword.toLowerCase() === clean.toLowerCase())) {
      setKeytermsList((prev) => [...prev, { keyword: clean, definition: def, details: "Added manually during setup." }]);
    }
    setNewKeyword("");
    setNewKeywordDef("");
  };

  const handleExtractFromPrimer = async () => {
    if (!lecturePrimerText.trim() || isExtracting) return;
    setIsExtracting(true);
    try {
      const res = await parseLecturePrimer(lecturePrimerText, lectureTitle);
      if (res.extractedVocab?.length > 0) {
        setKeytermsList((prev) => {
          const merged = [...prev, ...res.extractedVocab];
          return merged.filter((v, i, self) => i === self.findIndex((t) => t.keyword.toLowerCase() === v.keyword.toLowerCase()));
        });
      }
    } catch (e) {
      console.error("Failed to extract terms:", e);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleRemoveKeyterm = (term: string) => {
    setKeytermsList((prev) => prev.filter((k) => k.keyword !== term));
  };

  // ── Launch ────────────────────────────────────────────────────────────────────
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

  // FIX #6: Delete requires confirmation
  const handleDeleteConfirm = async (id: string) => {
    await deleteSession(id);
    setDeleteConfirmId(null);
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

  // Notes preview snippet for Step 3
  const notesPreviewSnippet = lecturePrimerText.trim()
    ? `"${lecturePrimerText.trim().slice(0, 120).replace(/\n/g, " ")}${lecturePrimerText.length > 120 ? "..." : ""}"`
    : null;

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      <Navbar variant="dashboard" contextLabel="Lecturer Hub" />

      {/* Sub-navigation */}
      <div className="sticky top-12 z-20 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-11 gap-3">
          <div className="flex items-center h-full gap-1">
            {(["setup", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`h-full px-3 text-xs font-medium flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
                  activeTab === tab
                    ? "border-[var(--primary)] text-[var(--text)] font-semibold"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                <FontAwesomeIcon icon={tab === "setup" ? faRadio : faBookOpen} className="text-[11px]" />
                <span>{tab === "setup" ? "Live Setup" : "History"}</span>
                {tab === "history" && sessions.length > 0 && (
                  <span className="text-[10px] px-1.5 rounded font-mono bg-[var(--background)] border border-[var(--border)] text-[var(--text-muted)]">
                    {sessions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
          {activeTab === "history" && (
            <button
              onClick={() => setActiveTab("setup")}
              className="h-7 px-2.5 rounded-md bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
              <span>New Lecture</span>
            </button>
          )}
        </div>
      </div>

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Live Broadcast Banner */}
        {liveSession && (
          <div className="border border-[var(--primary)]/40 bg-[var(--primary)]/5 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shrink-0 animate-pulse" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--primary)] uppercase tracking-wider text-[10px]">Live Broadcast Active</span>
                  <span className="font-mono text-[var(--text-muted)] border border-[var(--border)] px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface)]">
                    Room: {liveSession.code}
                  </span>
                </div>
                <h3 className="font-semibold text-[var(--text)] mt-0.5 text-sm">{liveSession.title}</h3>
              </div>
            </div>
            <button
              onClick={() => handleSelectSession(liveSession)}
              className="h-8 px-3.5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
            >
              <FontAwesomeIcon icon={faRadio} className="text-xs" /> Re-enter Classroom
            </button>
          </div>
        )}

        {/* Demo Mode Alert */}
        {isDemoUser && (
          <div className="border border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 rounded-md p-3 text-xs flex items-center gap-2">
            <FontAwesomeIcon icon={faShieldHalved} className="shrink-0 text-sm" />
            <span><strong>Demo Mode:</strong> Running in local preview mode. Sign in to sync sessions.</span>
          </div>
        )}

        {/* ══ SETUP WIZARD ══════════════════════════════════════════════════════ */}
        {activeTab === "setup" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div>
                <h1 className="text-lg font-semibold text-[var(--text)]">Live Broadcast Setup</h1>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Prepare topic, terms, and context before going live.</p>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-mono hidden sm:inline">
                {sessions.length} lecture{sessions.length !== 1 ? "s" : ""} recorded
              </span>
            </div>

            <div className="border border-[var(--border)] rounded-lg bg-[var(--surface)] p-6 space-y-6">
              <Stepper current={currentStep} />

              {/* ── STEP 1: Topic ── */}
              {currentStep === 1 && (
                <form onSubmit={handleStep1Next} className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text)]">Lecture Topic & Subject</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Enter the full title of today's lecture. Optionally tag a subject category.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-[var(--text)] block">Lecture Title</label>
                    <input
                      type="text"
                      placeholder={profile.defaultTitle || "e.g. Computer Architecture & Systems Design"}
                      value={lectureTitle}
                      onChange={(e) => {
                        setLectureTitle(e.target.value);
                        // Don't clear category — category is now a tag, not the title source
                      }}
                      className="w-full px-3 py-2 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] rounded-md bg-[var(--background)] text-[var(--text)] text-xs outline-none transition-colors"
                      autoFocus
                    />
                    {profile.defaultTitle && !lectureTitle && (
                      <button
                        type="button"
                        onClick={() => setLectureTitle(profile.defaultTitle)}
                        className="text-[11px] text-[var(--primary)] hover:underline cursor-pointer block mt-1"
                      >
                        Use default: "{profile.defaultTitle}"
                      </button>
                    )}
                  </div>

                  {/* FIX #1: Category as subject tag — not title replacement */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-[var(--text)] block">Subject Category</label>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">(optional tag — won't replace your title)</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {TOPIC_CATEGORIES.map((cat) => {
                        const isActive = selectedCategory === cat.label;
                        return (
                          <button
                            key={cat.label}
                            type="button"
                            onClick={() => handleCategorySelect(cat.label)}
                            className={`flex items-center gap-2 p-2.5 rounded-md border text-left text-xs transition-colors cursor-pointer ${
                              isActive
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)] font-semibold"
                                : "border-[var(--border)] bg-[var(--background)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--text-muted)]"
                            }`}
                          >
                            <FontAwesomeIcon icon={cat.icon} className="text-sm shrink-0" />
                            <span className="truncate">{cat.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    {selectedCategory && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <FontAwesomeIcon icon={faTag} className="text-[10px] text-[var(--primary)]" />
                        <span className="text-[11px] text-[var(--primary)] font-mono">
                          Tagged as: {selectedCategory}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(null)}
                          className="text-[10px] text-[var(--text-muted)] hover:text-red-500 cursor-pointer ml-1"
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!lectureTitle.trim() && !selectedCategory}
                      className="h-9 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed text-black font-semibold rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Continue to Notes</span>
                      <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                    </button>
                  </div>
                </form>
              )}

              {/* ── STEP 2: Notes & Vocab ── */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text)]">Notes & Speech Vocabulary</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">
                      Paste lecture notes or upload a file to extract key terms and prime the speech recognition engine.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Left: Notes Input */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-[var(--text)]">Lecture Notes or File</label>
                        <button
                          type="button"
                          onClick={handleDownloadSampleTemplate}
                          className="text-[10px] text-[var(--primary)] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                          title="Download a recommended Markdown lesson template"
                        >
                          <FontAwesomeIcon icon={faDownload} className="text-[9px]" />
                          <span>Sample Template (.md)</span>
                        </button>
                      </div>

                      <label className="flex flex-col items-center justify-center p-3 border border-dashed border-[var(--border)] hover:border-[var(--primary)] rounded-lg bg-[var(--surface)]/50 cursor-pointer transition-colors group text-center">
                        <input type="file" accept=".txt,.md,.markdown,.json,.csv,.doc,.docx" onChange={handleFileUpload} className="hidden" />
                        <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] group-hover:text-[var(--primary)] transition-colors">
                          <FontAwesomeIcon icon={faCloudArrowUp} className="text-sm text-[var(--primary)]" />
                          <span className="font-medium">
                            {uploadedFileName ? `Attached: ${uploadedFileName}` : "Upload Notes File (.txt, .md, .docx, .json)"}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] mt-0.5">Drag & drop or click to select</span>
                      </label>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-[10px] text-[var(--text-muted)]">Or paste text directly:</span>
                        <span className="text-[var(--text-muted)] font-mono text-[10px]">{lecturePrimerText.length} chars</span>
                      </div>

                      <textarea
                        rows={5}
                        placeholder="Paste lecture outline, slide text, or syllabus here..."
                        value={lecturePrimerText}
                        onChange={(e) => setLecturePrimerText(sanitizeDocxTextIfNeeded(e.target.value))}
                        className="w-full p-3 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] rounded-md bg-[var(--background)] text-[var(--text)] text-xs outline-none resize-none font-sans transition-colors"
                      />

                      <button
                        type="button"
                        disabled={!lecturePrimerText.trim() || isExtracting}
                        onClick={handleExtractFromPrimer}
                        className="h-8 px-3 w-full rounded-md border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--surface)] text-[var(--text)] font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {/* FIX #9: Descriptive extraction spinner label */}
                        {isExtracting ? (
                          <>
                            <FontAwesomeIcon icon={faSpinner} spin />
                            <span>Analysing notes with Gemini AI...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faFileLines} className="text-xs" />
                            <span>Extract Key Terms with AI</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Right: Keyterms List + FIX #2: definition required for manual terms */}
                    <div className="space-y-2 flex flex-col">
                      <div className="flex items-center justify-between text-xs">
                        <label className="font-medium text-[var(--text)]">Speech Keyterms</label>
                        {keytermsList.length > 0 && (
                          <span className="text-[10px] font-mono text-[var(--primary)] font-semibold">{keytermsList.length} terms</span>
                        )}
                      </div>

                      <div className="flex-1 min-h-[120px] p-3 border border-[var(--border)] rounded-md bg-[var(--background)] overflow-y-auto">
                        {keytermsList.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-center p-4">
                            <p className="text-xs text-[var(--text-muted)]">
                              No keyterms added yet.<br />Paste notes and extract, or add custom terms below.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {keytermsList.map((k) => (
                              <div key={k.keyword} className="flex items-start gap-1.5 text-xs border border-[var(--border)] rounded-md p-2 bg-[var(--surface)] group">
                                <div className="flex-1 min-w-0">
                                  <span className="font-mono font-bold text-[var(--primary)] text-[11px] block">{k.keyword}</span>
                                  <p className="text-[10px] text-[var(--text-muted)] leading-relaxed truncate">{k.definition}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveKeyterm(k.keyword)}
                                  className="text-[var(--text-muted)] hover:text-red-500 cursor-pointer transition-colors shrink-0 mt-0.5 opacity-0 group-hover:opacity-100"
                                  aria-label={`Remove ${k.keyword}`}
                                >
                                  <FontAwesomeIcon icon={faXmark} className="text-[10px]" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Manual add form — requires keyword + definition */}
                      <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
                        <p className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                          <FontAwesomeIcon icon={faKeyboard} className="text-[9px]" />
                          Add term manually:
                        </p>
                        <input
                          type="text"
                          placeholder="Term (e.g. Mitochondria)"
                          value={newKeyword}
                          onChange={(e) => setNewKeyword(e.target.value)}
                          className="w-full px-3 py-1.5 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] rounded-md bg-[var(--background)] text-[var(--text)] text-xs outline-none transition-colors"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Definition (required)"
                            value={newKeywordDef}
                            onChange={(e) => setNewKeywordDef(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddKeyterm(e)}
                            className="flex-1 px-3 py-1.5 border border-[var(--border)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] rounded-md bg-[var(--background)] text-[var(--text)] text-xs outline-none transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddKeyterm()}
                            disabled={!newKeyword.trim() || !newKeywordDef.trim()}
                            className="px-3 h-8 border border-[var(--border)] hover:border-[var(--primary)] rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-xs" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => goToStep(1)}
                      className="h-8 px-3 rounded-md border border-[var(--border)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-[10px]" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (lecturePrimerText.trim() && keytermsList.length === 0) {
                          await handleExtractFromPrimer();
                        }
                        goToStep(3);
                      }}
                      className="h-8 px-4 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-md text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Review & Launch</span>
                      <FontAwesomeIcon icon={faArrowRight} className="text-[10px]" />
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Review & Launch ── */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--text)]">Review Configuration</h2>
                    <p className="text-xs text-[var(--text-muted)] mt-1">Confirm your lecture details before opening the live room.</p>
                  </div>

                  <div className="rounded-md border border-[var(--border)] divide-y divide-[var(--border)] bg-[var(--background)] text-xs">
                    <div className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="text-[var(--text-muted)] block text-[10px] mb-0.5">Topic / Title</span>
                        <span className="font-semibold text-[var(--text)]">{lectureTitle || profile.defaultTitle || "General Lecture"}</span>
                        {selectedCategory && (
                          <span className="ml-2 text-[10px] font-mono text-[var(--primary)] border border-[var(--primary)]/30 bg-[var(--primary)]/10 px-1.5 py-0.5 rounded">
                            {selectedCategory}
                          </span>
                        )}
                      </div>
                      <button onClick={() => goToStep(1)} className="text-[var(--primary)] hover:underline cursor-pointer shrink-0">Edit</button>
                    </div>

                    <div className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[var(--text-muted)] block text-[10px] mb-0.5">Notes Primer</span>
                        {/* FIX #10: Show a preview snippet */}
                        {notesPreviewSnippet ? (
                          <>
                            <span className="font-semibold text-[var(--text)]">{lecturePrimerText.length} characters attached</span>
                            <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-relaxed italic font-mono break-words">
                              {notesPreviewSnippet}
                            </p>
                          </>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">None attached — AI context will not be primed</span>
                        )}
                      </div>
                      <button onClick={() => goToStep(2)} className="text-[var(--primary)] hover:underline cursor-pointer shrink-0">Edit</button>
                    </div>

                    <div className="p-3 flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <span className="text-[var(--text-muted)] block text-[10px] mb-0.5">Speech Keyterms ({keytermsList.length})</span>
                        {keytermsList.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {keytermsList.slice(0, 8).map((k) => (
                              <span key={k.keyword} className="text-[10px] font-mono bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] px-1.5 py-0.5 rounded">
                                {k.keyword}
                              </span>
                            ))}
                            {keytermsList.length > 8 && (
                              <span className="text-[10px] font-mono text-[var(--text-muted)]">+{keytermsList.length - 8} more</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[var(--text-muted)] italic">None — speech engine will use standard vocabulary</span>
                        )}
                      </div>
                      <button onClick={() => goToStep(2)} className="text-[var(--primary)] hover:underline cursor-pointer shrink-0">Edit</button>
                    </div>
                  </div>

                  {/* What happens when you go live */}
                  <div className="rounded-md bg-[var(--primary)]/5 border border-[var(--primary)]/20 p-3 text-[11px] text-[var(--text-muted)] space-y-1">
                    <p className="font-semibold text-[var(--primary)] text-xs mb-1.5">What happens when you go live:</p>
                    <p>• A unique room code is generated — share it with students to join</p>
                    <p>• Your speech will be transcribed live with high-precision AI captions and broadcast to all connected students</p>
                    <p>• Gemini AI will extract concept cards from your speech in real time</p>
                    <p>• When you end the session, a full AI Smart Lecture Summary is automatically generated</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border)]">
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="h-8 px-3 rounded-md border border-[var(--border)] text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <FontAwesomeIcon icon={faArrowLeft} className="text-[10px]" /> Back
                    </button>
                    <button
                      type="button"
                      onClick={handleFinalLaunch}
                      disabled={isLaunching}
                      className="h-9 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-60 disabled:cursor-not-allowed text-black font-semibold rounded-md text-xs flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      {isLaunching ? (
                        <>
                          <FontAwesomeIcon icon={faSpinner} spin />
                          <span>Starting Session...</span>
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon icon={faMicrophone} />
                          <span>Go Live — Start Session</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ LECTURE HISTORY ════════════════════════════════════════════════════ */}
        {activeTab === "history" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border)]">
              <div>
                <h1 className="text-lg font-semibold text-[var(--text)]">Lecture Archive</h1>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {sessions.length} recorded session{sessions.length !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="relative w-full sm:w-64">
                <FontAwesomeIcon icon={faMagnifyingGlass} className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search topic or room code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 border border-[var(--border)] rounded-md bg-[var(--surface)] text-[var(--text)] text-xs outline-none focus:border-[var(--primary)] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faXmark} className="text-xs" />
                  </button>
                )}
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="border border-dashed border-[var(--border)] rounded-md bg-[var(--surface)] py-12 px-4 text-center space-y-3">
                <p className="text-xs font-medium text-[var(--text)]">
                  {searchQuery ? `No results found for "${searchQuery}"` : "No recorded lectures yet"}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setActiveTab("setup")}
                    className="h-8 px-3 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-md text-xs inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" /> Start First Lecture
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <div key={session.id}>
                    <div
                      className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border rounded-md transition-colors text-xs gap-3 ${
                        session.isActive
                          ? "border-[var(--primary)]/50 bg-[var(--primary)]/5"
                          : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--text-muted)]"
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-muted)] bg-[var(--background)]">
                            {session.code}
                          </span>
                          {session.isActive ? (
                            <span className="text-[10px] font-mono font-semibold bg-[var(--primary)]/15 border border-[var(--primary)]/30 text-[var(--primary)] px-2 py-0.5 rounded animate-pulse">
                              LIVE NOW
                            </span>
                          ) : (
                            /* FIX #11: Date more prominent */
                            <span className="text-[11px] font-medium text-[var(--text-muted)]">{session.date}</span>
                          )}
                        </div>
                        <h3 className="font-semibold text-[var(--text)] truncate">{session.title}</h3>
                        <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--text-muted)]">
                          <span>{session.conceptCards?.length || 0} AI cards</span>
                          <span>&middot;</span>
                          <span>{session.transcript?.length || 0} captions</span>
                          {session.customVocab?.length > 0 && (
                            <>
                              <span>&middot;</span>
                              <span>{session.customVocab.length} keyterms</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {session.isActive ? (
                          <button
                            onClick={() => handleSelectSession(session)}
                            className="h-7 px-3 text-xs font-semibold rounded bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black transition-colors cursor-pointer flex items-center gap-1"
                          >
                            Resume <FontAwesomeIcon icon={faChevronRight} className="text-[9px]" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelectSession(session)}
                            className="h-7 px-3 text-xs font-medium rounded border border-[var(--border)] bg-[var(--background)] text-[var(--text)] hover:border-[var(--text-muted)] transition-colors cursor-pointer flex items-center gap-1"
                          >
                            {/* FIX #16: "View Deck" → "Open Review" */}
                            <FontAwesomeIcon icon={faEye} className="text-[9px]" />
                            Open Review <FontAwesomeIcon icon={faChevronRight} className="text-[9px]" />
                          </button>
                        )}
                        {/* FIX #6: Delete requires confirmation */}
                        <button
                          onClick={() => setDeleteConfirmId(session.id)}
                          className="h-7 w-7 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                          title="Delete session"
                        >
                          <FontAwesomeIcon icon={faTrashCan} className="text-xs" />
                        </button>
                      </div>
                    </div>

                    {/* Inline delete confirmation */}
                    {deleteConfirmId === session.id && (
                      <div className="border border-red-500/30 bg-red-500/5 rounded-md p-3 flex items-center justify-between gap-3 mt-1 animate-fade-in">
                        <div className="flex items-center gap-2 text-xs text-red-500">
                          <FontAwesomeIcon icon={faExclamationTriangle} className="text-sm" />
                          <span className="font-semibold">Permanently delete "{session.title}"?</span>
                          <span className="text-[10px] text-[var(--text-muted)]">This cannot be undone.</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="h-7 px-3 text-xs border border-[var(--border)] rounded-md text-[var(--text-muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleDeleteConfirm(session.id)}
                            className="h-7 px-3 text-xs bg-red-500 hover:bg-red-600 text-white font-bold rounded-md transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
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
