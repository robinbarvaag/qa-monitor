import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@qa/ui/sidebar";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "qa-monitor",
  description: "QA-overvåking av nettsteder: a11y, SEO, lenker, tastatur.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="no" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="min-w-0">
            <SiteHeader />
            <main className="min-w-0 flex-1 overflow-x-hidden">{children}</main>
          </SidebarInset>
        </SidebarProvider>
      </body>
    </html>
  );
}
