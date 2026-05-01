import { Card, CardContent } from "@/components/ui/card";

type TargetSentenceProps = {
  text: string;
};

export function TargetSentence({ text }: TargetSentenceProps) {
  return (
    <Card className="overflow-hidden border-none bg-moss/5 shadow-none">
      <CardContent className="p-8 text-center sm:p-12">
        <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-moss/60">Target sentence</p>
        <h1 className="text-3xl font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl italic font-serif">
          &quot;{text}&quot;
        </h1>
      </CardContent>
    </Card>
  );
}
