"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { Sparkles, UserRound } from "lucide-react";

export function ChatAvatar({ role, photo }: { role: "user" | "model"; photo?: string }) {
  const [failedPhoto, setFailedPhoto] = useState<string>();
  const Icon = role === "user" ? UserRound : Sparkles;
  return <span className="ct-chat-avatar" data-role={role} aria-hidden="true">
    {photo && photo !== failedPhoto ? (
      <Image src={photo} width={32} height={32} alt="" unoptimized referrerPolicy="no-referrer"
        onError={() => setFailedPhoto(photo)} />
    ) : <Icon size={15} />}
  </span>;
}

export default function ChatParticipants({ model, providerStatus, signedOut, avatarUrl }: {
  model?: string;
  providerStatus: string;
  signedOut: boolean;
  avatarUrl?: string;
}) {
  const root = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);
  const participantsId = useId();
  useEffect(() => {
    function dismissOutside(event: PointerEvent) {
      const details = root.current;
      if (details?.open && !event.composedPath().includes(details)) details.open = false;
    }
    document.addEventListener("pointerdown", dismissOutside);
    return () => document.removeEventListener("pointerdown", dismissOutside);
  }, []);

  return <details ref={root} className="ct-chat-participants" onKeyDown={event => {
    if (event.key !== "Escape" || !root.current?.open) return;
    event.preventDefault();
    root.current.open = false;
    trigger.current?.focus();
  }}>
    <summary ref={element => { trigger.current = element; }} aria-controls={participantsId} aria-label="Participantes da conversa" title="Participantes da conversa">
      <span className="ct-chat-member" title="Você"><ChatAvatar role="user" photo={avatarUrl} /></span>
      <span className="ct-chat-member" title="Gemini"><ChatAvatar role="model" /></span>
    </summary>
    <ul id={participantsId} aria-label="Papéis na conversa">
      <li><ChatAvatar role="user" photo={avatarUrl} /><div><strong>Você</strong><small>{signedOut ? "Entre para enviar mensagens" : "Autor das mensagens"}</small></div></li>
      <li><ChatAvatar role="model" /><div><strong>Gemini</strong><small role="status">{providerStatus}</small>{model && <small>{model}</small>}</div></li>
    </ul>
  </details>;
}
