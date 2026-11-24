import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { profileAvatar } from "@/lib/assistant/profile-avatar";
import { requireAdmin } from "@/lib/quiz/admin-guard";
import { HeroPrompt } from "../ProjectsWorkspace";

export const metadata: Metadata = { title: "Assistente · CTFunil" };

export default async function AssistantPage() {
  const admin = await requireAdmin();
  if (!admin.ok) redirect("/admin/login?next=%2Fctfunil%2Fassistente");
  return <WorkspaceFrame title="Assistente" accountEmail={admin.user.email}>
    <header className="ct-page-heading ct-assistant-page-heading"><h1>Assistente</h1></header>
    <HeroPrompt key={admin.user.id} accountId={admin.user.id} avatarUrl={profileAvatar(admin.user.user_metadata?.avatar_url)} />
  </WorkspaceFrame>;
}
