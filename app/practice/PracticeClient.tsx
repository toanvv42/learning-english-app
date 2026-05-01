"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save, SkipForward, SlidersHorizontal, Volume2 } from "lucide-react";
import { FeedbackCard } from "@/components/FeedbackCard";
import { Recorder } from "@/components/Recorder";
import { TargetSentence } from "@/components/TargetSentence";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AIFeedback } from "@/types/feedback";

type PracticeItem = {
  id: string | null;
  content: string;
  tags: string[];
};

type PracticeClientProps = {
  items: PracticeItem[];
};

type Step =
  | "idle"
  | "saving"
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
  const [topic, setTopic] = useState("all");
  const [focus, setFocus] = useState("all");
  const [saveAudio, setSaveAudio] = useState(false);

  const topics = [
    { value: "all", label: "All topics" },
    { value: "devops", label: "DevOps" },
    { value: "cloud", label: "Cloud" },
    { value: "daily", label: "Daily life" },
    { value: "work", label: "Work" },
    { value: "meetings", label: "Meetings" },
    { value: "interviews", label: "Interviews" },
    { value: "travel", label: "Travel" },
  ];
  const focuses = [
    { value: "all", label: "All focus" },
    { value: "ending_d", label: "Final /d/" },
    { value: "ending_t", label: "Final /t/" },
    { value: "ending_s", label: "Final /s/" },
    { value: "past_tense", label: "-ed endings" },
    { value: "plural_s", label: "Plural -s" },
    { value: "theta", label: "TH sound" },
    { value: "sh", label: "SH sound" },
    { value: "ch", label: "CH sound" },
    { value: "minimal_pair", label: "Minimal pairs" },
  ];
  const filteredItems = items.filter((practiceItem) => {
    const matchesTopic = topic === "all" || practiceItem.tags.includes(topic);
    const matchesFocus = focus === "all" || practiceItem.tags.includes(focus);
    return matchesTopic && matchesFocus;
  });
  const activeItems = filteredItems.length > 0 ? filteredItems : items;
  const item = activeItems[itemIndex] ?? activeItems[0];
  const isBusy = step === "saving" || step === "transcribing" || step === "generating";

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
    setStep(saveAudio ? "saving" : "transcribing");
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
      let audioUrl: string | null = null;
      let objectKey: string | null = null;

      if (saveAudio) {
        const uploadUrlResponse = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType: "audio/webm" }),
        });
        const upload = await parseApiResponse<UploadResponse>(
          uploadUrlResponse,
          "Could not create an R2 upload URL.",
        );
        audioUrl = upload.audioUrl;
        objectKey = upload.objectKey;

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
      }

      setStep("transcribing");
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const transcribeResponse = objectKey
        ? await fetch("/api/transcribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ objectKey }),
          })
        : await fetch("/api/transcribe", {
            method: "POST",
            body: formData,
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
          audioUrl,
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
    setItemIndex((current) => (current + 1) % activeItems.length);
  }

  function updateTopic(value: string) {
    clearAttemptState();
    setTopic(value);
    setItemIndex(0);
  }

  function updateFocus(value: string) {
    clearAttemptState();
    setFocus(value);
    setItemIndex(0);
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-moss" />
            <p className="text-xs font-semibold uppercase tracking-wider text-moss">Practice settings</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Topic</span>
              <select
                value={topic}
                onChange={(event) => updateTopic(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {topics.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium text-foreground">Focus</span>
              <select
                value={focus}
                onChange={(event) => updateFocus(event.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              >
                {focuses.map((option) => (
                  <option value={option.value} key={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Save className="h-4 w-4 text-moss" />
              Save audio to R2
            </span>
            <input
              type="checkbox"
              checked={saveAudio}
              onChange={(event) => setSaveAudio(event.target.checked)}
              className="h-4 w-4 accent-moss"
            />
          </label>
          {filteredItems.length === 0 ? (
            <Alert>
              <AlertTitle>No exact match</AlertTitle>
              <AlertDescription>Showing all sentences until more seed items are added for this combination.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <TargetSentence text={item.content} />
      <div className="flex flex-wrap gap-2">
        {item.tags.map((tag) => (
          <Badge key={tag} variant="outline">
            {tag.replaceAll("_", " ")}
          </Badge>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Sentence {itemIndex + 1} of {activeItems.length}
        </p>
        <Button
          type="button"
          onClick={nextSentence}
          disabled={isBusy || activeItems.length <= 1}
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
            {step === "saving"
              ? "Saving audio to R2..."
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
