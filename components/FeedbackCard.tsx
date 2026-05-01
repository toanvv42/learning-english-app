import type { AIFeedback } from "@/types/feedback";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type FeedbackCardProps = {
  feedback: AIFeedback;
};

export function FeedbackCard({ feedback }: FeedbackCardProps) {
  return (
    <Card>
      <CardHeader>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-moss">Feedback</p>
          <h2 className="mt-2 text-3xl font-semibold text-foreground">Score {feedback.overall_score}/10</h2>
        </div>
        <Badge variant="secondary" className="text-sm">
          {feedback.primary_issue.replaceAll("_", " ")}
        </Badge>
      </div>
      </CardHeader>

      <CardContent>
      <dl className="space-y-4">
        <div>
          <dt className="text-sm font-semibold text-muted-foreground">What you said</dt>
          <dd className="mt-1 text-foreground">{feedback.what_you_said}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted-foreground">Expected</dt>
          <dd className="mt-1 text-foreground">{feedback.what_was_expected}</dd>
        </div>
        <div className="rounded-md bg-copper/10 p-4">
          <dt className="text-sm font-semibold text-copper">One fix</dt>
          <dd className="mt-1 text-foreground">{feedback.specific_fix}</dd>
        </div>
        <div className="rounded-md bg-muted p-4">
          <dt className="text-sm font-semibold text-moss">Vietnamese tip</dt>
          <dd className="mt-1 text-foreground">{feedback.vietnamese_tip}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-muted-foreground">Encouragement</dt>
          <dd className="mt-1 text-foreground">{feedback.encouragement}</dd>
        </div>
      </dl>
      </CardContent>
    </Card>
  );
}
