import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonte única do admin (Inter). Geist/Geist_Mono foram removidas: carregavam
// com preload em TODAS as páginas (inclusive funis públicos) sem uso algum.
// preload:false: o preload da Inter entrava até nos funis públicos (que nem
// usam a fonte) e competia com o LCP no 4G. Admin pinta com fallback e troca.
const inter = localFont({
  src: "./fonts/inter.woff2",
  weight: "100 900",
  variable: "--font-admin",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "CTFUNNEL",
  description: "Construtor de funis de quiz gamificado",
  icons: { icon: { url: "/icons/ctfunil-orb.png", sizes: "64x64", type: "image/png" }, apple: "/icons/ctfunil-orb.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* aplica a aparência (claro/escuro/sistema) antes do paint — evita flash e texto cinza no dark */}
        <script dangerouslySetInnerHTML={{ __html: `
          (() => {
            const root = document.documentElement;
            const workspaceKey = "ct-workspace-theme";
            function applyWorkspaceTheme() {
              const saved = localStorage.getItem(workspaceKey) || localStorage.getItem("ctf-theme");
              root.dataset.ctMode = saved === "light" || saved === "system" ? saved : "dark";
            }
            try {
              const publicTheme = localStorage.getItem("ctf-theme") || "light";
              applyWorkspaceTheme();
              if (publicTheme === "system") root.removeAttribute("data-theme");
              else root.setAttribute("data-theme", publicTheme);
            } catch {}
            window.addEventListener("storage", event => {
              if (event.key !== workspaceKey && event.key !== "ctf-theme" && event.key !== null) return;
              try {
                if (event.storageArea === localStorage) applyWorkspaceTheme();
              } catch {}
            });
          })();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
