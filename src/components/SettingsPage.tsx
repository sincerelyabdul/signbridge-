import React, { useState } from "react";
import { useSignBridge, type CustomTerm } from "../context/SignBridgeContext";
import { useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faBookBookmark,
  faTrashCan,
  faPlus,
  faWandMagicSparkles,
  faCircleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { Navbar } from "./Navbar";


export const SettingsPage: React.FC = () => {
  const { profile, updateProfile } = useSignBridge();
  const navigate = useNavigate();

  // Profile Edit States
  const [fullName, setFullName] = useState(profile.fullName);
  const [institution, setInstitution] = useState(profile.institution);
  const [defaultTitle, setDefaultTitle] = useState(profile.defaultTitle);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Vocabulary Add States
  const [keyword, setKeyword] = useState("");
  const [definition, setDefinition] = useState("");
  const [details, setDetails] = useState("");
  const [aliases, setAliases] = useState("");
  const [vocabError, setVocabError] = useState("");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      fullName: fullName.trim(),
      institution: institution.trim(),
      defaultTitle: defaultTitle.trim()
    });
    setProfileSuccess(true);
    setTimeout(() => setProfileSuccess(false), 2000);
  };

  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    setVocabError("");

    if (!keyword.trim() || !definition.trim()) {
      setVocabError("Please enter both a term and its definition.");
      return;
    }

    const cleanKeyword = keyword.trim();

    // Check duplicates
    if (profile.customVocab.some(t => t.keyword.toLowerCase() === cleanKeyword.toLowerCase())) {
      setVocabError("This term is already in your glossary.");
      return;
    }

    const newTerm: CustomTerm = {
      keyword: cleanKeyword,
      definition: definition.trim(),
      details: details.trim(),
      aliases: aliases.trim()
    };

    updateProfile({
      customVocab: [newTerm, ...profile.customVocab]
    });

    // Clear inputs
    setKeyword("");
    setDefinition("");
    setDetails("");
    setAliases("");
  };

  const handleDeleteTerm = (keywordToDelete: string) => {
    const updated = profile.customVocab.filter(t => t.keyword !== keywordToDelete);
    updateProfile({
      customVocab: updated
    });
  };

  // Gemini Key State
  const [geminiApiKey, setGeminiApiKey] = useState(() => {
    return typeof window !== "undefined" ? localStorage.getItem("sb_user_gemini_key") || "" : "";
  });
  const [geminiKeySaved, setGeminiKeySaved] = useState(false);

  const handleSaveGeminiKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined") {
      if (geminiApiKey.trim()) {
        localStorage.setItem("sb_user_gemini_key", geminiApiKey.trim());
      } else {
        localStorage.removeItem("sb_user_gemini_key");
      }
      setGeminiKeySaved(true);
      setTimeout(() => setGeminiKeySaved(false), 2000);
    }
  };

  return (
    <div className="min-h-screen pt-12 bg-[var(--background)] text-[var(--text)] transition-colors duration-150">

      {/* Header */}
      <Navbar variant="settings" contextLabel="Settings" onBack={() => navigate("/dashboard")} />

      {/* Main Grid */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 grid grid-cols-1 md:grid-cols-5 gap-6 sm:gap-8 items-start">

        {/* Left Column (2/5): Profile Configurations & In-House Gemini */}
        <div className="md:col-span-2 space-y-6">
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left space-y-4">
            <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
              <FontAwesomeIcon icon={faUser} className="text-xs" /> Instructor Profile
            </h2>

            <form onSubmit={handleSaveProfile} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Your Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">School or Institution</label>
                <input
                  type="text"
                  required
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Default Course or Subject Title</label>
                <input
                  type="text"
                  value={defaultTitle}
                  onChange={(e) => setDefaultTitle(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors"
                />
              </div>

              {profileSuccess && (
                <p className="text-green-500 text-xs font-semibold">Profile saved successfully!</p>
              )}

              <button
                type="submit"
                className="w-full h-11 bg-[var(--text)] hover:bg-[var(--text-muted)] text-[var(--background)] font-medium rounded-lg text-sm transition-colors cursor-pointer"
              >
                Save Profile
              </button>
            </form>
          </div>

          {/* AI Connection & Gemini Setup */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xs text-[var(--primary)]" /> AI Features & Gemini Setup
              </h2>
              <span className="text-[10px] font-mono bg-[var(--primary)]/10 text-[var(--primary)] px-2 py-0.5 rounded border border-[var(--primary)]/20 font-semibold">
                Direct API Connection
              </span>
            </div>

            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
              Add your Google Gemini API key to power real-time speech transcription, sign translation, and automatic lecture summaries.
            </p>

            <form onSubmit={handleSaveGeminiKey} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={geminiApiKey}
                  onChange={(e) => setGeminiApiKey(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-xs font-mono transition-colors"
                />
              </div>

              {geminiKeySaved && (
                <p className="text-green-500 text-xs font-semibold">Gemini API key saved successfully!</p>
              )}

              <button
                type="submit"
                className="w-full h-9 border border-[var(--border)] hover:border-[var(--primary)] bg-[var(--background)] text-[var(--text)] font-semibold rounded-lg text-xs transition-colors cursor-pointer"
              >
                {geminiApiKey ? "Save API Key" : "Remove API Key"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (3/5): Vocabulary Management */}
        <div className="md:col-span-3 space-y-6">

          {/* Add custom term form */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left space-y-4">
            <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] flex items-center gap-2">
              <FontAwesomeIcon icon={faBookBookmark} className="text-xs" /> Add Term to Course Glossary
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Add technical terms, jargon, or acronyms specific to your class. When mentioned during your lecture, SignBridge will automatically show definitions and context to students.
            </p>

            <form onSubmit={handleAddTerm} className="space-y-3 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Term or Keyword</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Photosynthesis or Retrieval Augmented Generation"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm font-mono transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Abbreviations & Alternative Names (comma-separated, optional)</label>
                <input
                  type="text"
                  placeholder="e.g. RAG, R.A.G., GenAI"
                  value={aliases}
                  onChange={(e) => setAliases(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm font-mono transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Student-Friendly Definition</label>
                <textarea
                  required
                  placeholder="A clear definition for your students (e.g. Organelles in plant cells that perform photosynthesis)."
                  value={definition}
                  onChange={(e) => setDefinition(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm h-20 resize-none transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-muted)]">Extra Context or Analogy (optional)</label>
                <textarea
                  placeholder="Provide an easy-to-understand analogy, formula, or extra context."
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[var(--border)] rounded-lg bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] text-sm h-20 resize-none transition-colors"
                />
              </div>

              {vocabError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-xs flex gap-2 items-start">
                  <FontAwesomeIcon icon={faCircleExclamation} className="mt-0.5 shrink-0 text-xs" />
                  <span>{vocabError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full sm:w-auto h-10 px-5 bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <FontAwesomeIcon icon={faPlus} className="text-xs" /> Add Term to Glossary
              </button>
            </form>
          </div>

          {/* List of custom terms */}
          <div className="border border-[var(--border)] rounded-xl bg-[var(--surface)] p-5 sm:p-6 text-left flex flex-col min-h-[200px]">
            <h2 className="text-xs font-bold tracking-wider uppercase text-[var(--text-muted)] mb-4">
              Your Course Glossary ({profile.customVocab.length})
            </h2>

            {profile.customVocab.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-[var(--text-muted)] py-10">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="text-xl mb-2 text-[var(--text-muted)]" />
                <p className="text-xs font-semibold">Your glossary is currently empty</p>
                <p className="text-[10px] mt-0.5 text-center">Add terms above to build a dictionary that helps students understand technical words in real time.</p>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[50vh] pr-1">
                {profile.customVocab.map((term) => (
                  <div
                    key={term.keyword}
                    className="flex justify-between items-start p-4 border border-[var(--border)] rounded-lg bg-[var(--background)] group"
                  >
                    <div className="space-y-1 flex-1 pr-3 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-sm text-[var(--text)] capitalize font-mono">{term.keyword}</h4>
                        {term.aliases && (
                          <span className="text-[9px] font-mono border border-[var(--border)] rounded px-1.5 py-0.5 bg-[var(--surface)] text-[var(--text-muted)] font-semibold">
                            Other names: {term.aliases}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">{term.definition}</p>
                      {term.details && (
                        <p className="text-[10px] text-[var(--text-muted)] italic font-mono pt-0.5">
                          Extra Context: {term.details}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleDeleteTerm(term.keyword)}
                      className="h-9 w-9 flex items-center justify-center text-[var(--text-muted)] hover:text-red-500 rounded-lg transition-colors cursor-pointer shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      aria-label="Delete vocabulary term"
                    >
                      <FontAwesomeIcon icon={faTrashCan} className="text-xs" />
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
