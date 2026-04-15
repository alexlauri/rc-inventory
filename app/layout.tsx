import "./globals.css";
import localFont from "next/font/local";
import AppShell from "./AppShell";

export const metadata = {
  title: "Joplin",
  description: "Operations Tools",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

const cabinet = localFont({
  src: [
    { path: "../public/fonts/CabinetGrotesk-Regular.woff2", weight: "400", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk-Medium.woff2", weight: "500", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk-Bold.woff2", weight: "700", style: "normal" },
    { path: "../public/fonts/CabinetGrotesk-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-cabinet",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${cabinet.variable} text-black`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}