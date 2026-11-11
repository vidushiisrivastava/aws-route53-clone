import type { Metadata } from "next";
import "@cloudscape-design/global-styles/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amazon Route 53 Console",
  description: "Amazon Route 53 Web Management Console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="awsui-dark-mode" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
