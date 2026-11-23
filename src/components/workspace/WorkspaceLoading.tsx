import { ActivityPill } from "./WorkspaceFrame";

export function WorkspaceLoading({ label }: { label: string }) {
  return <div className="ct-workspace grid min-h-dvh place-items-center"><ActivityPill label={label} busy/></div>;
}
