export const affectKeys = ["boredom", "engagement", "confusion", "frustration"] as const;
export type AffectKey = (typeof affectKeys)[number];
export type AffectScores = Record<AffectKey, number>;
export type LearningAffectSignal = {
  scores: AffectScores;
  dominant: AffectKey;
  confidence?: number;
  source?: string;
  modelVersion: string;
  capturedAt: string;
  validFrames: number;
  sustained?: boolean;
};
export type AffectSample = AffectScores & {
  id: string; user_id: string; dominant_affect: AffectKey;
  captured_at: string; confidence: number | null; model_version: string;
  valid_frames: number; study_session_id: string | null;
};
export type AffectReport = {
  class_average: AffectScores | null;
  latest: AffectSample[];
  students: Array<{ user_id: string; scores: AffectScores; samples: number; session_id: string | null }>;
  trend: Array<AffectScores & { captured_at: string }>;
  support_count: number;
  sample_count: number;
};
export const affectLabels = {
  ja: { boredom: "退屈", engagement: "集中・関与", confusion: "混乱", frustration: "フラストレーション" },
  en: { boredom: "Boredom", engagement: "Engagement", confusion: "Confusion", frustration: "Frustration" },
};
export const affectColors: Record<AffectKey, string> = {
  boredom: "#e9a64c", engagement: "#4255ff", confusion: "#8a72d8", frustration: "#d77383",
};
export function validScores(value: unknown): value is AffectScores {
  if (!value || typeof value !== "object") return false;
  return affectKeys.every((key) => {
    const score = (value as Record<string, unknown>)[key];
    return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100;
  });
}
export function averageScores(samples: AffectScores[]): AffectScores {
  return Object.fromEntries(affectKeys.map((key) => [key,
    Math.round(samples.reduce((sum, scores) => sum + scores[key], 0) / Math.max(1, samples.length)),
  ])) as AffectScores;
}
export function dominantAffect(scores: AffectScores): AffectKey {
  return affectKeys.reduce((best, key) => scores[key] > scores[best] ? key : best, affectKeys[0]);
}
// 既存の支援ログとの互換値。独立した測定指標としては表示しない。
export function supportIntensity(scores: AffectScores): number {
  return Math.round(Math.max(scores.boredom, scores.confusion, scores.frustration));
}
