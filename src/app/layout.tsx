import type { Metadata } from "next";
import "./globals.css";
import { getSession } from "@/lib/auth";
import { getUserSetting, DEFAULT_APPEARANCE } from "@/lib/settings";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getBrandingSettings } from "@/app/actions/lookups";

export const metadata: Metadata = {
  title: "مدیریت پایانه و مانور خط یک مترو تهران — فتح‌آباد",
  description: "سیستم ثبت و مدیریت مانور قطار",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "مدیریت پایانه و مانور",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  const appearance = session
    ? await getUserSetting(session.id, "appearance", DEFAULT_APPEARANCE)
    : DEFAULT_APPEARANCE;

  const branding = await getBrandingSettings();
  const accentColor = branding.accentColor || "#d8842a";

  return (
    <html lang="fa" dir="rtl">
      <head>
        <link rel="stylesheet" href="/fonts/font-face.css" />
        <style dangerouslySetInnerHTML={{ __html: `
          :root {
            --accent: ${accentColor} !important;
            --accent-soft: ${accentColor}14 !important;
            --accent-hover: ${accentColor}d9 !important;
          }
        ` }} />
      </head>
      <body>
        <ThemeProvider initialAppearance={appearance}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
