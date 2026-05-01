"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

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

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        setIsRecording(false);
        onRecordingComplete(blob);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setError("Microphone permission was denied or unavailable.");
      setIsRecording(false);
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className="relative">
        {isRecording && (
          <div className="absolute inset-0 animate-ping rounded-full bg-destructive/20" />
        )}
        <Button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled && !isRecording}
          variant={isRecording ? "destructive" : "default"}
          className={`h-24 w-24 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 ${
            isRecording ? "ring-4 ring-destructive/20" : "bg-moss hover:bg-moss/90"
          }`}
        >
          {isRecording ? (
            <Square className="h-10 w-10 fill-current" />
          ) : (
            <Mic className="h-10 w-10" />
          )}
        </Button>
      </div>
      
      <p className={`mt-6 text-sm font-medium transition-colors duration-300 ${
        isRecording ? "text-destructive animate-pulse" : "text-muted-foreground"
      }`}>
        {isRecording ? "Listening... Speak now" : "Tap to start recording"}
      </p>

      {error ? (
        <p className="mt-4 rounded-full bg-destructive/10 px-4 py-1 text-xs font-semibold text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
