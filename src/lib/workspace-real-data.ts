import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import attributionDaily from "./workspace-attribution-daily-data.json";
import attribution from "./workspace-attribution-data.json";
import adAccountSnapshot from "./workspace-ad-account-data.json";
import sales from "./workspace-sales-data.json";
import vsl from "./workspace-vsl-data.json";
import quiz from "./workspace-quiz-data.json";
import quizDaily from "./workspace-quiz-daily-data.json";
import diagnosis from "./workspace-diagnosis-data.json";
import diagnosisDaily from "./workspace-diagnosis-daily-data.json";
import leadsDaily from "./workspace-leads-daily-data.json";
import snapshot from "./workspace-real-data.json";

async function getAuthorizedWorkspaceUser() {
  const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase();
  if (!adminEmail) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.email?.toLowerCase() === adminEmail ? user : null;
  } catch {
    return null;
  }
}

export async function getWorkspaceSnapshot() {
  if (!await getAuthorizedWorkspaceUser()) redirect("/admin/login");
  return workspaceSnapshot();
}

export async function getWorkspaceSnapshotIfAuthorized() {
  const user = await getAuthorizedWorkspaceUser();
  if (!user) return null;
  const avatar = user.user_metadata?.avatar_url;
  const url = typeof avatar === "string" ? URL.parse(avatar) : null;
  const avatarUrl = url?.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  return { ...workspaceSnapshot(), avatarUrl };
}

export function getPublicVslUrl(slug: string) {
  if (!vsl.rows.some(row => row.slug === slug)) return undefined;
  const domain = snapshot.funnels.find(funnel => funnel.slug === slug)?.domain;
  if (domain !== "viverdebolsas.com.br" && domain !== "c.vivendodemoda.com.br") return undefined;
  return `https://${domain}/${encodeURIComponent(slug)}`;
}

function workspaceSnapshot() {
  const accountAds = new Map<string, string[]>();
  if (adAccountSnapshot.attributionCapturedAt === attribution.captured_at) {
    const accountByAd = new Map(adAccountSnapshot.ads.map(ad => [`${ad.id}:${ad.campaignId}`, ad.accountId]));
    for (const creative of attribution.creatives) {
      if (creative.source !== "FB") continue;
      const ad = /\|(\d+)$/.exec(creative.content)?.[1];
      const campaign = /\|(\d+)$/.exec(creative.campaign)?.[1];
      if (!ad || !campaign) continue;
      const account = accountByAd.get(`${ad}:${campaign}`);
      if (!account) continue;
      const entries = accountAds.get(account) ?? [];
      entries.push(creative.content);
      accountAds.set(account, entries);
    }
  }
  return {
    ...snapshot,
    analytics: { ...snapshot.analytics, traffic: attribution.traffic, creatives: attribution.creatives },
    vsl,
    sales,
    quiz: { ...quiz, daily: quizDaily.capturedAt === quiz.captured_at ? quizDaily.rows : undefined },
    diagnosis: { ...diagnosis, daily: diagnosisDaily.capturedAt === diagnosis.captured_at ? diagnosisDaily.rows : undefined },
    leadsDaily: leadsDaily.capturedAt === snapshot.capturedAt ? leadsDaily : undefined,
    attributionDaily: attributionDaily.capturedAt === attribution.captured_at ? attributionDaily : undefined,
    attributionCapturedAt: attribution.captured_at,
    adAccounts: adAccountSnapshot.accounts.flatMap(account => {
      const creatives = accountAds.get(account.id);
      return creatives?.length ? [{ ...account, creatives }] : [];
    }),
  };
}
