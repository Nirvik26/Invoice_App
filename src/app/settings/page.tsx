import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { SettingsWorkspace } from "@/components/settings/SettingsWorkspace";

export default async function SettingsPage() {
  if (!await getSession()) redirect("/sign-in");
  return <main className="hospitality-standalone"><Link href="/" className="btn btn--ghost">← Back to workspace</Link><h1 className="settings-title">Settings & widgets</h1><SettingsWorkspace /></main>;
}
