"use client";

import { useRef, useState } from "react";

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500";

export default function ImageField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (json.url) onChange(json.url);
      else setError(json.error || "Falha no upload");
    } catch {
      setError("Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>

      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className="h-12 w-12 rounded-md border border-slate-200 object-contain"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-300 text-[10px] text-slate-400">
            —
          </div>
        )}

        <div className="flex-1">
          <input
            className={inputCls}
            placeholder="Cole a URL ou anexe"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
          />
        </div>

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
        >
          {uploading ? "Enviando..." : "Anexar"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      {error && <span className="mt-1 block text-xs text-red-500">{error}</span>}
      {hint && !error && (
        <span className="mt-1 block text-xs text-slate-400">{hint}</span>
      )}
    </div>
  );
}
