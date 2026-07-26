import { useEffect, useRef, useState } from "react";

interface UseSpeechToTextProps {
  onFinalResult: (text: string) => void;
}

export const useSpeechToText = ({ onFinalResult }: UseSpeechToTextProps) => {
  const [isListening, setIsListening] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [hasSupport, setHasSupport] = useState(false);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setHasSupport(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interimText = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            const text = result[0].transcript.trim();
            if (text) {
              onFinalResult(text);
            }
          } else {
            interimText += result[0].transcript;
          }
        }
        setInterimTranscript(interimText);
      };

      recognition.onerror = (event: any) => {
        console.error("Speech Recognition Error:", event.error);
        if (event.error === "not-allowed") {
          setIsListening(false);
          isListeningRef.current = false;
        }
      };

      recognition.onend = () => {
        // Automatically restart if it was ended unexpectedly while we are in listening state
        if (isListeningRef.current) {
          try {
            recognition.start();
          } catch (e) {
            console.error("Failed to restart speech recognition:", e);
          }
        }
      };

      recognitionRef.current = recognition;
    }
  }, [onFinalResult]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setIsListening(true);
    isListeningRef.current = true;
    setInterimTranscript("");
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Start speech recognition failed:", e);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    setIsListening(false);
    isListeningRef.current = false;
    setInterimTranscript("");
    try {
      recognitionRef.current.stop();
    } catch (e) {
      console.error("Stop speech recognition failed:", e);
    }
  };

  return {
    isListening,
    interimTranscript,
    startListening,
    stopListening,
    hasSupport
  };
};
