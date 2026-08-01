import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { generateAISummary } from "../services/geminiService";
import { autoCorrectLectureTranscript } from "../services/autocorrectService";

export type Role = "lecturer" | "student" | null;

export interface TranscriptLine {
  id: string;
  text: string;
  timestamp: number;
}

export interface ConceptCard {
  id: string;
  concept: string;
  definition: string;
  details: string;
  timestamp: number;
}

export interface Session {
  id: string;
  code: string;
  title: string;
  date: string;
  transcript: TranscriptLine[];
  polishedTranscript?: TranscriptLine[];
  conceptCards: ConceptCard[];
  smartNotes?: string[];
  summary: string | null;
  customVocab: CustomTerm[];
  lecturePrimer?: string;
  isActive?: boolean;
}

export interface CustomTerm {
  keyword: string;
  definition: string;
  details: string;
  aliases?: string;
}

export interface UserProfile {
  fullName: string;
  institution: string;
  customVocab: CustomTerm[];
  defaultTitle: string;
}

interface SignBridgeContextType {
  userRole: Role;
  setUserRole: (role: Role) => void;
  sessionCode: string | null;
  sessions: Session[];
  activeSession: Session | null;
  setActiveSession: React.Dispatch<React.SetStateAction<Session | null>>;
  isRecording: boolean;
  fontSize: "sm" | "md" | "lg" | "xl";
  setFontSize: (size: "sm" | "md" | "lg" | "xl") => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  startSession: (title: string, initialVocab?: CustomTerm[], lecturePrimer?: string) => Promise<string | null>;
  joinSession: (code: string) => Promise<{ success: boolean; isActive?: boolean; sessionId?: string; error?: string }>;
  toggleRecording: () => void;
  endSession: () => Promise<string | null>;
  deleteSession: (id: string) => Promise<void>;
  addMockTranscriptLine: (text: string) => Promise<void>;
  addGeminiAnalysisResult: (result: {
    correctedLine?: TranscriptLine;
    newConceptCards?: ConceptCard[];
    keyPoints?: string[];
  }) => void;
  selectHistorySession: (session: Session) => void;
  clearActiveSession: () => void;
  addSessionVocab: (term: CustomTerm) => Promise<void>;
  
  // Auth
  user: any | null;
  profile: UserProfile;
  isAuthLoading: boolean;
  login: (email: string, password?: string, isDemo?: boolean) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password?: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (profileUpdates: Partial<UserProfile>) => Promise<void>;
  loadSessionDetails: (sessionId: string) => Promise<Session | null>;
  isPlaceholder: boolean;
}

const SignBridgeContext = createContext<SignBridgeContextType | undefined>(undefined);

const offlineSync = typeof window !== "undefined" ? new BroadcastChannel("sb_offline_sync") : null;

/** Format raw speech input into proper sentence capitalization */
function formatSentence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/** Merge continuous speech clauses into readable paragraphs with proper spacing */
function appendClauseToParagraph(paragraph: string, clause: string): string {
  const cleanP = paragraph.trim();
  const cleanC = clause.trim();
  if (!cleanP) return formatSentence(cleanC);
  if (!cleanC) return cleanP;

  if (cleanP.toLowerCase().endsWith(cleanC.toLowerCase())) {
    return cleanP;
  }

  const endsWithPunct = /[.?!]$/.test(cleanP);
  const formattedC = endsWithPunct
    ? cleanC.charAt(0).toUpperCase() + cleanC.slice(1)
    : cleanC;

  return `${cleanP} ${formattedC}`;
}



export const SignBridgeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userRole, setUserRole] = useState<Role>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<"sm" | "md" | "lg" | "xl">("md");
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  // Auth & Profile
  const [user, setUser] = useState<any | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [profile, setProfile] = useState<UserProfile>({
    fullName: "Guest Lecturer",
    institution: "SignBridge Academy",
    customVocab: [],
    defaultTitle: "General Science Lecture"
  });

  const channelRef = useRef<any>(null);

  const isPlaceholder = 
    !import.meta.env.VITE_SUPABASE_URL || 
    import.meta.env.VITE_SUPABASE_URL.includes("your-project-reference");

  // Fetch lecturer session history from Supabase
  const fetchHistory = async (userId: string) => {
    if (isPlaceholder) return;
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id, code, title, date, summary, is_active, custom_vocab,
          transcripts(id, text, timestamp),
          concept_cards(id, concept, definition, details, timestamp)
        `)
        .eq("lecturer_id", userId)
        .order("date", { ascending: false });

      if (error) throw error;
      if (data) {
        const formatted: Session[] = data.map((s: any) => ({
          id: s.id,
          code: s.code,
          title: s.title,
          date: new Date(s.date).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
          }),
          transcript: (s.transcripts || [])
            .map((t: any) => ({
              id: t.id,
              text: t.text,
              timestamp: new Date(t.timestamp).getTime()
            }))
            .sort((a: any, b: any) => a.timestamp - b.timestamp),
          conceptCards: (s.concept_cards || [])
            .map((c: any) => ({
              id: c.id,
              concept: c.concept,
              definition: c.definition,
              details: c.details,
              timestamp: new Date(c.timestamp).getTime()
            }))
            .sort((a: any, b: any) => a.timestamp - b.timestamp),
          summary: s.summary,
          customVocab: s.custom_vocab || [],
          isActive: s.is_active
        }));
        setSessions(formatted);
        localStorage.setItem("sb_sessions", JSON.stringify(formatted));
      }
    } catch (e) {
      console.warn("Offline/Network notice: Unable to reach Supabase server. Loading cached sessions history.", e);
      const cached = localStorage.getItem("sb_sessions");
      if (cached) {
        try { setSessions(JSON.parse(cached)); } catch (_) {}
      }
    }
  };

  // Fetch lecturer profile details
  const fetchProfile = async (userId: string) => {
    if (isPlaceholder) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, institution, default_title, custom_vocab")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        const loadedProfile = {
          fullName: data.full_name || "Lecturer",
          institution: data.institution || "SignBridge Academy",
          defaultTitle: data.default_title || "General Science Lecture",
          customVocab: data.custom_vocab || []
        };
        setProfile(loadedProfile);
        localStorage.setItem(`sb_profile_${userId}`, JSON.stringify(loadedProfile));
      }
    } catch (e) {
      console.warn("Offline/Network notice: Unable to reach Supabase server. Loading cached profile.", e);
      const cached = localStorage.getItem(`sb_profile_${userId}`);
      if (cached) {
        try { setProfile(JSON.parse(cached)); } catch (_) {}
      }
    }
  };

  // Initialize Auth
  useEffect(() => {
    const initAuth = async () => {
      setIsAuthLoading(true);
      try {
        if (!isPlaceholder) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            setUser(session.user);
            await fetchProfile(session.user.id);
            await fetchHistory(session.user.id);
          }

          supabase.auth.onAuthStateChange(async (_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
              await fetchProfile(session.user.id);
              await fetchHistory(session.user.id);
            } else {
              setProfile({
                fullName: "Guest Lecturer",
                institution: "SignBridge Academy",
                customVocab: [],
                defaultTitle: "General Science Lecture"
              });
              setSessions([]);
            }
          });
        } else {
          // Local storage session mock
          const mockUser = localStorage.getItem("sb_mock_user");
          if (mockUser) {
            const parsed = JSON.parse(mockUser);
            setUser(parsed);
            const savedProfile = localStorage.getItem(`sb_profile_${parsed.id}`);
            if (savedProfile) setProfile(JSON.parse(savedProfile));
          }
        }
      } catch (e) {
        console.error("Auth init exception:", e);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initAuth();

    // Cleanup channels on unmount
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  // BroadcastChannel synchronization for offline tab communication
  useEffect(() => {
    if (!offlineSync) return;

    const handleOfflineMessage = (event: MessageEvent) => {
      const { type, sessionId, line, conceptCard, notes } = event.data;
      
      setActiveSession((prev) => {
        if (!prev || prev.id !== sessionId) return prev;
        
        if (type === "TRANSCRIPT" && line) {
          if (prev.transcript.some(t => t.id === line.id)) return prev;
          return {
            ...prev,
            transcript: [...prev.transcript, line]
          };
        }

        if (type === "POLISHED_TRANSCRIPT" && line) {
          const polished = prev.polishedTranscript || [];
          if (polished.some(t => t.id === line.id)) return prev;
          return {
            ...prev,
            polishedTranscript: [...polished, line]
          };
        }
        
        if (type === "CONCEPT_CARD" && conceptCard) {
          if (prev.conceptCards.some(c => c.id === conceptCard.id)) return prev;
          return {
            ...prev,
            conceptCards: [...prev.conceptCards, conceptCard]
          };
        }

        if (type === "SMART_NOTES" && notes) {
          const currentNotes = prev.smartNotes || [];
          const newNotes = (notes as string[]).filter(n => !currentNotes.includes(n));
          if (newNotes.length === 0) return prev;
          return {
            ...prev,
            smartNotes: [...currentNotes, ...newNotes]
          };
        }
        
        return prev;
      });
    };

    offlineSync.addEventListener("message", handleOfflineMessage);
    return () => {
      offlineSync.removeEventListener("message", handleOfflineMessage);
    };
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("sb_theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  const startSession = async (
    title: string,
    initialVocab?: CustomTerm[],
    lecturePrimer?: string
  ): Promise<string | null> => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const sessionId = crypto.randomUUID();
    const cleanTitle = title || profile.defaultTitle || "Biology Lecture 101";

    const mergedVocab = [
      ...profile.customVocab,
      ...(initialVocab ?? [])
    ];
    // Deduplicate
    const uniqueVocab = mergedVocab.filter((v, i, self) => i === self.findIndex(t => t.keyword.toLowerCase() === v.keyword.toLowerCase()));

    const newSession: Session = {
      id: sessionId,
      code,
      title: cleanTitle,
      date: new Date().toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
      }),
      transcript: [],
      conceptCards: [],
      summary: null,
      customVocab: uniqueVocab,
      lecturePrimer: lecturePrimer || undefined,
      isActive: true
    };

    setActiveSession(newSession);
    setSessions((prev) => [newSession, ...prev.filter(s => s.id !== newSession.id)]);
    localStorage.setItem("sb_active_session", JSON.stringify(newSession));
    setSessionCode(code);
    setUserRole("lecturer");
    setIsRecording(true);

    // Sync to Supabase
    if (!isPlaceholder && user) {
      try {
        await supabase.from("sessions").insert({
          id: sessionId,
          lecturer_id: user.id,
          code,
          title: cleanTitle,
          is_active: true,
          custom_vocab: newSession.customVocab
        });
      } catch (e) {
        console.error("Failed to insert session into Supabase:", e);
      }
    }
    return sessionId;
  };

  const joinSession = async (code: string): Promise<{ success: boolean; isActive?: boolean; sessionId?: string; error?: string }> => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    if (isPlaceholder) {
      // Local check
      if (activeSession && activeSession.code === code) {
        setUserRole("student");
        return { success: true, isActive: true, sessionId: activeSession.id };
      }
      const matched = sessions.find((s) => s.code === code);
      if (matched) {
        setActiveSession(matched);
        setUserRole("student");
        return { success: true, isActive: false, sessionId: matched.id };
      }
      if (code.length === 6) {
        const mockId = crypto.randomUUID();
        const mock: Session = {
          id: mockId,
          code,
          title: "Live Lecture (Offline Mode)",
          date: "Just now",
          transcript: [],
          conceptCards: [],
          summary: null,
          customVocab: []
        };
        setActiveSession(mock);
        setUserRole("student");
        return { success: true, isActive: true, sessionId: mockId };
      }
      return { success: false, error: "Session not found." };
    }

    // Connect to Live Supabase session
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id, code, title, date, summary, is_active, custom_vocab,
          transcripts(id, text, timestamp),
          concept_cards(id, concept, definition, details, timestamp)
        `)
        .eq("code", code)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;

      let targetData = data;
      if (!targetData) {
        const { data: archivedData, error: archError } = await supabase
          .from("sessions")
          .select(`
            id, code, title, date, summary, is_active, custom_vocab,
            transcripts(id, text, timestamp),
            concept_cards(id, concept, definition, details, timestamp)
          `)
          .eq("code", code)
          .order("date", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (archError) throw archError;
        targetData = archivedData;
      }

      if (!targetData) {
        return { success: false, error: "Room code not found." };
      }

      const joinedSession: Session = {
        id: targetData.id,
        code: targetData.code,
        title: targetData.title,
        date: new Date(targetData.date).toLocaleDateString(),
        transcript: (targetData.transcripts || [])
          .map((t: any) => ({
            id: t.id,
            text: t.text,
            timestamp: new Date(t.timestamp).getTime()
          }))
          .sort((a: any, b: any) => a.timestamp - b.timestamp),
        conceptCards: (targetData.concept_cards || [])
          .map((c: any) => ({
            id: c.id,
            concept: c.concept,
            definition: c.definition,
            details: c.details,
            timestamp: new Date(c.timestamp).getTime()
          }))
          .sort((a: any, b: any) => a.timestamp - b.timestamp),
        summary: targetData.summary,
        customVocab: targetData.custom_vocab || []
      };

      setActiveSession(joinedSession);
      setUserRole("student");

      // Realtime Subscription
      if (targetData.is_active) {
        if (channelRef.current) {
          try { supabase.removeChannel(channelRef.current); } catch (_) {}
          channelRef.current = null;
        }

        const channelTopic = `session_feed_${targetData.id}_${Date.now()}`;
        const channel = supabase.channel(channelTopic);

        channel
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "transcripts", filter: `session_id=eq.${targetData.id}` },
            (payload) => {
              const newL: TranscriptLine = {
                id: payload.new.id,
                text: payload.new.text,
                timestamp: new Date(payload.new.timestamp).getTime()
              };
              setActiveSession((prev) => {
                if (!prev || prev.id !== targetData.id) return prev;
                if (prev.transcript.some(t => t.id === newL.id)) return prev;
                return {
                  ...prev,
                  transcript: [...prev.transcript, newL]
                };
              });
            }
          )
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "concept_cards", filter: `session_id=eq.${targetData.id}` },
            (payload) => {
              const newC: ConceptCard = {
                id: payload.new.id,
                concept: payload.new.concept,
                definition: payload.new.definition,
                details: payload.new.details,
                timestamp: new Date(payload.new.timestamp).getTime()
              };
              setActiveSession((prev) => {
                if (!prev || prev.id !== targetData.id) return prev;
                if (prev.conceptCards.some(c => c.id === newC.id)) return prev;
                return {
                  ...prev,
                  conceptCards: [...prev.conceptCards, newC]
                };
              });
            }
          )
          .subscribe();

        channelRef.current = channel;
      }
      return { success: true, isActive: targetData.is_active, sessionId: targetData.id };
    } catch (e: any) {
      console.warn("Offline/Network notice: Unable to reach Supabase server while joining session. Attempting local session match.", e);
      const saved = localStorage.getItem("sb_sessions");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const localMatch = parsed.find((s: Session) => s.code === code);
          if (localMatch) {
            setActiveSession(localMatch);
            return { success: true, isActive: localMatch.isActive, sessionId: localMatch.id };
          }
        } catch (_) {}
      }
      return { success: false, error: e.message || "Failed to join session" };
    }
  };

  const addMockTranscriptLine = async (text: string) => {
    if (!activeSession) return;
    const rawClean = text.trim();
    if (!rawClean) return;

    // Real-Time Phonetic Auto-Correction & Academic Dictionary Polish
    const cleanText = autoCorrectLectureTranscript(rawClean, activeSession.customVocab || []);

    const transcriptCopy = [...activeSession.transcript];
    const lastIndex = transcriptCopy.length - 1;
    const lastLine = lastIndex >= 0 ? transcriptCopy[lastIndex] : null;

    let lineId: string = crypto.randomUUID();
    let isUpdate = false;

    // Intelligent Paragraph Assembly: Merge continuous speech within 12 seconds into cohesive paragraphs
    const PARAGRAPH_TIME_WINDOW_MS = 12000;
    const MAX_PARAGRAPH_LENGTH = 280;

    if (
      lastLine &&
      Date.now() - lastLine.timestamp < PARAGRAPH_TIME_WINDOW_MS &&
      lastLine.text.length < MAX_PARAGRAPH_LENGTH
    ) {
      const lastClean = lastLine.text.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
      const newClean = cleanText.toLowerCase().replace(/[^a-z0-9]/g, "");

      if (lastClean === newClean) {
        return; // Exact duplicate -> ignore
      }

      if (
        newClean.startsWith(lastClean) ||
        (cleanText.length > lastLine.text.length &&
          newClean.includes(lastClean.slice(0, Math.min(20, lastClean.length))))
      ) {
        // Extended version of active clause -> update paragraph text
        transcriptCopy[lastIndex] = {
          ...lastLine,
          text: formatSentence(cleanText),
          timestamp: Date.now(),
        };
        lineId = lastLine.id;
        isUpdate = true;
      } else {
        // Append clause to active paragraph naturally with proper punctuation & spacing
        const mergedText = appendClauseToParagraph(lastLine.text, cleanText);
        transcriptCopy[lastIndex] = {
          ...lastLine,
          text: mergedText,
          timestamp: Date.now(),
        };
        lineId = lastLine.id;
        isUpdate = true;
      }
    }

    if (!isUpdate) {
      transcriptCopy.push({
        id: lineId,
        text: formatSentence(cleanText),
        timestamp: Date.now(),
      });
    }

    const updatedTranscript = transcriptCopy;
    const updatedCards = [...activeSession.conceptCards];

    // Vocabulary trigger logic: match against session's custom vocabulary!
    const mergedVocabulary = activeSession.customVocab;

    const lowerText = text.toLowerCase();
    let detectedVocab: any = null;

    mergedVocabulary.forEach((vocab) => {
      const keywordLower = vocab.keyword.toLowerCase();
      let isMatched = lowerText.includes(keywordLower);

      if (!isMatched && vocab.aliases) {
        const aliasList = vocab.aliases.split(",").map(a => a.trim().toLowerCase());
        isMatched = aliasList.some(alias => {
          if (!alias) return false;
          const escapedAlias = alias.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const regex = new RegExp(`\\b${escapedAlias}\\b`, 'i');
          return regex.test(text);
        });
      }

      if (isMatched) {
        const alreadyExists = updatedCards.some(
          (c) => c.concept.toLowerCase() === keywordLower || 
                 (vocab.aliases && vocab.aliases.split(",").map(a => a.trim().toLowerCase()).includes(c.concept.toLowerCase()))
        );
        if (!alreadyExists) {
          detectedVocab = vocab;
          const conceptTitle = vocab.keyword;
          updatedCards.push({
            id: crypto.randomUUID(),
            concept: conceptTitle,
            definition: vocab.definition,
            details: vocab.details,
            timestamp: Date.now()
          });
        }
      }
    });

    const updatedSession = {
      ...activeSession,
      transcript: updatedTranscript,
      conceptCards: updatedCards
    };

    setActiveSession(updatedSession);
    setSessions((prev) => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    if (updatedSession.isActive) {
      localStorage.setItem("sb_active_session", JSON.stringify(updatedSession));
    }

    // Sync to Supabase in background
    if (!isPlaceholder) {
      try {
        await supabase.from("transcripts").insert({
          id: lineId,
          session_id: activeSession.id,
          text
        });

        if (detectedVocab) {
          await supabase.from("concept_cards").insert({
            session_id: activeSession.id,
            concept: detectedVocab.keyword,
            definition: detectedVocab.definition,
            details: detectedVocab.details
          });
        }
      } catch (e) {
        console.error("Failed to sync transcript/cards to Supabase:", e);
      }
    } else {
      // Broadcast to other tabs for offline simulation
      if (offlineSync && activeSession) {
        offlineSync.postMessage({
          type: "TRANSCRIPT",
          sessionId: activeSession.id,
          line: updatedTranscript[updatedTranscript.length - 1]
        });
        
        if (detectedVocab) {
          const matchingCard = updatedCards[updatedCards.length - 1];
          offlineSync.postMessage({
            type: "CONCEPT_CARD",
            sessionId: activeSession.id,
            conceptCard: matchingCard
          });
        }
      }
    }
  };

  const addGeminiAnalysisResult = (result: {
    correctedLine?: TranscriptLine;
    newConceptCards?: ConceptCard[];
    keyPoints?: string[];
  }) => {
    if (!activeSession) return;

    setActiveSession((prev) => {
      if (!prev) return null;

      const currentPolished = prev.polishedTranscript || [];
      const updatedPolished = result.correctedLine
        ? [...currentPolished, result.correctedLine]
        : currentPolished;

      const currentCards = prev.conceptCards || [];
      const newCards = (result.newConceptCards || []).filter(
        (nc) => !currentCards.some((c) => c.concept.toLowerCase() === nc.concept.toLowerCase())
      );
      const updatedCards = [...currentCards, ...newCards];

      const currentNotes = prev.smartNotes || [];
      const newNotes = (result.keyPoints || []).filter((kp) => !currentNotes.includes(kp));
      const updatedNotes = [...currentNotes, ...newNotes];

      const updatedSession: Session = {
        ...prev,
        polishedTranscript: updatedPolished,
        conceptCards: updatedCards,
        smartNotes: updatedNotes
      };

      if (updatedSession.isActive) {
        localStorage.setItem("sb_active_session", JSON.stringify(updatedSession));
      }

      if (offlineSync) {
        if (result.correctedLine) {
          offlineSync.postMessage({
            type: "POLISHED_TRANSCRIPT",
            sessionId: prev.id,
            line: result.correctedLine
          });
        }
        newCards.forEach((card) => {
          offlineSync.postMessage({
            type: "CONCEPT_CARD",
            sessionId: prev.id,
            conceptCard: card
          });
        });
        if (result.keyPoints && result.keyPoints.length > 0) {
          offlineSync.postMessage({
            type: "SMART_NOTES",
            sessionId: prev.id,
            notes: result.keyPoints
          });
        }
      }

      return updatedSession;
    });
  };

  const endSession = async (): Promise<string | null> => {
    if (!activeSession) return null;

    setIsRecording(false);

    const title = activeSession.title || "Class Lecture";
    const transcriptLines = (activeSession.transcript || []).filter((t) => t && t.text && t.text.trim().length > 0);

    let finalSummary = "";
    if (transcriptLines.length === 0) {
      finalSummary = `# ${title}\n\nNo spoken transcript was recorded during this live session. Start speaking during a live classroom broadcast to record captions and generate automated AI summaries.`;
    } else {
      try {
        finalSummary = await generateAISummary(
          title,
          transcriptLines,
          activeSession.conceptCards || []
        );
      } catch (e) {
        console.warn("Failed to generate AI summary on session end:", e);
        finalSummary = `# ${title}\n\nSummary unavailable.`;
      }
    }

    const finalSession: Session = {
      ...activeSession,
      summary: finalSummary,
      isActive: false
    };

    setActiveSession(finalSession);
    setSessions((prev) => prev.map(s => s.id === finalSession.id ? finalSession : s));
    localStorage.removeItem("sb_active_session");

    // Sync end session state to Supabase
    if (!isPlaceholder) {
      try {
        await supabase
          .from("sessions")
          .update({
            summary: finalSummary,
            is_active: false
          })
          .eq("id", activeSession.id);

        if (user) await fetchHistory(user.id);
      } catch (e) {
        console.error("Failed to end session in Supabase:", e);
      }
    }
    return activeSession.id;
  };

  const deleteSession = async (id: string) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    localStorage.setItem("sb_sessions", JSON.stringify(updated));

    if (!isPlaceholder) {
      try {
        await supabase.from("sessions").delete().eq("id", id);
      } catch (e) {
        console.error("Failed to delete session from Supabase:", e);
      }
    }

    if (activeSession && activeSession.id === id) {
      setActiveSession(null);
      setSessionCode(null);
      setUserRole(null);
    }
  };

  const selectHistorySession = (session: Session) => {
    setActiveSession(session);
  };

  const clearActiveSession = () => {
    setActiveSession(null);
    setSessionCode(null);
    setUserRole(null);
  };

  // Auth Operations
  const login = async (email: string, password?: string, isDemo = false): Promise<{ success: boolean; error?: string }> => {
    if (isDemo || isPlaceholder) {
      const mockUser = {
        id: "mock_user_id",
        email: email || "teacher@school.edu",
        user_metadata: { full_name: "Dr. Albus Dumbledore" }
      };
      setUser(mockUser);
      localStorage.setItem("sb_mock_user", JSON.stringify(mockUser));
      
      const mockProfile = {
        fullName: "Dr. Albus Dumbledore",
        institution: "Hogwarts Academy",
        customVocab: [],
        defaultTitle: "Defense Against the Dark Arts Lecture"
      };
      setProfile(mockProfile);
      localStorage.setItem("sb_profile_mock_user_id", JSON.stringify(mockProfile));
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: password || ""
      });
      if (error) throw error;
      setUser(data.user);
      await fetchProfile(data.user.id);
      await fetchHistory(data.user.id);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Failed to log in" };
    }
  };

  const signup = async (email: string, password?: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    if (isPlaceholder) {
      const mockUser = {
        id: "mock_user_id",
        email,
        user_metadata: { full_name: name || "New Lecturer" }
      };
      setUser(mockUser);
      localStorage.setItem("sb_mock_user", JSON.stringify(mockUser));
      
      const mockProfile = {
        fullName: name || "New Lecturer",
        institution: "SignBridge Academy",
        customVocab: [],
        defaultTitle: "General Science Lecture"
      };
      setProfile(mockProfile);
      localStorage.setItem("sb_profile_mock_user_id", JSON.stringify(mockProfile));
      return { success: true };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || "",
        options: { data: { full_name: name || "" } }
      });
      if (error) throw error;
      setUser(data.user);
      
      setProfile({
        fullName: name || "New Lecturer",
        institution: "SignBridge Academy",
        customVocab: [],
        defaultTitle: "General Science Lecture"
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || "Failed to sign up" };
    }
  };

  const logout = async (): Promise<void> => {
    if (!isPlaceholder) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("sb_mock_user");
  };

  const updateProfile = async (profileUpdates: Partial<UserProfile>) => {
    const newProfile = { ...profile, ...profileUpdates };
    setProfile(newProfile);
    
    if (user) {
      localStorage.setItem(`sb_profile_${user.id}`, JSON.stringify(newProfile));
      
      if (!isPlaceholder) {
        try {
          await supabase.from("profiles").upsert({
            id: user.id,
            full_name: newProfile.fullName,
            institution: newProfile.institution,
            default_title: newProfile.defaultTitle,
            custom_vocab: newProfile.customVocab
          });
        } catch (e) {
          console.error("Failed to sync profile to Supabase:", e);
        }
      }
    }
  };

  const loadSessionDetails = async (sessionId: string): Promise<Session | null> => {
    if (isPlaceholder) {
      const activeStored = localStorage.getItem("sb_active_session");
      if (activeStored) {
        const parsed = JSON.parse(activeStored);
        if (parsed.id === sessionId) return parsed;
      }
      const matched = sessions.find(s => s.id === sessionId) || activeSession;
      return matched;
    }

    try {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id, code, title, date, summary, is_active, custom_vocab,
          transcripts(id, text, timestamp),
          concept_cards(id, concept, definition, details, timestamp)
        `)
        .eq("id", sessionId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        code: data.code,
        title: data.title,
        date: new Date(data.date).toLocaleDateString(),
        transcript: (data.transcripts || [])
          .map((t: any) => ({
            id: t.id,
            text: t.text,
            timestamp: new Date(t.timestamp).getTime()
          }))
          .sort((a: any, b: any) => a.timestamp - b.timestamp),
        conceptCards: (data.concept_cards || [])
          .map((c: any) => ({
            id: c.id,
            concept: c.concept,
            definition: c.definition,
            details: c.details,
            timestamp: new Date(c.timestamp).getTime()
          }))
          .sort((a: any, b: any) => a.timestamp - b.timestamp),
        summary: data.summary,
        customVocab: data.custom_vocab || [],
        isActive: data.is_active
      };
    } catch (e) {
      console.error("Error loading session detail:", e);
      return null;
    }
  };

  const addSessionVocab = async (term: CustomTerm) => {
    if (!activeSession) return;

    const updatedVocab = [term, ...activeSession.customVocab];
    const updatedSession = { ...activeSession, customVocab: updatedVocab };
    
    setActiveSession(updatedSession);
    setSessions(prev => prev.map(s => s.id === activeSession.id ? updatedSession : s));

    if (!isPlaceholder) {
      try {
        await supabase
          .from("sessions")
          .update({ custom_vocab: updatedVocab })
          .eq("id", activeSession.id);
      } catch (e) {
        console.error("Failed to sync session vocabulary update to Supabase:", e);
      }
    }
  };

  return (
    <SignBridgeContext.Provider
      value={{
        userRole,
        setUserRole,
        sessionCode,
        sessions,
        activeSession,
        setActiveSession,
        isRecording,
        fontSize,
        setFontSize,
        theme,
        toggleTheme,
        startSession,
        joinSession,
        toggleRecording,
        endSession,
        deleteSession,
        addMockTranscriptLine,
        addGeminiAnalysisResult,
        selectHistorySession,
        clearActiveSession,
        addSessionVocab,
        
        // Auth values
        user,
        profile,
        isAuthLoading,
        login,
        signup,
        logout,
        updateProfile,
        loadSessionDetails,
        isPlaceholder
      }}
    >
      {children}
    </SignBridgeContext.Provider>
  );
};

export const useSignBridge = () => {
  const context = useContext(SignBridgeContext);
  if (context === undefined) {
    throw new Error("useSignBridge must be used within a SignBridgeProvider");
  }
  return context;
};
