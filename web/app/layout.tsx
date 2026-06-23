import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/shell/theme-provider";
import { QuoteProvider } from "@/lib/quote-store";
import { AppShell } from "@/components/shell/app-shell";

export const metadata: Metadata = {
  title: { default: "InfraSure · Outage Pricing", template: "%s · Outage Pricing" },
  description: "Parametric outage-insurance pricing — quote an address, drill the math.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QuoteProvider>
            <AppShell>{children}</AppShell>
          </QuoteProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
