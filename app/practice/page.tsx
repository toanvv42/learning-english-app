import Link from "next/link";
import { Clock3 } from "lucide-react";
import { PracticeClient } from "@/app/practice/PracticeClient";
import { buttonVariants } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

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
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-6 sm:py-10">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">Practice</p>
          <h1 className="text-3xl font-semibold text-foreground">Pronunciation feedback</h1>
        </div>
        <Link href="/history" className={cn(buttonVariants({ variant: "outline" }), "shrink-0")}>
          <Clock3 className="h-4 w-4" />
          History
        </Link>
      </header>

      <PracticeClient items={items} />
    </main>
  );
}
