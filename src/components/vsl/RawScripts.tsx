"use client";

import { useEffect } from "react";

/**
 * Injeta os scripts LIVRES (head/body/footer) que o usuário cola no admin.
 * Esses podem conter <script> arbitrário, então precisam ser recriados no
 * cliente pra executar (innerHTML não executa <script>). Os pixels conhecidos
 * (UTMify/Meta/GA/GTM/Hotmart) NÃO passam por aqui — são renderizados
 * server-side em PixelScripts pra rodar já no carregamento da página.
 */
export default function RawScripts({
  head,
  body,
  footer,
}: {
  head?: string;
  body?: string;
  footer?: string;
}) {
  useEffect(() => {
    const flag = "data-vsl-raw";
    if (document.documentElement.getAttribute(flag)) return;
    document.documentElement.setAttribute(flag, "1");

    const inject = (html: string | undefined, target: HTMLElement) => {
      if (!html) return;
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      Array.from(tmp.childNodes).forEach((node) => {
        if (node.nodeName === "SCRIPT") {
          const old = node as HTMLScriptElement;
          const s = document.createElement("script");
          Array.from(old.attributes).forEach((a) =>
            s.setAttribute(a.name, a.value),
          );
          s.text = old.text;
          target.appendChild(s);
        } else {
          target.appendChild(node.cloneNode(true));
        }
      });
    };

    inject(head, document.head);
    inject(body, document.body);
    inject(footer, document.body);
  }, [head, body, footer]);

  return null;
}
