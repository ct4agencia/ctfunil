import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CTFUNNEL",
  description: "Construtor de funis de quiz gamificado",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* aplica a aparência (claro/escuro/sistema) antes do paint — evita flash e texto cinza no dark */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('ctf-theme')||'light';var d=document.documentElement;if(t==='system'){d.removeAttribute('data-theme');}else{d.setAttribute('data-theme',t);}}catch(e){}})();` }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
