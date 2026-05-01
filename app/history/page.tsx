import Link from "next/link";
import { Mic2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { AIFeedback } from "@/types/feedback";

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
    <main className="mx-auto min-h-screen max-w-3xl px-4 py-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">History</p>
          <h1 className="text-3xl font-semibold text-foreground">Past attempts</h1>
        </div>
        <Link href="/practice" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          <Mic2 className="h-4 w-4" />
          Practice
        </Link>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Could not load history</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      {!error && recordings.length === 0 ? (
        <Card>
          <CardContent className="p-5">
            <p className="font-semibold text-foreground">No attempts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Record your first sentence from the practice page.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="space-y-4">
        {recordings.map((recording) => (
          <Card key={recording.id}>
            <CardContent className="p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <time className="text-sm text-muted-foreground" dateTime={recording.created_at}>
                {new Intl.DateTimeFormat("en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(recording.created_at))}
              </time>
              <Badge variant="secondary" className="w-fit">
                {recording.ai_feedback.primary_issue.replaceAll("_", " ")} ·{" "}
                {recording.ai_feedback.overall_score}/10
              </Badge>
            </div>

            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-sm font-semibold text-muted-foreground">Target</dt>
                <dd className="mt-1 text-foreground">{recording.target_text}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-muted-foreground">Transcript</dt>
                <dd className="mt-1 text-foreground">{recording.transcript}</dd>
              </div>
              <div>
                <dt className="text-sm font-semibold text-copper">Fix</dt>
                <dd className="mt-1 text-foreground">{recording.ai_feedback.specific_fix}</dd>
              </div>
            </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
