"use client";

import { useEffect, useState } from "react";
import { RotateCcw, SkipForward, Volume2 } from "lucide-react";
import { FeedbackCard } from "@/components/FeedbackCard";
import { Recorder } from "@/components/Recorder";
import { TargetSentence } from "@/components/TargetSentence";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AIFeedback } from "@/types/feedback";

type PracticeItem = {
  id: string | null;
  content: string;
};

type PracticeClientProps = {
  items: PracticeItem[];
};

type Step =
  | "idle"
  | "uploading"
  | "transcribing"
  | "generating"
  | "complete"
  | "error";

type UploadResponse = {
  uploadUrl: string;
  audioUrl: string;
  objectKey: string;
};

type TranscribeResponse = {
  transcript: string;
};

type FeedbackResponse = {
  recordingId: string;
  feedback: AIFeedback;
};

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message =
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : fallbackMessage;
    throw new Error(message);
  }

  return body as T;
}

export function PracticeClient({ items }: PracticeClientProps) {
  const [itemIndex, setItemIndex] = useState(0);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);

  const item = items[itemIndex] ?? items[0];
  const isBusy = step === "uploading" || step === "transcribing" || step === "generating";

  function clearAttemptState() {
    setStep("idle");
    setError(null);
    setTranscript(null);
    setFeedback(null);
    setRecordingUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return null;
    });
  }

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  async function handleRecordingComplete(blob: Blob) {
    setStep("uploading");
    setError(null);
    setTranscript(null);
    setFeedback(null);
    setRecordingUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return URL.createObjectURL(blob);
    });

    try {
      const uploadUrlResponse = await fetch("/api/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "audio/webm" }),
      });
      const upload = await parseApiResponse<UploadResponse>(
        uploadUrlResponse,
        "Could not create an R2 upload URL.",
      );

      let uploadResponse: Response;

      try {
        uploadResponse = await fetch(upload.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "audio/webm" },
          body: blob,
        });
      } catch {
        throw new Error(
          "R2 upload failed before the server received audio. Check the R2 bucket CORS settings for this localhost origin.",
        );
      }

      if (!uploadResponse.ok) {
        throw new Error(`R2 upload failed with status ${uploadResponse.status}.`);
      }

      setStep("transcribing");
      const transcribeResponse = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectKey: upload.objectKey }),
      });
      const transcribed = await parseApiResponse<TranscribeResponse>(
        transcribeResponse,
        "Could not transcribe audio.",
      );
      setTranscript(transcribed.transcript);

      setStep("generating");
      const feedbackResponse = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          targetText: item.content,
          transcript: transcribed.transcript,
          audioUrl: upload.audioUrl,
        }),
      });
      const generated = await parseApiResponse<FeedbackResponse>(
        feedbackResponse,
        "Could not generate feedback.",
      );

      setFeedback(generated.feedback);
      setStep("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Practice attempt failed.");
      setStep("error");
    }
  }

  function resetAttempt() {
    clearAttemptState();
  }

  function nextSentence() {
    clearAttemptState();
    setItemIndex((current) => (current + 1) % items.length);
  }

  return (
    <div className="space-y-5">
      <TargetSentence text={item.content} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Sentence {itemIndex + 1} of {items.length}
        </p>
        <Button
          type="button"
          onClick={nextSentence}
          disabled={isBusy || items.length <= 1}
          variant="outline"
          size="sm"
        >
          <SkipForward className="h-4 w-4" />
          Next sentence
        </Button>
      </div>
      <Recorder disabled={isBusy} onRecordingComplete={handleRecordingComplete} />

      {recordingUrl ? (
        <Card>
          <CardContent className="p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-moss">
            <Volume2 className="h-4 w-4" />
            Your recording
          </p>
          <audio controls src={recordingUrl} className="mt-3 w-full" />
          </CardContent>
        </Card>
      ) : null}

      {isBusy ? (
        <Card>
          <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">Status</p>
          <p className="mt-2 text-foreground">
            {step === "uploading"
              ? "Uploading audio..."
              : step === "transcribing"
                ? "Transcribing speech..."
                : "Generating feedback..."}
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-2/3 animate-pulse rounded-full bg-moss" />
          </div>
          </CardContent>
        </Card>
      ) : null}

      {transcript ? (
        <Card>
          <CardContent className="p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">Transcript</p>
          <p className="mt-2 text-foreground">{transcript}</p>
          </CardContent>
        </Card>
      ) : null}

      {feedback ? <FeedbackCard feedback={feedback} /> : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === "complete" || step === "error" ? (
        <Button
          type="button"
          onClick={resetAttempt}
          variant="outline"
          size="lg"
          className="w-full"
        >
          <RotateCcw className="h-4 w-4" />
          Try another attempt
        </Button>
      ) : null}
    </div>
  );
}
