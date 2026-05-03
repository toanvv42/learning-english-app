"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_RECORDING_SECONDS } from "@/lib/audioLimits";

type RecorderProps = {
  disabled?: boolean;
  onRecordingComplete: (blob: Blob) => void;
};

export function Recorder({ disabled = false, onRecordingComplete }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const stopRequestedRef = useRef(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  function clearRecordingTimers() {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  async function startRecording() {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined,
      });

      chunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      stopRequestedRef.current = false;
      setElapsedSeconds(0);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimers();
        const inferredType = recorder.mimeType || (chunksRef.current[0] instanceof Blob ? chunksRef.current[0].type : "") || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: inferredType });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        stopRequestedRef.current = false;
        setIsRecording(false);
        onRecordingComplete(blob);
      };

      recorder.start();
      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((current) => Math.min(current + 1, MAX_RECORDING_SECONDS));
      }, 1000);
      timeoutRef.current = window.setTimeout(() => {
        setError(`Recording stopped at ${MAX_RECORDING_SECONDS} seconds. Try one sentence at a time.`);
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
      setIsRecording(true);
    } catch {
      setError("Microphone permission was denied or unavailable.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    if (stopRequestedRef.current) {
      return;
    }

    clearRecordingTimers();
    const recorder = mediaRecorderRef.current;

    if (recorder?.state === "recording") {
      stopRequestedRef.current = true;
      recorder.requestData();
      recorder.stop();
      return;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    stopRequestedRef.current = false;
    setIsRecording(false);
  }

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-5 sm:py-8">
      <div className="relative">
        {isRecording && (
          <div className="pointer-events-none absolute inset-0 animate-ping rounded-full bg-destructive/20" />
        )}
        <Button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled && !isRecording}
          variant={isRecording ? "destructive" : "default"}
          className={`h-20 w-20 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 sm:h-24 sm:w-24 ${
            isRecording ? "ring-4 ring-destructive/20" : "bg-moss hover:bg-moss/90"
          }`}
        >
          {isRecording ? (
            <Square className="h-8 w-8 fill-current sm:h-10 sm:w-10" />
          ) : (
            <Mic className="h-8 w-8 sm:h-10 sm:w-10" />
          )}
        </Button>
      </div>
      
      <p className={`mt-4 text-sm font-medium transition-colors duration-300 sm:mt-6 ${
        isRecording ? "text-destructive animate-pulse" : "text-muted-foreground"
      }`}>
        {isRecording
          ? `Listening... ${Math.max(MAX_RECORDING_SECONDS - elapsedSeconds, 0)}s left`
          : "Tap to start recording"}
      </p>

      {error ? (
        <p className="mt-4 rounded-full bg-destructive/10 px-4 py-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
