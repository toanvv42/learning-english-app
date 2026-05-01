"use client";

import { FormEvent, useState } from "react";
import { LogIn, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    setIsSubmitting(true);

    let result;

    try {
      const supabase = createSupabaseBrowserClient();
      result =
        mode === "sign-in"
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
    } catch (caught) {
      setIsSubmitting(false);
      setError(caught instanceof Error ? caught.message : "Supabase is not configured.");
      return;
    }

    setIsSubmitting(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "sign-up" && !result.data.session) {
      setStatus("Check your email to confirm your account, then sign in.");
      return;
    }

    router.replace(searchParams.get("next") ?? "/practice");
    router.refresh();
  }

  return (
    <Card className="border-none bg-white/70 shadow-2xl backdrop-blur-xl ring-1 ring-black/5 animate-in fade-in zoom-in-95 duration-700">
      <CardContent className="p-8 sm:p-12">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-moss/10 text-moss">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {mode === "sign-in" ? "Welcome back" : "Start your journey"}
          </h1>
          <p className="mt-3 text-muted-foreground">
            {mode === "sign-in" 
              ? "Sign in to continue your pronunciation practice." 
              : "Create an account to track your progress and master English."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-10 space-y-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-moss/60">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="h-12 rounded-xl border-none bg-field px-4 shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
              />
            </div>
            <div className="space-y-1.5">
              <label className="ml-2 text-[10px] font-bold uppercase tracking-[0.2em] text-moss/60">
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="h-12 rounded-xl border-none bg-field px-4 shadow-sm ring-1 ring-black/5 transition-all focus:ring-2 focus:ring-moss"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            size="lg"
            className="h-14 w-full rounded-2xl bg-moss text-lg font-bold text-white shadow-xl shadow-moss/20 transition-all hover:bg-moss/90 hover:shadow-2xl active:scale-[0.98]"
          >
            {isSubmitting ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <LogIn className="mr-2 h-5 w-5" />
                {mode === "sign-in" ? "Sign in" : "Sign up"}
              </>
            )}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError(null);
              setStatus(null);
            }}
            className="text-sm font-bold text-moss hover:underline"
          >
            {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
          </button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-8 rounded-2xl border-none shadow-lg shadow-destructive/10">
            <AlertTitle className="text-sm font-bold uppercase tracking-widest">Sign-in failed</AlertTitle>
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}
        {status && (
          <Alert className="mt-8 rounded-2xl border-none bg-moss/10 text-moss ring-1 ring-moss/20">
            <AlertTitle className="text-sm font-bold uppercase tracking-widest">Success</AlertTitle>
            <AlertDescription className="text-xs">{status}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
