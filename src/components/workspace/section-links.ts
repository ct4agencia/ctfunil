export const sectionLinks = [
  { label: "Abas de Meus funis", group: "Meus funis", path: "/dashboard", tabs: [
    ["quizzes", "Funis"], ["pages", "Páginas"], ["spy", "Referências"],
  ] },
  { label: "Abas do Analytics", group: "Analytics", path: "/analytics", tabs: [
    ["geral", "Visão Geral"], ["comparar", "Comparar"], ["vendas", "Vendas"],
    ["diagnostico", "Diagnóstico"], ["quiz", "Quiz"], ["criativos", "Criativos"],
    ["vsl", "VSL"], ["trafego", "Tráfego"], ["operacao", "Operação"], ["leads", "Leads"],
  ] },
] as const;
