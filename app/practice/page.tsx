import { Metadata } from "next";
import Link from "next/link";
import { Clock3 } from "lucide-react";
import { PracticeClient } from "@/app/practice/PracticeClient";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Daily Practice",
  description: "Improve your pronunciation with targeted AI feedback on specific topics and sounds.",
};

const fallbackItems = [{
  id: null,
  content: "I deployed the fix to production yesterday.",
  tags: ["devops", "past_tense", "ending_d"],
}];

export default async function PracticePage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("items")
    .select("id, content, tags")
    .in("type", ["sentence", "minimal_pair"])
    .order("created_at", { ascending: true });

  const items =
    Array.isArray(data) && data.length > 0
      ? data
          .filter((item) => typeof item.id === "string" && typeof item.content === "string")
          .map((item) => ({
            id: item.id as string,
            content: item.content as string,
            tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string") : [],
          }))
      : fallbackItems;

  return (
    <main className="min-h-screen overflow-x-hidden">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-12">
        <header className="mb-7 grid grid-cols-[1fr_auto] items-start gap-3 sm:mb-12 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-moss/60">Practice</p>
            <h1 className="text-[clamp(2.9rem,13vw,4rem)] font-black leading-[0.88] tracking-[-0.075em] text-foreground sm:text-5xl sm:tracking-tight">
              Pronunciation.
            </h1>
          </div>
          <Link 
            href="/history" 
            className={cn(
              buttonVariants({ variant: "ghost" }), 
              "group mt-1 h-12 w-12 shrink-0 rounded-2xl bg-white/80 p-0 font-bold shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all hover:bg-white sm:mt-0 sm:h-12 sm:w-auto sm:px-6"
            )}
            aria-label="Open history"
          >
            <Clock3 className="h-5 w-5 text-moss transition-transform group-hover:-rotate-12 sm:mr-2 sm:h-4 sm:w-4" />
            <span className="hidden text-moss sm:inline">History</span>
          </Link>
        </header>

        <PracticeClient items={items} />
      </div>
    </main>
  );
}
