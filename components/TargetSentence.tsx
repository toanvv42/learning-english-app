import { Card, CardContent, CardHeader } from "@/components/ui/card";

type TargetSentenceProps = {
  text: string;
};

export function TargetSentence({ text }: TargetSentenceProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-moss">Target sentence</p>
      </CardHeader>
      <CardContent>
        <h1 className="text-3xl font-semibold leading-tight text-foreground sm:text-4xl">{text}</h1>
      </CardContent>
    </Card>
  );
}
