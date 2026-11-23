"use client";

import WorkspaceError from "@/components/workspace/WorkspaceError";

export default function ImportError() {
  return <WorkspaceError
    title="Não foi possível abrir a importação"
    editor
    returnLink={{ href: "/ctfunil#anexar-referencia", label: "Anexar arquivo no assistente" }}
  />;
}
