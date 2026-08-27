import type { Metadata } from "next";
import "leaflet/dist/leaflet.css";

import "./globals.css";

import { QueryProvider } from "@/components/query-provider";

export const metadata: Metadata = {
  title: "NMS Dashboard",
  description: "Professional NMS dashboard for ThingsBoard-backed operations.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
