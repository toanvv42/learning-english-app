"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Crown, RotateCcw, Settings, Volume2 } from "lucide-react";
import { FeedbackCard } from "@/components/FeedbackCard";
import { Recorder } from "@/components/Recorder";
import { TargetSentence } from "@/components/TargetSentence";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { AIFeedback, PronunciationAssessment } from "@/types/feedback";
import { DEFAULT_GEMINI_MODEL, GEMINI_MODELS, type GeminiModel } from "@/lib/gemini/models";
import { formatAudioLimit, MAX_AUDIO_BYTES, MAX_RECORDING_SECONDS } from "@/lib/audioLimits";
import { generateFeedbackWithBrowserGemini, transcribeWithBrowserGemini } from "./browserGemini";

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
  | "assessing"
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

type PronunciationAssessmentResponse = {
  assessment: PronunciationAssessment;
};

type PronunciationProvider = "self-hosted" | "azure";

type PronunciationConfigResponse = {
  defaultProvider: PronunciationProvider;
  providers: Record<PronunciationProvider, { enabled: boolean; pro: boolean }>;
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

const topics = [
  { value: "all", label: "All topics" },
  { value: "devops", label: "DevOps" },
  { value: "cloud", label: "Cloud" },
  { value: "daily", label: "Daily life" },
  { value: "work", label: "Work" },
  { value: "meetings", label: "Meetings" },
  { value: "interviews", label: "Interviews" },
  { value: "travel", label: "Travel" },
  { value: "social", label: "Social" },
  { value: "shopping", label: "Shopping" },
];

const focuses = [
  { value: "all", label: "All focus" },
  { value: "general_fluency", label: "General Fluency" },
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

const PERSONAL_GEMINI_KEY_STORAGE_KEY = "learningEnglishPersonalGeminiKey";
const PRONUNCIATION_PROVIDER_STORAGE_KEY = "learningEnglishPronunciationProvider";

const pronunciationProviders: Array<{
  value: PronunciationProvider;
  label: string;
  description: string;
}> = [
  {
    value: "self-hosted",
    label: "Self-hosted",
    description: "Use the local pronunciation API.",
  },
  {
    value: "azure",
    label: "Azure Speech",
    description: "Use Azure pronunciation assessment.",
  },
];

export function PracticeClient({ items }: PracticeClientProps) {
  const [itemIndex, setItemIndex] = useState(0);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [pronunciationAssessment, setPronunciationAssessment] =
    useState<PronunciationAssessment | null>(null);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [topic, setTopic] = useState("all");
  const [focus, setFocus] = useState("all");
  const saveAudio = false;
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [sessionGeminiApiKey, setSessionGeminiApiKey] = useState("");
  const [geminiKeyStatus, setGeminiKeyStatus] = useState<string | null>(null);
  const [rememberPersonalGeminiKey, setRememberPersonalGeminiKey] = useState(true);
  const [geminiModel, setGeminiModel] = useState<GeminiModel>(DEFAULT_GEMINI_MODEL);
  const [pronunciationProvider, setPronunciationProvider] =
    useState<PronunciationProvider>("self-hosted");
  const [pronunciationConfig, setPronunciationConfig] =
    useState<PronunciationConfigResponse | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const geminiKeyInputRef = useRef<HTMLInputElement>(null);

  const filteredItems = items.filter((practiceItem) => {
    const matchesTopic = topic === "all" || practiceItem.tags.includes(topic);
    const matchesFocus = focus === "all" || practiceItem.tags.includes(focus);
    return matchesTopic && matchesFocus;
  });
  const activeItems = filteredItems.length > 0 ? filteredItems : items;
  const item = activeItems[itemIndex] ?? activeItems[0];
  const isBusy =
    step === "saving" || step === "transcribing" || step === "assessing" || step === "generating";

  function clearAttemptState() {
    setStep("idle");
    setError(null);
    setTranscript(null);
    setFeedback(null);
    setPronunciationAssessment(null);
    setRecordingUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return null;
    });
  }

  useEffect(() => {
    const savedModel = window.localStorage.getItem("learningEnglishGeminiModel") as GeminiModel;
    const savedTopic = window.localStorage.getItem("learningEnglishPracticeTopic");
    const savedFocus = window.localStorage.getItem("learningEnglishPracticeFocus");
    const savedPronunciationProvider = window.localStorage.getItem(PRONUNCIATION_PROVIDER_STORAGE_KEY);
    const savedPersonalGeminiKey = window.localStorage.getItem(PERSONAL_GEMINI_KEY_STORAGE_KEY);

    if (savedModel && GEMINI_MODELS.some((m) => m.value === savedModel)) {
      setGeminiModel(savedModel);
    } else {
      setShowConfig(true);
    }

    if (savedTopic && topics.some((t) => t.value === savedTopic)) {
      setTopic(savedTopic);
    }

    if (savedFocus && focuses.some((f) => f.value === savedFocus)) {
      setFocus(savedFocus);
    }

    if (
      savedPronunciationProvider === "self-hosted" ||
      savedPronunciationProvider === "azure"
    ) {
      setPronunciationProvider(savedPronunciationProvider);
    }

    if (savedPersonalGeminiKey) {
      setGeminiKeyInput(savedPersonalGeminiKey);
      setSessionGeminiApiKey(savedPersonalGeminiKey);
      setRememberPersonalGeminiKey(true);
      setGeminiKeyStatus("Personal Gemini key loaded from this device.");
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadPronunciationConfig() {
      try {
        const response = await fetch("/api/pronunciation-config");
        const config = await parseApiResponse<PronunciationConfigResponse>(
          response,
          "Could not load pronunciation provider configuration.",
        );

        if (!isMounted) {
          return;
        }

        setPronunciationConfig(config);

        const savedProvider = window.localStorage.getItem(PRONUNCIATION_PROVIDER_STORAGE_KEY);
        if (
          (savedProvider !== "self-hosted" && savedProvider !== "azure") ||
          !config.providers[savedProvider].enabled
        ) {
          setPronunciationProvider(
            config.providers[config.defaultProvider].enabled ? config.defaultProvider : "self-hosted",
          );
        }
      } catch {
        if (isMounted) {
          setPronunciationConfig(null);
        }
      }
    }

    void loadPronunciationConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (recordingUrl) {
        URL.revokeObjectURL(recordingUrl);
      }
    };
  }, [recordingUrl]);

  function usePersonalGeminiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextKey = getPersonalGeminiKeyFromInput();
    if (!nextKey) {
      setGeminiKeyStatus("Paste a Gemini API key before using it.");
      return;
    }

    setSessionGeminiApiKey(nextKey);
    setGeminiKeyInput(nextKey);
    if (rememberPersonalGeminiKey) {
      window.localStorage.setItem(PERSONAL_GEMINI_KEY_STORAGE_KEY, nextKey);
      setGeminiKeyStatus("Personal Gemini key is active and remembered on this device.");
    } else {
      window.localStorage.removeItem(PERSONAL_GEMINI_KEY_STORAGE_KEY);
      setGeminiKeyStatus("Personal Gemini key is active for this browser tab.");
    }
  }

  function getPersonalGeminiKeyFromInput() {
    return (geminiKeyInputRef.current?.value || geminiKeyInput).trim();
  }

  function getActivePersonalGeminiKey() {
    const activeKey = sessionGeminiApiKey || getPersonalGeminiKeyFromInput();

    if (activeKey && activeKey !== sessionGeminiApiKey) {
      setSessionGeminiApiKey(activeKey);
      setGeminiKeyStatus("Personal Gemini key is active for this browser tab.");
    }

    return activeKey;
  }

  function clearPersonalGeminiKey() {
    setSessionGeminiApiKey("");
    setGeminiKeyInput("");
    window.localStorage.removeItem(PERSONAL_GEMINI_KEY_STORAGE_KEY);
    if (geminiKeyInputRef.current) {
      geminiKeyInputRef.current.value = "";
    }
    setGeminiKeyStatus("Personal Gemini key cleared from this device.");
  }

  function saveConfig() {
    window.localStorage.setItem("learningEnglishGeminiModel", geminiModel);
    window.localStorage.setItem("learningEnglishPracticeTopic", topic);
    window.localStorage.setItem("learningEnglishPracticeFocus", focus);
    window.localStorage.setItem(PRONUNCIATION_PROVIDER_STORAGE_KEY, pronunciationProvider);
    setShowConfig(false);
    setItemIndex(0);
    clearAttemptState();
  }

  async function handleRecordingComplete(blob: Blob) {
    if (blob.size > MAX_AUDIO_BYTES) {
      setError(
        `Recording is too large. Keep it under ${MAX_RECORDING_SECONDS} seconds and ${formatAudioLimit()}.`,
      );
      setStep("error");
      return;
    }

    setStep(saveAudio ? "saving" : "transcribing");
    setError(null);
    setTranscript(null);
    setFeedback(null);
    setPronunciationAssessment(null);
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
        const contentType = blob.type || "audio/wav";
        const uploadUrlResponse = await fetch("/api/upload-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentType }),
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
            headers: { "Content-Type": contentType },
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
      const assessmentPromise = (async () => {
        try {
          const assessmentResponse = objectKey
            ? await fetch("/api/pronunciation-assess", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  objectKey,
                  targetSentence: item.content,
                  language: "en-us",
                  provider: pronunciationProvider,
                }),
              })
            : await fetch("/api/pronunciation-assess", {
                method: "POST",
                body: (() => {
                  const formData = new FormData();
                  formData.append("audio", blob, "recording.wav");
                  formData.append("targetSentence", item.content);
                  formData.append("language", "en-us");
                  formData.append("provider", pronunciationProvider);
                  return formData;
                })(),
              });
          const assessed = await parseApiResponse<PronunciationAssessmentResponse>(
            assessmentResponse,
            "Could not assess pronunciation.",
          );
          return assessed.assessment;
        } catch (assessmentError) {
          console.warn("Pronunciation assessment skipped.", assessmentError);
          return null;
        }
      })();
      const personalGeminiApiKey = getActivePersonalGeminiKey();
      const transcriptText = await (async () => {
        if (personalGeminiApiKey) {
          return transcribeWithBrowserGemini(blob, personalGeminiApiKey, geminiModel);
        }

        const formData = new FormData();
        formData.append("audio", blob, "recording.wav");
        formData.append("model", geminiModel);
        const transcribeResponse = objectKey
          ? await fetch("/api/transcribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ objectKey, model: geminiModel }),
            })
          : await fetch("/api/transcribe", {
              method: "POST",
              body: formData,
            });
        const transcribed = await parseApiResponse<TranscribeResponse>(
          transcribeResponse,
          "Could not transcribe audio.",
        );
        return transcribed.transcript;
      })();
      setTranscript(transcriptText);

      setStep("assessing");
      const assessedPronunciation = await assessmentPromise;
      setPronunciationAssessment(assessedPronunciation);

      setStep("generating");
      const personalFeedback = personalGeminiApiKey
        ? await generateFeedbackWithBrowserGemini({
            apiKey: personalGeminiApiKey,
            targetText: item.content,
            transcript: transcriptText,
            model: geminiModel,
            pronunciationAssessment: assessedPronunciation,
          })
        : null;
      const feedbackResponse = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: item.id,
          targetText: item.content,
          transcript: transcriptText,
          audioUrl,
          feedback: personalFeedback,
          pronunciationAssessment: assessedPronunciation,
          model: geminiModel,
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

  return (
    <div className="mx-auto w-full max-w-3xl py-1 sm:px-4 sm:py-8">
      {showConfig ? (
        <Card className="border-none bg-white/70 shadow-2xl backdrop-blur-xl ring-1 ring-black/5">
          <CardContent className="space-y-8 p-8 sm:p-12">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-moss/10 text-moss">
                <Settings className="h-8 w-8" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Configuration</h2>
              <p className="mt-3 text-muted-foreground">
                {typeof window !== "undefined" && window.localStorage.getItem("learningEnglishGeminiModel")
                  ? "Refine your practice experience."
                  : "Welcome! Let's get everything ready for your first practice session."}
              </p>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-widest text-moss/70">
                    Topic
                  </label>
                  <select
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className="h-12 w-full rounded-xl border-none bg-field px-4 text-base shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
                  >
                    {topics.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase tracking-widest text-moss/70">
                    Focus
                  </label>
                  <select
                    value={focus}
                    onChange={(event) => setFocus(event.target.value)}
                    className="h-12 w-full rounded-xl border-none bg-field px-4 text-base shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
                  >
                    {focuses.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest text-moss/70">
                  Gemini Model
                </label>
                <select
                  value={geminiModel}
                  onChange={(event) => setGeminiModel(event.target.value as GeminiModel)}
                  className="h-12 w-full rounded-xl border-none bg-field px-4 text-base shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
                >
                  {GEMINI_MODELS.map((option) => (
                    <option value={option.value} key={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Gemini 2.5 Flash is recommended for the best balance of speed and accuracy.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold uppercase tracking-widest text-moss/70">
                  Pronunciation Provider
                </label>
                <select
                  value={pronunciationProvider}
                  onChange={(event) => setPronunciationProvider(event.target.value as PronunciationProvider)}
                  className="h-12 w-full rounded-xl border-none bg-field px-4 text-base shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
                >
                  {pronunciationProviders.map((option) => {
                    const config = pronunciationConfig?.providers[option.value];
                    const isDisabled = config ? !config.enabled : option.value === "azure";

                    return (
                      <option value={option.value} key={option.value} disabled={isDisabled}>
                        {option.label}
                        {config?.pro ? " Pro" : ""}
                        {isDisabled ? " unavailable" : ""}
                      </option>
                    );
                  })}
                </select>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    {
                      pronunciationProviders.find((option) => option.value === pronunciationProvider)
                        ?.description
                    }
                  </span>
                  {pronunciationConfig?.providers[pronunciationProvider]?.pro && (
                    <Badge variant="secondary" className="gap-1 bg-copper/10 text-copper ring-1 ring-copper/20">
                      <Crown className="h-3 w-3" />
                      Pro
                    </Badge>
                  )}
                </div>
              </div>

              <div className="rounded-2xl bg-field p-6 ring-1 ring-black/5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <label className="text-sm font-bold uppercase tracking-widest text-moss/70">
                      Personal Gemini Key
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used directly from this browser so Cloudflare never receives your key.
                    </p>
                  </div>
                  {sessionGeminiApiKey && (
                    <Badge variant="secondary" className="bg-moss/10 text-moss ring-1 ring-moss/20">
                      Active
                    </Badge>
                  )}
                </div>
                
                <form className="flex flex-col gap-3" autoComplete="on" onSubmit={usePersonalGeminiKey}>
                  <input
                    type="text"
                    name="username"
                    autoComplete="username"
                    value="Gemini API Key"
                    readOnly
                    hidden
                  />
                  <input
                    id="gemini-api-key"
                    ref={geminiKeyInputRef}
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={geminiKeyInput}
                    onChange={(event) => setGeminiKeyInput(event.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="h-11 rounded-xl border-none bg-white px-4 text-sm shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
                  />
                  <label className="flex items-start gap-3 rounded-xl bg-white/70 p-3 text-xs text-muted-foreground ring-1 ring-black/5">
                    <input
                      type="checkbox"
                      checked={rememberPersonalGeminiKey}
                      onChange={(event) => setRememberPersonalGeminiKey(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-none text-moss ring-1 ring-black/10 focus:ring-2 focus:ring-moss"
                    />
                    <span>
                      Remember this key on this device for convenience. Clear it before using a shared computer.
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <Button 
                      type="submit" 
                      variant="secondary" 
                      className="flex-1 rounded-xl bg-white text-moss hover:bg-white/80" 
                      disabled={isBusy}
                    >
                      Use Key
                    </Button>
                    {sessionGeminiApiKey && (
                      <Button 
                        type="button" 
                        variant="ghost" 
                        className="rounded-xl text-destructive hover:bg-destructive/5 hover:text-destructive" 
                        onClick={clearPersonalGeminiKey}
                        disabled={isBusy}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </form>
                {geminiKeyStatus && (
                  <p className="mt-3 text-xs text-moss/70">{geminiKeyStatus}</p>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  Restrict this key in Google AI Studio to <span className="font-mono">https://app.tinywins.us/*</span> and your local test origin.
                </p>
              </div>

            </div>

            <Button 
              className="h-14 w-full rounded-2xl bg-moss text-lg font-bold text-white shadow-xl shadow-moss/20 hover:bg-moss/90 hover:shadow-2xl hover:shadow-moss/30" 
              onClick={saveConfig}
              disabled={isBusy}
            >
              Save and Continue
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-700 sm:space-y-8">
          <div className="flex items-center justify-between gap-3 rounded-[1.35rem] bg-white/55 p-2.5 shadow-sm ring-1 ring-black/5 backdrop-blur-sm sm:rounded-[1.75rem] sm:p-3 sm:px-4">
            <div className="flex min-w-0 flex-1 gap-2 sm:flex-wrap">
              <Badge variant="secondary" className="min-w-0 justify-center truncate rounded-full bg-moss/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-moss/60 ring-1 ring-moss/10">
                {topics.find((t) => t.value === topic)?.label}
              </Badge>
              <Badge variant="secondary" className="hidden min-w-0 justify-center truncate rounded-full bg-moss/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-moss/60 ring-1 ring-moss/10 sm:inline-flex">
                {focuses.find((f) => f.value === focus)?.label}
              </Badge>
              <Badge variant="secondary" className="min-w-0 max-w-[15rem] justify-center truncate rounded-full bg-moss/10 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-moss ring-1 ring-moss/20 sm:px-4 sm:py-1.5">
                {GEMINI_MODELS.find((m) => m.value === geminiModel)?.label || geminiModel}
              </Badge>
              <Badge variant="secondary" className="hidden min-w-0 justify-center gap-1 truncate rounded-full bg-moss/5 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-moss/60 ring-1 ring-moss/10 sm:inline-flex">
                {pronunciationProvider === "azure" && <Crown className="h-3 w-3 text-copper" />}
                {pronunciationProviders.find((provider) => provider.value === pronunciationProvider)?.label}
              </Badge>
              {sessionGeminiApiKey && (
                <Badge variant="secondary" className="hidden min-w-0 justify-center truncate rounded-full bg-copper/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-copper ring-1 ring-copper/20 sm:inline-flex">
                  Personal Key
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="group flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 text-moss hover:bg-moss/5 sm:w-auto sm:px-4"
              onClick={() => setShowConfig(true)}
              disabled={isBusy}
              aria-label="Open practice configuration"
            >
              <Settings className="h-4 w-4 transition-transform group-hover:rotate-45" />
              <span className="hidden text-sm font-black uppercase tracking-widest sm:inline">Config</span>
            </Button>
          </div>

          <div className="space-y-6">
            {filteredItems.length === 0 && (
              <Alert className="rounded-2xl border-none bg-copper/10 text-copper ring-1 ring-copper/20">
                <AlertDescription className="text-xs font-bold uppercase tracking-widest">
                  Showing all sentences until more seeds are added for this topic/focus.
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="space-y-6 sm:space-y-8">
            <div className="group relative">
              <div className="absolute -inset-1 rounded-[2.5rem] bg-gradient-to-r from-moss/20 to-copper/20 opacity-0 blur transition duration-1000 group-hover:opacity-100 group-hover:duration-200" />
              <div className="relative">
                <TargetSentence text={item.content} />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 sm:gap-6">
              <div className="flex flex-wrap items-center justify-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-moss/40 sm:text-sm">
                <span>Sentence {itemIndex + 1} of {activeItems.length}</span>
                <div className="h-1 w-1 rounded-full bg-moss/20" />
                <Button
                  type="button"
                  onClick={nextSentence}
                  disabled={isBusy || activeItems.length <= 1}
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 text-moss hover:bg-transparent hover:text-moss/80"
                >
                  Skip
                </Button>
              </div>

              <Recorder disabled={isBusy} onRecordingComplete={handleRecordingComplete} />
            </div>
          </div>

          {isBusy && (
            <div className="flex flex-col items-center py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="mb-4 h-1 w-48 overflow-hidden rounded-full bg-moss/10">
                <div className="h-full w-1/3 animate-[progress_2s_ease-in-out_infinite] rounded-full bg-moss" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-moss/60">
                {step === "saving"
                  ? "Saving audio..."
                  : step === "transcribing"
                    ? "Transcribing..."
                    : step === "assessing"
                      ? "Checking sounds..."
                    : "Analyzing pronunciation..."}
              </p>
            </div>
          )}

          <div className="space-y-6">
            {recordingUrl && (
              <Card className="overflow-hidden border-none bg-white/50 shadow-sm backdrop-blur-sm ring-1 ring-black/5">
                <CardContent className="p-4">
                  <div className="mb-3 flex items-center gap-2 px-2">
                    <Volume2 className="h-3 w-3 text-moss/60" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-moss/60">Review recording</span>
                  </div>
                  <audio controls src={recordingUrl} className="h-10 w-full" />
                </CardContent>
              </Card>
            )}

            {transcript && (
              <div className="px-6 text-center">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-moss/40">Gemini heard</p>
                <p className="text-xl font-medium text-foreground/80">&quot;{transcript}&quot;</p>
              </div>
            )}

            {feedback && (
              <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                <FeedbackCard feedback={feedback} pronunciationAssessment={pronunciationAssessment} />
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="rounded-2xl border-none shadow-lg shadow-destructive/10">
                <AlertTitle className="text-sm font-bold uppercase tracking-widest">Error</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {(step === "complete" || step === "error") && (
              <Button
                type="button"
                onClick={resetAttempt}
                variant="outline"
                size="lg"
                className="h-16 w-full rounded-2xl border-none bg-white shadow-xl shadow-black/5 ring-1 ring-black/5 transition-all hover:scale-[1.02] hover:bg-white active:scale-[0.98]"
              >
                <RotateCcw className="mr-2 h-5 w-5 text-moss" />
                <span className="text-lg font-bold text-moss">Try another attempt</span>
              </Button>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  );
}
