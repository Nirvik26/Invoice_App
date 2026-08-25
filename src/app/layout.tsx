import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Billflow — Invoice workspace", description: "Create and send clear, beautiful invoices." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }
