"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_RECORDING_SECONDS } from "@/lib/audioLimits";

type RecorderProps = {
  disabled?: boolean;
  onRecordingComplete: (blob: Blob) => void;
};

type WebkitAudioWindow = Window & typeof globalThis & {
  webkitAudioContext?: typeof AudioContext;
};

function encodeWav(samples: Float32Array[], inputSampleRate: number, outputSampleRate = 16000) {
  const totalLength = samples.reduce((sum, sample) => sum + sample.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const sample of samples) {
    merged.set(sample, offset);
    offset += sample.length;
  }

  const sampleRateRatio = inputSampleRate / outputSampleRate;
  const outputLength = Math.floor(merged.length / sampleRateRatio);
  const pcm = new Int16Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const sourceIndex = Math.min(Math.floor(index * sampleRateRatio), merged.length - 1);
    const sample = Math.max(-1, Math.min(1, merged[sourceIndex] ?? 0));
    pcm[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);

  function writeString(position: number, value: string) {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(position + index, value.charCodeAt(index));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputSampleRate, true);
  view.setUint32(28, outputSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, pcm.length * 2, true);

  for (let index = 0; index < pcm.length; index += 1) {
    view.setInt16(44 + index * 2, pcm[index] ?? 0, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

export function Recorder({ disabled = false, onRecordingComplete }: RecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const silenceGainRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
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
    let stream: MediaStream | null = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContextConstructor =
        window.AudioContext ?? (window as WebkitAudioWindow).webkitAudioContext;

      if (!AudioContextConstructor) {
        throw new Error("Audio recording is not supported in this browser.");
      }

      const audioContext = new AudioContextConstructor();
      const sourceNode = audioContext.createMediaStreamSource(stream);
      const processorNode = audioContext.createScriptProcessor(4096, 1, 1);
      const silenceGain = audioContext.createGain();

      chunksRef.current = [];
      streamRef.current = stream;
      audioContextRef.current = audioContext;
      sourceNodeRef.current = sourceNode;
      processorNodeRef.current = processorNode;
      silenceGainRef.current = silenceGain;
      stopRequestedRef.current = false;
      setElapsedSeconds(0);

      silenceGain.gain.value = 0;
      processorNode.onaudioprocess = (event) => {
        chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
      };

      sourceNode.connect(processorNode);
      processorNode.connect(silenceGain);
      silenceGain.connect(audioContext.destination);

      intervalRef.current = window.setInterval(() => {
        setElapsedSeconds((current) => Math.min(current + 1, MAX_RECORDING_SECONDS));
      }, 1000);
      timeoutRef.current = window.setTimeout(() => {
        setError(`Recording stopped at ${MAX_RECORDING_SECONDS} seconds. Try one sentence at a time.`);
        stopRecording();
      }, MAX_RECORDING_SECONDS * 1000);
      setIsRecording(true);
    } catch {
      stream?.getTracks().forEach((track) => track.stop());
      setError("Microphone permission was denied or unavailable.");
      setIsRecording(false);
    }
  }

  async function stopRecording() {
    if (stopRequestedRef.current) {
      return;
    }

    clearRecordingTimers();
    stopRequestedRef.current = true;
    sourceNodeRef.current?.disconnect();
    processorNodeRef.current?.disconnect();
    silenceGainRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((track) => track.stop());

    const audioContext = audioContextRef.current;
    const sampleRate = audioContext?.sampleRate ?? 16000;

    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close();
    }

    const blob = encodeWav(chunksRef.current, sampleRate);

    streamRef.current = null;
    audioContextRef.current = null;
    sourceNodeRef.current = null;
    processorNodeRef.current = null;
    silenceGainRef.current = null;
    chunksRef.current = [];
    stopRequestedRef.current = false;
    setIsRecording(false);
    onRecordingComplete(blob);
  }

  useEffect(() => {
    return () => {
      clearRecordingTimers();
      sourceNodeRef.current?.disconnect();
      processorNodeRef.current?.disconnect();
      silenceGainRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      void audioContextRef.current?.close();
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
