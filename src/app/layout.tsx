import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WikiTrack — Comparateur de cartes",
  description: "Comparez les annonces du marché à vos prix moyens.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
