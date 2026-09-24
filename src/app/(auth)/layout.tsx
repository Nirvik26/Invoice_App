import type { Metadata } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Billora — Sign in",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
