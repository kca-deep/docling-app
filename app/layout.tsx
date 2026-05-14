import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SideNav, SideNavMobileBar } from "@/components/side-nav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "KCA-AI Hub",
  description: "한국방송통신전파진흥원 AI 허브",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased tracking-tight bg-noise selection:bg-purple-500/30`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          forcedTheme="dark"
          disableTransitionOnChange
        >
          <AuthProvider>
            <div className="flex h-screen overflow-hidden bg-background">
              <SideNav />
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <SideNavMobileBar />
                <main className="flex-1 overflow-y-auto overflow-x-hidden">{children}</main>
              </div>
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
