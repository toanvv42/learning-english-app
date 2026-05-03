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

export type PronunciationAssessmentError = {
  position: number;
  expected: string;
  actual: string | null;
  tip: string;
};

export type PronunciationAssessmentWord = {
  word: string;
  expected_phonemes: string[];
  actual_phonemes: string[];
  score: number;
  errors: PronunciationAssessmentError[];
};

export type PronunciationAssessment = {
  overall_score: number;
  words: PronunciationAssessmentWord[];
  fluency_score: number;
  duration_seconds: number;
  processing_time_ms: number;
};
