import React, { useState, useEffect, useRef } from "react";
import { useSignBridge } from "../context/SignBridgeContext";
import { useNavigate, useParams } from "react-router-dom";
import { Mic, MicOff, LogOut, Send } from "lucide-react";
import { useSpeechToText } from "../hooks/useSpeechToText";



export const LecturerWorkspace: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const {
    activeSession,
    setActiveSession,
    loadSessionDetails,
    isRecording,
    toggleRecording,
    endSession,
    addMockTranscriptLine,
    clearActiveSession,
    addSessionVocab,
    isPlaceholder
  } = useSignBridge();

  const [customText, setCustomText] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [loading, setLoading] = useState(true);

  // Speech Recognition hook
  const {
    interimTranscript,
    startListening,
    stopListening
  } = useSpeechToText({
    onFinalResult: (text) => {
      addMockTranscriptLine(text);
    }
  });

  // Synchronize Speech recognition with recording state
  useEffect(() => {
    if (isRecording) {
      startListening();
    } else {
      stopListening();
    }
  }, [isRecording]);

  // Session Vocabulary Input States
  const [sessionKeyword, setSessionKeyword] = useState("");
  const [sessionAliases, setSessionAliases] = useState("");
  const [sessionDefinition, setSessionDefinition] = useState("");
  
  const handleAddSessionTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionKeyword.trim() || !sessionDefinition.trim()) return;
    
    await addSessionVocab({
      keyword: sessionKeyword.trim(),
      aliases: sessionAliases.trim() || undefined,
      definition: sessionDefinition.trim(),
      details: "Added dynamically during live session."
    });
    
    setSessionKeyword("");
    setSessionAliases("");
    setSessionDefinition("");
  };

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load session from URL param if activeSession is missing or mismatched
  useEffect(() => {
    if (sessionId && (!activeSession || activeSession.id !== sessionId)) {
      setLoading(true);
      loadSessionDetails(sessionId).then((session) => {
        if (session) {
          setActiveSession(session);
        } else {
          navigate("/dashboard");
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [sessionId, activeSession?.id]);

  // Real Web Audio analyser for reactive UI waveform
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRecording) {
      const startAudioAnalysis = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStreamRef.current = stream;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass();
          audioContextRef.current = audioContext;

          const source = audioContext.createMediaStreamSource(stream);
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const updateVolume = () => {
            if (!isRecording) return;
            analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const scaled = Math.min(100, Math.round((average / 255) * 400));
            setAudioLevel(scaled);
            animationFrameRef.current = requestAnimationFrame(updateVolume);
          };

          updateVolume();
        } catch (e) {
          console.warn("Could not access microphone for volume analyzer:", e);
        }
      };

      startAudioAnalysis();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop());
        audioStreamRef.current = null;
      }
      setAudioLevel(0);
    }

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
      if (audioStreamRef.current) audioStreamRef.current.getTracks().forEach(track => track.stop());
    };
  }, [isRecording]);

  // Auto-scroll transcript log to bottom
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.transcript]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] text-[var(--text)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-[var(--text-muted)] font-mono">Loading lecture gateway...</span>
        </div>
      </div>
    );
  }

  if (!activeSession) return null;

  const handleSendCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    addMockTranscriptLine(customText.trim());
    setCustomText("");
  };



  const handleEndSession = async () => {
    const id = await endSession();
    if (id) {
      navigate(`/review/${id}`);
    }
  };

  const handleExitPortal = () => {
    clearActiveSession();
    navigate("/dashboard");
  };



  return (
    <div className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--text)] transition-colors duration-150">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-4 flex justify-between items-center bg-[var(--surface)]">
        <div className="flex items-center gap-3">
          <span className="font-bold text-2xl tracking-tight select-none flex items-baseline gap-1">
            <span>sign<span className="text-[var(--primary)]">bridge</span><span className="text-[var(--primary)] font-black text-3xl">.</span></span>
            <span className="text-xs font-normal text-[var(--text-muted)] ml-1.5 self-center">lecturer portal</span>
          </span>
          <span className="h-4 w-px bg-[var(--border)]"></span>
          <span className="text-xs text-[var(--text-muted)] truncate max-w-xs">{activeSession.title}</span>
        </div>
        <button
          onClick={handleExitPortal}
          className="px-3 py-1.5 border border-[var(--border)] rounded hover:bg-red-500 hover:text-white hover:border-red-500 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut size={12} /> Exit Portal
        </button>
      </header>

      {/* Main Grid */}
      <div className="flex-1 max-w-7xl w-full mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column (1/4): Session Details & Microphone Controls */}
        <div className="lg:col-span-1 space-y-6 flex flex-col justify-between h-full">
          <div className="space-y-6">
            {/* Session Info */}
            <div className="border border-[var(--border)] rounded bg-[var(--surface)] p-6 text-left space-y-4">
              <div className="flex justify-between items-start w-full">
                <div>
                  <span className="text-[10px] tracking-wider uppercase text-[var(--text-muted)] block font-bold">Session Code</span>
                  <span className="text-3xl font-mono font-bold text-[var(--text)] tracking-wider block mt-1">
                    {activeSession.code}
                  </span>
                </div>
                {isPlaceholder && (
                  <span className="text-[8px] bg-yellow-500/15 border border-yellow-500/25 text-yellow-500 font-mono px-2 py-0.5 rounded uppercase font-semibold">
                    Offline Simulator
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Provide this 6-digit code to students. They will instantly receive your live audio transcripts and visual concept cards.
              </p>
            </div>

            {/* Mic Controls & Indicator */}
            <div className="border border-[var(--border)] rounded bg-[var(--surface)] p-6 text-left space-y-6">
              <h3 className="font-bold text-xs tracking-wider uppercase text-[var(--text-muted)]">
                Audio Gateway
              </h3>

              {/* Audio Wave Indicator */}
              <div className="h-16 flex items-center justify-center gap-1 border border-[var(--border)] rounded bg-[var(--background)] px-4">
                {isRecording ? (
                  Array.from({ length: 15 }).map((_, i) => {
                    const height = Math.max(
                      8,
                      Math.sin(i * 0.5) * audioLevel * 0.5 + audioLevel * 0.5
                    );
                    return (
                      <div
                        key={i}
                        className="w-1.5 rounded-full bg-[var(--primary)] transition-all duration-150"
                        style={{ height: `${height}%` }}
                      ></div>
                    );
                  })
                ) : (
                  <span className="text-xs text-[var(--text-muted)]">Microphone is offline</span>
                )}
              </div>

              {/* Mic Toggles */}
              <div className="flex gap-3">
                <button
                  onClick={toggleRecording}
                  className={`flex-1 py-2.5 rounded font-medium text-xs flex items-center justify-center gap-2 border transition-colors cursor-pointer ${
                    isRecording
                      ? "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                      : "bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black border-transparent"
                  }`}
                >
                  {isRecording ? (
                    <>
                      <MicOff size={14} /> Pause Transcribing
                    </>
                  ) : (
                    <>
                      <Mic size={14} /> Resume Transcribing
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* End Session Button */}
          <div className="pt-6">
            <button
              onClick={handleEndSession}
              className="w-full bg-red-500/10 hover:bg-red-500 border border-red-500/20 hover:border-red-500 text-red-500 hover:text-white text-xs font-bold py-3 rounded transition-colors cursor-pointer text-center"
            >
              End Lecture & Generate Summary
            </button>
          </div>
        </div>

        {/* Center Column (2/4): Live Log Capture */}
        <div className="lg:col-span-2 flex flex-col gap-6 h-full">
          <div className="border border-[var(--border)] rounded bg-[var(--surface)] p-6 text-left flex-1 flex flex-col min-h-[550px]">
            <h3 className="font-bold text-xs tracking-wider uppercase text-[var(--text-muted)] mb-4">
              Real-time Capture Log
            </h3>

            {/* Scrollable Log */}
            <div className="flex-1 overflow-y-auto border border-[var(--border)] rounded bg-[var(--background)] p-4 space-y-4 max-h-[450px]">
              {activeSession.transcript.length === 0 && !interimTranscript ? (
                <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] py-24">
                  <Mic size={28} className="mb-2 stroke-1 text-[var(--text-muted)]" />
                  <p className="text-xs font-semibold">No speech captured yet.</p>
                  <p className="text-[10px] mt-1 text-center max-w-xs leading-relaxed">Type below or speak into your microphone to send lines.</p>
                </div>
              ) : (
                <>
                  {activeSession.transcript.map((line) => (
                    <div key={line.id} className="text-sm leading-relaxed border-b border-[var(--border)] pb-2 last:border-b-0">
                      <span className="text-[9px] font-mono text-[var(--text-muted)] block">
                        {new Date(line.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <p className="text-[var(--text)] mt-0.5">{line.text}</p>
                    </div>
                  ))}
                  
                  {/* Live speech interim drafting line */}
                  {interimTranscript && (
                    <div className="text-sm leading-relaxed pb-2 opacity-65 animate-pulse">
                      <span className="text-[9px] font-mono text-[var(--text-muted)] block">Drafting...</span>
                      <p className="text-[var(--text)] mt-0.5 italic">{interimTranscript}</p>
                    </div>
                  )}
                </>
              )}
              <div ref={transcriptEndRef} />
            </div>

            {/* Custom Input */}
            <form onSubmit={handleSendCustom} className="mt-4 flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                disabled={!isRecording}
                placeholder={isRecording ? "Type custom speech input here..." : "Microphone paused"}
                className="flex-1 text-xs px-3 py-2 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--text)] focus:outline-none focus:border-[var(--primary)] disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={!isRecording || !customText.trim()}
                className="p-2 bg-[var(--text)] hover:bg-[var(--text-muted)] disabled:bg-gray-700 disabled:text-gray-400 text-[var(--background)] rounded transition-colors disabled:cursor-not-allowed cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column (1/4): Vocabulary Management */}
        <div className="lg:col-span-1 space-y-6 h-full">
          <div className="border border-[var(--border)] rounded bg-[var(--surface)] p-6 text-left space-y-4">
            <h3 className="font-bold text-xs tracking-wider uppercase text-[var(--text-muted)] flex justify-between items-center">
              <span>Session Vocabulary</span>
              <span className="text-[10px] font-mono text-[var(--text-muted)] bg-[var(--background)] px-1.5 py-0.5 rounded border border-[var(--border)] font-semibold">
                {activeSession.customVocab?.length || 0} active
              </span>
            </h3>
            
            {/* Form to add term */}
            <form onSubmit={handleAddSessionTerm} className="space-y-2 border-b border-[var(--border)] pb-4 pt-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Trigger"
                  value={sessionKeyword}
                  onChange={(e) => setSessionKeyword(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
                />
                <input
                  type="text"
                  placeholder="Aliases"
                  value={sessionAliases}
                  onChange={(e) => setSessionAliases(e.target.value)}
                  className="w-20 px-2.5 py-1.5 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)] font-mono"
                />
              </div>
              <input
                type="text"
                required
                placeholder="Student Definition"
                value={sessionDefinition}
                onChange={(e) => setSessionDefinition(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[var(--border)] rounded bg-[var(--background)] text-[var(--text)] text-xs focus:outline-none focus:border-[var(--primary)]"
              />
              <button
                type="submit"
                className="w-full bg-[var(--primary)] hover:bg-[var(--primary-hover)] text-black font-semibold py-1.5 rounded text-[10px] transition-colors cursor-pointer"
              >
                + Add Active Trigger
              </button>
            </form>

            {/* Scrollable list of active terms */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {(!activeSession.customVocab || activeSession.customVocab.length === 0) ? (
                <p className="text-[10px] text-[var(--text-muted)] italic py-2">
                  No vocabulary triggers active. Add baseline keywords in Settings or add a temporary one above.
                </p>
              ) : (
                activeSession.customVocab.map((term, idx) => (
                  <div key={idx} className="p-2.5 border border-[var(--border)] rounded bg-[var(--background)] text-xs hover:border-[var(--text-muted)] transition-colors">
                    <div className="flex justify-between items-baseline flex-wrap gap-1">
                      <strong className="text-[var(--text)] font-mono">{term.keyword}</strong>
                      {term.aliases && (
                        <span className="text-[8px] text-[var(--text-muted)] font-mono">({term.aliases})</span>
                      )}
                    </div>
                    <p className="text-[9px] text-[var(--text-muted)] mt-1 leading-relaxed">{term.definition}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
