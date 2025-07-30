import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "PDF-adel | MERGE, SPLIT, SELECT PDF by faaadelmr",
  description: "All Progress on Your Browser, NO NEED UPLOAD so it's Secure. Easily select, split, merge, and manage your PDF files. A fast, secure, and CYBERNETIC PDF toolkit. #CobaAjaDulu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Jolly+Lodger&display=swap" rel="stylesheet"></link>
        <link href="https://fonts.googleapis.com/css2?family=Freckle+Face&family=Jolly+Lodger&display=swap" rel="stylesheet"></link>
        <link href="https://fonts.googleapis.com/css2?family=Keania+One&display=swap" rel="stylesheet"></link>
        <meta name="google-site-verification" content="htKXIrnMVh-JK6DalCRA5vi_QUxxXm1Ary_MOCR2Gmc" />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
