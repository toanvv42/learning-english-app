export const primaryIssues = [
  "ending_consonant",
  "past_tense_ed",
  "plural_s",
  "th_sound",
  "sh_sound",
  "ch_sound",
  "vowel_length",
  "grammar",
  "word_choice",
  "wrong_sentence",
  "other",
] as const;

export type PrimaryIssue = (typeof primaryIssues)[number];

export type AIFeedback = {
  overall_score: number;
  primary_issue: PrimaryIssue;
  what_you_said: string;
  what_was_expected: string;
  specific_fix: string;
  vietnamese_tip: string;
  encouragement: string;
};
