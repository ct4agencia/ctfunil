"use client";

/**
 * Cerca o canvas do construtor: erro numa lâmina não derruba mais a página.
 *
 * POR QUE EXISTE
 * Um erro de render em qualquer bloco propagava até a raiz e o navegador trocava
 * a aplicação inteira pela tela de falha ("This page couldn't load"). O
 * construtor sumia, e com ele a única pista do que quebrou — a mensagem ficava
 * no console, que ninguém tem aberto enquanto edita.
 *
 * Agora o estrago fica dentro do celular: as etapas, a paleta e o painel
 * continuam vivos, dá para trocar de lâmina, desfazer, ou remover o bloco
 * culpado. E a mensagem aparece na tela, para poder ser lida e copiada.
 *
 * Classe e não hook porque `getDerivedStateFromError` não tem equivalente em
 * componente de função — é a única API do React que captura erro de render de
 * um filho.
 */

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** muda quando a lâmina muda: reseta o erro ao navegar para outra */
  resetKey?: string | number;
}
interface State { erro: Error | null }

export default class CanvasErrorBoundary extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  componentDidUpdate(anterior: Props) {
    // trocar de lâmina limpa o erro — senão a cerca ficaria presa mostrando
    // a falha de uma lâmina que nem está mais na tela
    if (anterior.resetKey !== this.props.resetKey && this.state.erro) {
      this.setState({ erro: null });
    }
  }

  render() {
    const { erro } = this.state;
    if (!erro) return this.props.children;
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="mb-1 text-sm font-bold text-red-900">Esta lâmina não pôde ser desenhada</p>
          <p className="mb-3 text-xs text-red-800/80">
            As outras etapas continuam funcionando — troque de lâmina ou remova o último bloco adicionado.
          </p>
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white/70 p-2 text-[11px] leading-snug text-red-900">
            {erro.message}
            {erro.stack ? `\n\n${erro.stack.split("\n").slice(1, 5).join("\n")}` : ""}
          </pre>
          <button
            onClick={() => this.setState({ erro: null })}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
          >Tentar desenhar de novo</button>
        </div>
      </div>
    );
  }
}
