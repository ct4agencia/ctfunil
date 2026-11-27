"use client";
import { createContext } from "react";

/**
 * Popup da vitória como componente próprio da roleta (aprovado pelo Luca em
 * 26/11). O construtor de lâminas fornece `abrir`; com ele, o editor da roleta
 * (StepEditor) troca o que é do popup por um atalho "Popup da vitória · Editar".
 * Sem provedor (outros construtores que usam o StepEditor), fica `null` e o
 * editor da roleta mostra os campos do popup como antes.
 */
export const PopupDaVitoriaContext = createContext<{ abrir: () => void } | null>(null);
