"use client";

import { FormEvent, useState } from "react";
import { LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
      <p className="text-xs font-semibold uppercase tracking-wider text-moss">English practice</p>
      <CardTitle className="text-3xl">
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </CardTitle>
      </CardHeader>

      <CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-medium text-foreground">Email</span>
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="mt-1"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-foreground">Password</span>
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={6}
            className="mt-1"
          />
        </label>

        <Button
          type="submit"
          disabled={isSubmitting}
          size="lg"
          className="w-full"
        >
          <LogIn className="h-4 w-4" />
          {isSubmitting ? "Working..." : mode === "sign-in" ? "Sign in" : "Sign up"}
        </Button>
      </form>

      <Button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        variant="ghost"
        className="mt-4 w-full text-moss hover:text-moss"
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </Button>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Sign-in failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {status ? (
        <Alert className="mt-4">
          <AlertTitle>Check your email</AlertTitle>
          <AlertDescription>{status}</AlertDescription>
        </Alert>
      ) : null}
      </CardContent>
    </Card>
  );
}
