"use client";

import { useEffect, useRef, useState } from "react";
import { getActiveSupabaseClient } from "@/lib/supabase/client";
import { LearningAffectBars } from "@/components/learning-affect-bars";
import { affectColors, affectKeys, affectLabels, type AffectReport } from "@/lib/learning-affect";

export function TeacherAffectReport({ language, preview, profiles, materials, onReport }: {
  language: "ja" | "en"; preview: boolean;
  profiles: Array<{ id: string; display_name: string | null; role: string | null }>;
  materials: Array<{ id: string; title: string }>;
  onReport: (report: AffectReport) => void;
}) {
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [group, setGroup] = useState("");
  const [days, setDays] = useState(1);
  const [material, setMaterial] = useState("");
  const [focusStudent, setFocusStudent] = useState("");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [groupName, setGroupName] = useState("");
  const [student, setStudent] = useState("");
  const [report, setReport] = useState<AffectReport | null>(null);
  const [error, setError] = useState("");
  const [updated, setUpdated] = useState("");
  const [groupVersion, setGroupVersion] = useState(0);
  const callback = useRef(onReport);
  useEffect(() => { callback.current = onReport; }, [onReport]);
  const ja = language === "ja";
  function clearReport() {
    setReport(null); setError(""); setUpdated("");
    callback.current({ class_average: null, latest: [], students: [], trend: [], support_count: 0, sample_count: 0 });
  }
  function selectGroup(id: string) { setGroup(id); setFocusStudent(""); clearReport(); }
  useEffect(() => {
    let disposed = false;
    let busy = false;
    async function load() {
      if (preview || busy) return;
      busy = true;
      try {
        const auth = await getActiveSupabaseClient();
        if (!auth || disposed) return;
        const result = await auth.client.from("study_groups").select("id,name").eq("owner_id", auth.session.user.id).order("created_at");
        const ownedIds = (result.data || []).map((item) => item.id);
        const memberships = ownedIds.length ? await auth.client.from("study_group_members").select("user_id").in("group_id", group ? [group] : ownedIds) : { data: [], error: null };
        const response = await auth.client.rpc("learning_affect_report", {
          p_group: group || null, p_student: focusStudent || null, p_material: material || null,
          p_from: new Date(Date.now() - days * 86400000).toISOString(), p_to: new Date().toISOString(),
        });
        if (disposed) return;
        if (result.error || memberships.error || response.error) {
          setError(ja ? "学習状態を取得できません。接続と教師権限を確認してください。" : "Cannot load learning states. Check connection and teacher access.");
          return;
        }
        setGroups(result.data || []); setMemberIds([...new Set((memberships.data || []).map((item) => item.user_id))]);
        const next = response.data as AffectReport;
        setReport(next); callback.current(next); setError(""); setUpdated(new Date().toLocaleTimeString());
      } catch {
        if (!disposed) setError(ja ? "学習状態を取得できません。" : "Cannot load learning states.");
      } finally { busy = false; }
    }
    void load();
    const timer = setInterval(() => { void load(); }, 30000);
    return () => { disposed = true; clearInterval(timer); };
  }, [group, groupVersion, days, material, focusStudent, refresh, ja, preview]);

  async function createGroup(event: React.FormEvent) {
    event.preventDefault();
    const auth = await getActiveSupabaseClient();
    if (!auth || preview || !groupName.trim()) return;
    const result = await auth.client.from("study_groups").insert({ owner_id: auth.session.user.id, name: groupName.trim(), description: "" }).select("id").single();
    if (result.error || !result.data) { setError(ja ? "グループを作成できませんでした。" : "Could not create group."); return; }
    selectGroup(result.data.id); setGroupName(""); setGroupVersion((n) => n + 1);
  }
  async function addStudent(event: React.FormEvent) {
    event.preventDefault();
    const auth = await getActiveSupabaseClient();
    if (!auth || preview || !student || !group) return;
    const result = await auth.client.from("study_group_members").upsert({ group_id: group, user_id: student, role: "member" }, { onConflict: "group_id,user_id", ignoreDuplicates: true });
    if (result.error) { setError(ja ? "学生を追加できませんでした。" : "Could not add student."); return; }
    setStudent(""); setGroupVersion((n) => n + 1);
  }
  const label = (id: string) => profiles.find((p) => p.id === id)?.display_name || (ja ? "学生" : "Student");
  const trend = report?.trend || [];
  const start = trend.length ? new Date(trend[0].captured_at).getTime() : 0;
  const end = trend.length ? new Date(trend[trend.length - 1].captured_at).getTime() : 0;
  return <>
    <div className="affect-report-toolbar"><label>{ja ? "担当グループ" : "Group"}<select value={group} onChange={(e) => selectGroup(e.target.value)}><option value="">{ja ? "すべての担当グループ" : "All owned groups"}</option>{groups.map((g) => <option value={g.id} key={g.id}>{g.name}</option>)}</select></label><label>{ja ? "教材" : "Material"}<select value={material} onChange={(e) => { clearReport(); setMaterial(e.target.value); }}><option value="">{ja ? "すべての教材" : "All materials"}</option>{materials.filter((m) => /^[0-9a-f]{8}-/i.test(m.id)).map((m) => <option value={m.id} key={m.id}>{m.title}</option>)}</select></label><label>{ja ? "学生" : "Student"}<select value={focusStudent} onChange={(e) => { clearReport(); setFocusStudent(e.target.value); }}><option value="">{ja ? "クラス全体" : "Whole class"}</option>{profiles.filter((p) => memberIds.includes(p.id)).map((p) => <option value={p.id} key={p.id}>{p.display_name || p.id.slice(0, 8)}</option>)}</select></label><label>{ja ? "期間" : "Period"}<select value={days} onChange={(e) => { clearReport(); setDays(Number(e.target.value)); }}><option value={1}>{ja ? "24時間" : "24 hours"}</option><option value={7}>{ja ? "7日間" : "7 days"}</option><option value={30}>{ja ? "30日間" : "30 days"}</option></select></label><button type="button" onClick={() => setRefresh((n) => n + 1)} disabled={preview}>{ja ? "更新" : "Refresh"}</button><small>{ja ? "30秒ごと更新" : "Updates every 30s"}{updated && ` · ${updated}`}</small></div>
    {error && <p role="status">{error}</p>}
    <div className="affect-average-grid">{affectKeys.map((key) => <article key={key}><small>{affectLabels[language][key]}</small><strong style={{ color: affectColors[key] }}>{report?.class_average ? `${report.class_average[key]}%` : "—"}</strong></article>)}</div>
    <p className="affect-report-note">{report?.sample_count ? `${ja ? "計測" : "Readings"}: ${report.sample_count} · ${ja ? "混乱・フラストレーションが3回続いた学生" : "Sustained confusion/frustration"}: ${report.support_count}` : (ja ? "担当グループの学生が計測すると、平均と推移が表示されます。" : "Averages and trends appear when assigned students record readings.")}</p>
    <details className="affect-report-details" open><summary>{ja ? "推移・学生別セッション平均" : "Trends and student session averages"}</summary>
      {trend.length ? <div className="affect-trend"><svg viewBox="0 0 600 190" role="img" aria-label={ja ? "4指標の5分ごとの推移" : "Four metrics over time"}>
        {[0, 50, 100].map((value) => <g key={value}><text x="0" y={170 - value * 1.5}>{value}</text><line x1="32" x2="594" y1={165 - value * 1.5} y2={165 - value * 1.5} stroke="#e3e8f4" /></g>)}
        {affectKeys.map((key) => <g key={key}><polyline fill="none" stroke={affectColors[key]} strokeWidth="2.5" points={trend.map((point) => `${32 + ((new Date(point.captured_at).getTime() - start) / Math.max(1, end - start)) * 560},${165 - point[key] * 1.5}`).join(" ")} />{trend.length === 1 && <circle cx="32" cy={165 - trend[0][key] * 1.5} r="4" fill={affectColors[key]} />}</g>)}
      </svg><div className="affect-trend-times"><small>{new Date(start).toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}</small><small>{ja ? "5分単位" : "5-minute buckets"}</small><small>{new Date(end).toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}</small></div><div className="affect-legend">{affectKeys.map((key) => <span key={key}><i style={{ background: affectColors[key] }} />{affectLabels[language][key]}</span>)}</div></div> : <p>{ja ? "まだ推移データがありません。" : "No trend data yet."}</p>}
      <div className="affect-session-list">{report?.students.map((row) => <article key={row.user_id}><strong>{label(row.user_id)}</strong><small>{row.session_id ? (ja ? "最新セッションの平均" : "Latest session average") : (ja ? "セッション外・期間平均" : "Outside session · period average")} · {row.samples}{ja ? "回" : " readings"}</small><LearningAffectBars scores={row.scores} language={language} /></article>)}</div>
    </details>
    <p className="affect-report-note">{ja ? "学習状態は参考情報です。予測だけで評価せず、本人の説明や進捗と合わせて支援を判断してください。" : "Use these signals with learner feedback and progress, never as the sole basis for assessment."}</p>
    <details className="affect-report-details"><summary>{ja ? "担当グループを設定" : "Manage assigned groups"}</summary><form onSubmit={createGroup}><input aria-label={ja ? "新しいグループ名" : "New group name"} value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder={ja ? "グループ名" : "Group name"} required /><button type="submit" disabled={preview}>{ja ? "グループを作成" : "Create group"}</button></form><form onSubmit={addStudent}><select aria-label={ja ? "追加する学生" : "Student to add"} value={student} onChange={(e) => setStudent(e.target.value)} required><option value="">{ja ? "学生を選択" : "Select student"}</option>{profiles.filter((p) => p.role === "student").map((p) => <option key={p.id} value={p.id}>{p.display_name || p.id.slice(0, 8)}</option>)}</select><button type="submit" disabled={preview || !group}>{ja ? "選択中のグループに追加" : "Add to selected group"}</button></form></details>
  </>;
}
