"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  const isEnvError = error.message.includes("environment variable");

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10 text-destructive">
        <AlertCircle className="h-10 w-10" />
      </div>
      
      <h2 className="mb-2 text-2xl font-black tracking-tight text-foreground">
        Something went wrong
      </h2>
      
      <p className="mb-8 max-w-md text-muted-foreground">
        {isEnvError 
          ? "The server is missing required configuration (environment variables). Please check your .env.local file or deployment settings."
          : error.message || "An unexpected error occurred while processing your request."}
      </p>

      <div className="flex gap-4">
        <Button
          onClick={() => window.location.href = "/"}
          variant="outline"
          className="rounded-xl px-8"
        >
          Go Home
        </Button>
        <Button
          onClick={() => reset()}
          className="rounded-xl bg-moss px-8 text-white hover:bg-moss/90"
        >
          <RefreshCcw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>

      {isEnvError && (
        <div className="mt-12 rounded-2xl bg-field p-6 text-left ring-1 ring-black/5">
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-moss">Required Variables</p>
          <ul className="space-y-1 text-sm font-mono text-muted-foreground">
            <li>NEXT_PUBLIC_SUPABASE_URL</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
            <li>GEMINI_API_KEY</li>
            <li>USER_KEY_ENCRYPTION_SECRET</li>
          </ul>
        </div>
      )}
    </div>
  );
}
