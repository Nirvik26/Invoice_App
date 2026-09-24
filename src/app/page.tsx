import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/auth";
import {
  getInvoicesForUser,
  getClientsForUser,
  getDashboardStats,
  getNextInvoiceNumber,
} from "@/lib/queries";
import { AppShell } from "@/components/AppShell";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [user, invoiceRows, clientRows, stats, nextNumber] = await Promise.all([
    getUserById(session.userId),
    getInvoicesForUser(session.userId),
    getClientsForUser(session.userId),
    getDashboardStats(session.userId),
    getNextInvoiceNumber(session.userId),
  ]);

  if (!user) redirect("/sign-in");

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        plan: user.plan,
        initials: user.initials,
        tone: user.tone,
      }}
      invoices={invoiceRows}
      clients={clientRows}
      stats={stats}
      nextInvoiceNumber={nextNumber}
    />
  );
}
