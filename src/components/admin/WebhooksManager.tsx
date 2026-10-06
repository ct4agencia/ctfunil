"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createWebhook,
  updateWebhook,
  deleteWebhook,
} from "@/app/admin/actions";
import {
  TRIGGER_LABELS,
  type Webhook,
  type WebhookInput,
  type WebhookTrigger,
} from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500";
const labelCls = "mb-1 block text-xs font-medium text-slate-600";

function WebhookCard({
  webhook,
  vslId,
}: {
  webhook: Webhook;
  vslId: string;
}) {
  const router = useRouter();
  const [w, setW] = useState<WebhookInput>({
    name: webhook.name,
    api_url: webhook.api_url,
    token: webhook.token,
    method: webhook.method,
    content_type: webhook.content_type,
    trigger_event: webhook.trigger_event,
    component_id: webhook.component_id,
    enabled: webhook.enabled,
  });
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function upd<K extends keyof WebhookInput>(k: K, v: WebhookInput[K]) {
    setW((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  function save() {
    startTransition(async () => {
      await updateWebhook(webhook.id, vslId, w);
      setSaved(true);
      router.refresh();
    });
  }
  function remove() {
    if (!confirm("Excluir este webhook?")) return;
    startTransition(async () => {
      await deleteWebhook(webhook.id, vslId);
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Nome (identificação interna)</span>
          <input
            className={inputCls}
            value={w.name ?? ""}
            onChange={(e) => upd("name", e.target.value || null)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelCls}>API URL</span>
          <input
            className={inputCls}
            placeholder="https://api.exemplo.com/webhook"
            value={w.api_url}
            onChange={(e) => upd("api_url", e.target.value)}
          />
        </label>

        <label className="block sm:col-span-2">
          <span className={labelCls}>Token (opcional — Bearer)</span>
          <input
            className={inputCls}
            value={w.token ?? ""}
            onChange={(e) => upd("token", e.target.value || null)}
          />
        </label>

        <label className="block">
          <span className={labelCls}>Método</span>
          <select
            className={inputCls}
            value={w.method}
            onChange={(e) =>
              upd("method", e.target.value as WebhookInput["method"])
            }
          >
            <option value="POST">POST</option>
            <option value="GET">GET</option>
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Content-Type</span>
          <select
            className={inputCls}
            value={w.content_type}
            onChange={(e) =>
              upd("content_type", e.target.value as WebhookInput["content_type"])
            }
          >
            <option value="formData">formData</option>
            <option value="json">JSON</option>
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>Gatilho de envio</span>
          <select
            className={inputCls}
            value={w.trigger_event}
            onChange={(e) =>
              upd("trigger_event", e.target.value as WebhookTrigger)
            }
          >
            {(Object.keys(TRIGGER_LABELS) as WebhookTrigger[]).map((t) => (
              <option key={t} value={t}>
                {TRIGGER_LABELS[t]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className={labelCls}>ID/Name do componente</span>
          <input
            className={inputCls}
            placeholder="ex: webhook"
            value={w.component_id ?? ""}
            onChange={(e) => upd("component_id", e.target.value || null)}
          />
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={w.enabled}
            onChange={(e) => upd("enabled", e.target.checked)}
          />
          Ativo
        </label>
        <div className="flex items-center gap-3">
          {saved && <span className="text-xs text-emerald-600">Salvo</span>}
          <button
            onClick={save}
            disabled={pending}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
          >
            Salvar
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

export default function WebhooksManager({
  vslId,
  webhooks,
}: {
  vslId: string;
  webhooks: Webhook[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function add() {
    startTransition(async () => {
      await createWebhook(vslId, {
        name: "",
        api_url: "",
        token: null,
        method: "POST",
        content_type: "formData",
        trigger_event: "click_component",
        component_id: null,
        enabled: true,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {webhooks.length} webhook{webhooks.length === 1 ? "" : "s"} nesta página
        </p>
        <button
          onClick={add}
          disabled={pending}
          className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          + Adicionar webhook
        </button>
      </div>

      {webhooks.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          Nenhum webhook. Adicione um para enviar os dados a cada evento.
        </div>
      ) : (
        webhooks.map((wh) => (
          <WebhookCard key={wh.id} webhook={wh} vslId={vslId} />
        ))
      )}
    </div>
  );
}
