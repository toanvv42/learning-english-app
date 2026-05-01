"use client";

import { useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
    <Card>
      <CardContent className="p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">Recorder</p>
          <p className="mt-1 text-sm text-stone-600">
            {isRecording ? "Recording now. Read the target sentence clearly." : "Ready to record."}
          </p>
        </div>
        {isRecording ? (
          <Button
            type="button"
            onClick={stopRecording}
            variant="destructive"
            size="lg"
            className="w-full sm:w-auto"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        ) : (
          <Button
            type="button"
            onClick={startRecording}
            disabled={disabled}
            size="lg"
            className="w-full sm:w-auto"
          >
            <Mic className="h-4 w-4" />
            Record
          </Button>
        )}
      </div>
      {error ? <p className="mt-3 text-sm font-medium text-red-700">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
