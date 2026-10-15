import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Guest menu · Billora", robots: { index: false, follow: false } };

export default async function GuestMenu({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(token)) notFound();
  let response: Response;
  try { response = await fetch(`${process.env.DJANGO_API_URL || "http://127.0.0.1:8000"}/api/guest/${token}/`, { cache: "no-store", signal: AbortSignal.timeout(10000) }); }
  catch { return <main className="guest-menu"><h1>Menu temporarily unavailable</h1><p>Please ask a member of staff for a menu.</p></main>; }
  if (response.status === 404) notFound();
  if (!response.ok) return <main className="guest-menu"><h1>Please ask staff for a menu</h1></main>;
  const data: { name: string; kind: string; menu: { id: string; name: string; category: string; price_cents: number }[] } = await response.json();
  return <main className="guest-menu"><span className="eyebrow">BILLORA · WELCOME</span><h1>Something delicious<br />starts here.</h1><p>{data.name} · {data.kind}</p><div className="guest-menu__note">Browse the menu, then ask your server to place an order.</div>{Array.from(new Set(data.menu.map(m => m.category))).map(category => <section key={category}><h2>{category}</h2>{data.menu.filter(m => m.category === category).map(m => <article key={m.id}><h3>{m.name}</h3><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(m.price_cents / 100)}</strong></article>)}</section>)}{!data.menu.length && <p>The menu is being prepared. Please ask your host for available items.</p>}<footer>Prices in USD. Any applicable tax is shown on your bill.</footer></main>;
}
