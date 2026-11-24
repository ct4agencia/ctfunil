"use client";

import { signOut } from "@/app/auth/actions";
import { clearAssistantSession } from "@/lib/assistant/workspace-settings";
import { clearWorkspaceNotices } from "./WorkspaceNoticeHistory";

export default function WorkspaceSignOut({ className }: { className?: string }) {
  return <form action={signOut} onSubmit={() => {
    clearAssistantSession();
    clearWorkspaceNotices();
  }}>
    <button type="submit" className={className}>Sair</button>
  </form>;
}
