import { Metadata } from "next";
import Link from "next/link";
import { Mic2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { AIFeedback } from "@/types/feedback";

export const metadata: Metadata = {
  title: "Practice History",
  description: "Review your past pronunciation attempts and track your progress over time.",
};

type RecordingRow = {
  id: string;
  created_at: string;
  target_text: string;
  transcript: string;
  ai_feedback: AIFeedback;
};

export default async function HistoryPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("recordings")
    .select("id, created_at, target_text, transcript, ai_feedback")
    .order("created_at", { ascending: false });

  const recordings = (data ?? []) as RecordingRow[];

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:py-12">
        <header className="mb-12 flex items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-moss/60">Archive</p>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              History.
            </h1>
          </div>
          <Link 
            href="/practice" 
            className={cn(
              buttonVariants({ variant: "ghost" }), 
              "group h-12 rounded-2xl bg-white/50 px-6 font-bold shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all hover:bg-white"
            )}
          >
            <Mic2 className="mr-2 h-4 w-4 text-moss transition-transform group-hover:scale-110" />
            <span className="text-moss">Practice</span>
          </Link>
        </header>

        {error && (
          <Alert variant="destructive" className="rounded-2xl border-none shadow-lg shadow-destructive/10">
            <AlertTitle className="text-sm font-bold uppercase tracking-widest">Error</AlertTitle>
            <AlertDescription className="text-xs">{error.message}</AlertDescription>
          </Alert>
        )}

        {!error && recordings.length === 0 && (
          <Card className="border-none bg-white/50 shadow-sm backdrop-blur-sm ring-1 ring-black/5">
            <CardContent className="p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-moss/5 text-moss/20">
                <Mic2 className="h-8 w-8" />
              </div>
              <h3 className="text-xl font-bold text-foreground">No attempts yet</h3>
              <p className="mt-2 text-muted-foreground text-sm max-w-[240px] mx-auto">Record your first sentence from the practice page to see your history.</p>
              <Link 
                href="/practice" 
                className={cn(buttonVariants({ variant: "default" }), "mt-8 h-12 rounded-xl bg-moss px-8 font-bold text-white shadow-xl shadow-moss/20 hover:bg-moss/90")}
              >
                Start Practicing
              </Link>
            </CardContent>
          </Card>
        )}

        <div className="space-y-6">
          {recordings.map((recording) => (
            <Card key={recording.id} className="group overflow-hidden border-none bg-white/50 shadow-sm backdrop-blur-sm ring-1 ring-black/5 transition-all hover:bg-white hover:shadow-xl hover:shadow-black/5">
              <CardContent className="p-6 sm:p-8">
                <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-moss/20" />
                    <time className="text-xs font-bold uppercase tracking-widest text-moss/60" dateTime={recording.created_at}>
                      {new Intl.DateTimeFormat("en", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(recording.created_at))}
                    </time>
                  </div>
                  <Badge variant="secondary" className="rounded-full bg-moss/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-moss ring-1 ring-moss/20">
                    {recording.ai_feedback.primary_issue.replaceAll("_", " ")} · {recording.ai_feedback.overall_score}/10
                  </Badge>
                </div>

                <div className="grid gap-8 sm:grid-cols-2">
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss/40">Target</span>
                      <p className="text-lg font-medium text-foreground/80 italic font-serif leading-snug">&quot;{recording.target_text}&quot;</p>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-moss/40">Transcript</span>
                      <p className="text-lg font-medium text-foreground">&quot;{recording.transcript}&quot;</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-copper/5 p-6 ring-1 ring-copper/10 group-hover:bg-copper/10 transition-colors">
                    <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-copper">The Key Fix</span>
                    <p className="text-base font-semibold leading-relaxed text-copper-dark">
                      {recording.ai_feedback.specific_fix}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
