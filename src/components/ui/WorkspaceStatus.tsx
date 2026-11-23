import { Check, Circle, Clock3, FilePenLine, ListTodo } from "lucide-react";

const states = {
  active: { label: "Ativo", icon: Check },
  published: { label: "Publicado", icon: Check },
  draft: { label: "Rascunho", icon: FilePenLine },
  ready: { label: "Publicável", icon: Check },
  review: { label: "Revisar", icon: Clock3 },
  planned: { label: "Planejado", icon: ListTodo },
};

const aliases: Record<string, keyof typeof states> = {
  Ativo: "active",
  Publicado: "published",
  Rascunho: "draft",
  "Publicável": "ready",
  Revisar: "review",
  Planejado: "planned",
};

export default function WorkspaceStatus({ status }: { status: string }) {
  const state = aliases[status] || status;
  const appearance = Object.hasOwn(states, state) ? states[state as keyof typeof states] : undefined;
  const Icon = appearance?.icon || Circle;
  return (
    <span className="ct-status" data-status={appearance ? state : "unknown"}>
      <span className="ct-status-content" key={status}>
        <Icon size={12} aria-hidden="true" />
        {appearance?.label || status}
      </span>
    </span>
  );
}
