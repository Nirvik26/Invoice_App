import { notFound } from "next/navigation";
import { proposalDetail } from "@/lib/proposals";
import { ProposalReview } from "@/components/proposals/ProposalReview";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private proposal · Billora", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const detail = await proposalDetail(token);
  if (!detail) notFound();
  return <div className="public-portal"><header className="public-portal__topbar"><div className="public-portal__brand"><span className="sidebar__logo">B</span><strong>Billora</strong><span>Client proposals</span></div></header><main className="flow-public"><ProposalReview detail={detail} client /></main></div>;
}
