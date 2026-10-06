"use client";

import { useState, useTransition } from "react";
import { createVsl } from "@/app/admin/actions";
import { slugify } from "@/lib/text";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-sky-500";

export default function NewVslForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await createVsl({ name: name.trim(), slug: slug.trim() });
      if (res?.error) setError(res.error);
      // sucesso → server action redireciona pro editor
    });
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Nome do produto
        </span>
        <input
          className={inputCls}
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">
          Slug (URL)
        </span>
        <input
          className={inputCls}
          required
          value={slug}
          onChange={(e) => {
            setSlugEdited(true);
            setSlug(slugify(e.target.value));
          }}
        />
        <span className="mt-1 block text-xs text-slate-400">
          A página ficará em /{slug || "seu-slug"}
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-sky-600 px-5 py-2.5 font-semibold text-white transition hover:bg-sky-500 disabled:opacity-50"
      >
        {pending ? "Criando..." : "Criar e configurar"}
      </button>
    </form>
  );
}
