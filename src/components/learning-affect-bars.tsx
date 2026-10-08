import { affectColors, affectKeys, affectLabels, type AffectScores } from "@/lib/learning-affect";

export function LearningAffectBars({ scores, language = "ja" }: { scores: AffectScores | null; language?: "ja" | "en" }) {
  return <div className="emotion-percent-list learning-affect-bars">
    {affectKeys.map((key) => <div key={key}>
      <span>{affectLabels[language][key]}</span>
      <i role="meter" aria-label={affectLabels[language][key]} aria-valuemin={0} aria-valuemax={100} aria-valuenow={scores?.[key]}>
        <b style={{ width: `${scores?.[key] ?? 0}%`, background: affectColors[key] }} />
      </i>
      <strong>{scores ? `${scores[key]}%` : "—"}</strong>
    </div>)}
  </div>;
}
