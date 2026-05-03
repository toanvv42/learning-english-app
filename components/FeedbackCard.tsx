import type { AIFeedback, PronunciationAssessment } from "@/types/feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Info, Lightbulb, MessageCircle, Star, Target, Waves } from "lucide-react";

type FeedbackCardProps = {
  feedback: AIFeedback;
  pronunciationAssessment?: PronunciationAssessment | null;
};

function formatPhonemes(phonemes: string[]) {
  return phonemes.length > 0 ? phonemes.join(" ") : "missing";
}

function getErrorPositions(word: PronunciationAssessment["words"][number]) {
  return new Set(word.errors.map((error) => error.position));
}

function renderHeardPhonemes(word: PronunciationAssessment["words"][number]) {
  if (word.actual_phonemes.length === 0) {
    return <span className="font-mono text-red-600">/missing/</span>;
  }

  const errorPositions = getErrorPositions(word);

  return (
    <p className="flex flex-wrap gap-1.5 font-mono text-sm">
      <span className="text-foreground/70">/</span>
      {word.actual_phonemes.map((phoneme, index) => {
        const isWrong = errorPositions.has(index);

        return (
          <span
            key={`${word.word}-heard-${index}-${phoneme}`}
            className={`rounded px-1.5 py-0.5 font-semibold ${
              isWrong ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {phoneme}
          </span>
        );
      })}
      <span className="text-foreground/70">/</span>
    </p>
  );
}

export function FeedbackCard({ feedback, pronunciationAssessment }: FeedbackCardProps) {
  const isHighReady = feedback.overall_score >= 8;
  const isMidReady = feedback.overall_score >= 5 && feedback.overall_score < 8;
  const wordsWithEvidence = pronunciationAssessment?.words.filter(
    (word) => word.errors.length > 0 || word.score < 95,
  );

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

          {pronunciationAssessment && (
            <div className="rounded-2xl bg-ink/5 p-6 ring-1 ring-ink/10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-white">
                    <Waves className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-ink">
                    Sound Evidence
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="bg-white text-ink ring-1 ring-black/5">
                    {Math.round(pronunciationAssessment.overall_score)}/100 sounds
                  </Badge>
                  <Badge variant="secondary" className="bg-white text-ink ring-1 ring-black/5">
                    {Math.round(pronunciationAssessment.fluency_score)}/100 fluency
                  </Badge>
                </div>
              </div>

              {wordsWithEvidence && wordsWithEvidence.length > 0 ? (
                <div className="space-y-3">
                  {wordsWithEvidence.slice(0, 6).map((word) => (
                    <div key={`${word.word}-${word.expected_phonemes.join("")}`} className="rounded-xl bg-white p-4 ring-1 ring-black/5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-base font-black text-foreground">{word.word}</span>
                        <Badge variant="secondary" className="bg-copper/10 text-copper ring-1 ring-copper/20">
                          {Math.round(word.score)}/100
                        </Badge>
                      </div>
                      <div className="grid gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Expected
                          </span>
                          <p className="font-mono text-foreground">
                            /{formatPhonemes(word.expected_phonemes)}/
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Heard
                          </span>
                          {renderHeardPhonemes(word)}
                        </div>
                      </div>
                      {word.errors[0] && (
                        <p className="mt-3 text-sm font-medium leading-relaxed text-foreground/70">
                          {word.errors[0].tip}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-medium text-foreground/70">
                  The phoneme check did not find a specific sound error in this attempt.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
