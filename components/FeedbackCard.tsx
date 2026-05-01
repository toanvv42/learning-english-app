import type { AIFeedback } from "@/types/feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Lightbulb, MessageCircle, Star, Target } from "lucide-react";

type FeedbackCardProps = {
  feedback: AIFeedback;
};

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  const isHighReady = feedback.overall_score >= 8;
  const isMidReady = feedback.overall_score >= 5 && feedback.overall_score < 8;

  return (
    <Card className="overflow-hidden border-none bg-white shadow-2xl ring-1 ring-black/5 animate-in slide-in-from-bottom-4 duration-500">
      <CardContent className="p-0">
        <div className={`p-8 text-white ${
          isHighReady ? "bg-moss" : isMidReady ? "bg-copper" : "bg-ink"
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">Pronunciation Score</p>
              <div className="mt-2 flex items-end gap-1">
                <span className="text-6xl font-black leading-none">{feedback.overall_score}</span>
                <span className="text-xl font-bold opacity-60">/10</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <Badge variant="secondary" className="bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-white backdrop-blur-sm border-none">
                {feedback.primary_issue.replaceAll("_", " ")}
              </Badge>
              <div className="flex gap-1">
                {[...Array(10)].map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-1.5 w-1.5 rounded-full ${i < feedback.overall_score ? "bg-white" : "bg-white/20"}`} 
                  />
                ))}
              </div>
            </div>
          </div>
          
          <p className="mt-6 flex items-center gap-2 text-sm font-medium italic opacity-90">
            <MessageCircle className="h-4 w-4" />
            &quot;{feedback.encouragement}&quot;
          </p>
        </div>

        <div className="grid gap-px bg-black/5 sm:grid-cols-2">
          <div className="bg-white p-6 transition-colors hover:bg-field/50">
            <div className="mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-moss/40" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">What you said</span>
            </div>
            <p className="text-lg font-medium text-foreground">&quot;{feedback.what_you_said}&quot;</p>
          </div>
          <div className="bg-white p-6 transition-colors hover:bg-field/50">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-moss/40" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expected</span>
            </div>
            <p className="text-lg font-medium text-foreground">&quot;{feedback.what_was_expected}&quot;</p>
          </div>
        </div>

        <div className="space-y-6 p-8">
          <div className="relative overflow-hidden rounded-2xl bg-copper/5 p-6 ring-1 ring-copper/10">
            <div className="absolute -right-4 -top-4 text-copper/10">
              <Lightbulb className="h-24 w-24 rotate-12" />
            </div>
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-copper text-white">
                  <Lightbulb className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-copper">The Key Fix</span>
              </div>
              <p className="text-base font-semibold leading-relaxed text-copper-dark">
                {feedback.specific_fix}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-moss/5 p-6 ring-1 ring-moss/10">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-moss text-white">
                <Info className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-moss">Mẹo cho người Việt</span>
            </div>
            <p className="text-base font-medium leading-relaxed text-foreground/80">
              {feedback.vietnamese_tip}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
