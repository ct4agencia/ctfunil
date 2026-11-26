"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

/**
 * Janela que abre depois de "Publicar funil" (pedido do Luca, 26/11/2026).
 * Mostra a URL padrão do CTFunil e, embaixo, a do domínio configurado no
 * funil, cada uma com "Copiar". O "Ver página" abre o domínio quando há e, se
 * não houver, a URL padrão do CTFunil.
 */
export default function PublicarFunilDialog({ urlPadrao, urlDominio, onClose }: {
  urlPadrao: string;
  urlDominio?: string;
  onClose: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialogo.current;
    if (el && !el.open) el.showModal();
  }, []);
  const destino = urlDominio ?? urlPadrao;
  return (
    <dialog ref={dialogo} aria-labelledby="ct-publicado-titulo" onClose={onClose}
      className="ct-template-dialog" style={{ width: "min(520px, calc(100% - 32px))" }}>
      <div className="space-y-4 p-5">
        <div>
          <h2 id="ct-publicado-titulo" className="text-base font-bold">Funil publicado</h2>
          <p className="mt-1 text-xs text-ct-dim">Copie o endereço para usar nos anúncios.</p>
        </div>
        <CampoUrl rotulo="URL padrão do CTFunil" url={urlPadrao}
          ajuda="Neste endereço, visitas e leads não são registrados no CTFunil." />
        {urlDominio ? (
          <CampoUrl rotulo="URL do domínio do funil" url={urlDominio}
            ajuda="No domínio próprio, a página pode levar alguns minutos para atualizar." />
        ) : (
          <div>
            <p className="text-xs font-semibold text-ct-dim">URL do domínio do funil</p>
            <p className="mt-1 rounded-lg border border-dashed border-ct-line px-3 py-2 text-xs text-ct-dim">
              Nenhum domínio configurado. Cadastre em ⚙ Configurações do funil.
            </p>
          </div>
        )}
        <div className="flex flex-wrap justify-end gap-2 pt-1">
          <button type="button" onClick={() => dialogo.current?.close()}
            className="rounded-lg border border-ct-line px-3 py-2 text-xs font-semibold text-ct-ink hover:bg-ct-raised">
            Fechar
          </button>
          <a href={destino} target="_blank" rel="noopener noreferrer"
            className="ct-primary inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white">
            Ver página <ExternalLink size={14} aria-hidden="true" />
            <span className="sr-only"> (abre {urlDominio ? "o domínio do funil" : "a URL padrão do CTFunil"} em outra aba)</span>
          </a>
        </div>
      </div>
    </dialog>
  );
}

/** Um endereço com o botão de copiar. */
function CampoUrl({ rotulo, url, ajuda }: { rotulo: string; url: string; ajuda?: string }) {
  const id = useId();
  const campo = useRef<HTMLInputElement>(null);
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // sem permissão de área de transferência: seleciona para o Ctrl+C
      campo.current?.select();
      return;
    }
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 1800);
  };
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-ct-dim">{rotulo}</label>
      <div className="mt-1 flex gap-2">
        <input id={id} ref={campo} readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-ct-line bg-ct-raised px-3 py-2 text-xs text-ct-ink" />
        <button type="button" onClick={copiar} aria-label={`Copiar ${rotulo}`}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-ct-line px-3 py-2 text-xs font-semibold text-ct-ink hover:bg-ct-raised">
          {copiado ? <><Check size={14} aria-hidden="true" /> Copiado</> : <><Copy size={14} aria-hidden="true" /> Copiar</>}
        </button>
      </div>
      {ajuda ? <p className="mt-1 text-[11px] text-ct-dim">{ajuda}</p> : null}
      <span role="status" className="sr-only">{copiado ? "Endereço copiado" : ""}</span>
    </div>
  );
}
