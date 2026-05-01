import { Card, CardContent } from "@/components/ui/card";

type TargetSentenceProps = {
  text: string;
};

export function TargetSentence({ text }: TargetSentenceProps) {
  return (
    <Card className="overflow-hidden rounded-[2rem] border-none bg-moss/[0.055] shadow-none ring-1 ring-moss/5 sm:rounded-[2.5rem]">
      <CardContent className="px-5 py-9 text-center sm:p-12 lg:px-16 lg:py-14">
        <p className="mb-5 text-[11px] font-black uppercase tracking-[0.34em] text-moss/55 sm:text-xs">
          Target sentence
        </p>
        <h1 className="mx-auto max-w-[13ch] text-balance font-serif text-[2.15rem] font-black italic leading-[0.98] tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl">
          &quot;{text}&quot;
        </h1>
      </CardContent>
    </Card>
  );
}
