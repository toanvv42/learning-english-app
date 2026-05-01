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
    <main className="min-h-screen">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:py-12">
        <header className="mb-12 flex items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-moss/60">Practice</p>
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
              Pronunciation.
            </h1>
          </div>
          <Link 
            href="/history" 
            className={cn(
              buttonVariants({ variant: "ghost" }), 
              "group h-12 rounded-2xl bg-white/50 px-6 font-bold shadow-sm ring-1 ring-black/5 backdrop-blur-sm transition-all hover:bg-white"
            )}
          >
            <Clock3 className="mr-2 h-4 w-4 text-moss transition-transform group-hover:-rotate-12" />
            <span className="text-moss">History</span>
          </Link>
        </header>

        <PracticeClient items={items} />
      </div>
    </main>
  );
}
