import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { HospitalityWorkspace } from "@/components/hospitality/HospitalityWorkspace";

export default async function HospitalityPage() {
  if (!await getSession()) redirect("/sign-in");
  return <main className="hospitality-standalone"><Link className="btn btn--ghost" href="/">← Invoices & overview</Link><HospitalityWorkspace /></main>;
}
