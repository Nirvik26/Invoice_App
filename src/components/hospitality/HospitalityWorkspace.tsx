"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Bed, ForkKnife, House, QrCode, UsersThree, Plus, Receipt, ArrowClockwise } from "@phosphor-icons/react";

type Space = { id: string; name: string; kind: string; capacity: number; rate_cents: number; token: string };
type Staff = { id: string; name: string; role: string; active: boolean };
type Menu = { id: string; name: string; category: string; price_cents: number };
type Bill = { id: string; number: string; space_id: string; space_name: string; kind: string; staff_name: string; guest: string; check_in: string | null; check_out: string | null; status: string; payment_method: string; tax_percent: number; subtotal_cents: number; tax_cents: number; total_cents: number; lines: { id: number; description: string; rate_cents: number; quantity: number }[] };
type Workspace = { spaces: Space[]; staff: Staff[]; menu: Menu[]; bills: Bill[] };
type Tab = "restaurant" | "hotel" | "homestay" | "staff" | "qr" | "bills";
const tabs = [{ id: "restaurant", label: "Restaurant", icon: ForkKnife }, { id: "hotel", label: "Hotel", icon: Bed }, { id: "homestay", label: "Homestay", icon: House }, { id: "staff", label: "Staff", icon: UsersThree }, { id: "qr", label: "QR codes", icon: QrCode }, { id: "bills", label: "Bills & receipts", icon: Receipt }] as const;
const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);

export function HospitalityWorkspace({ query = "" }: { query?: string }) {
  const receiptRef = useRef<HTMLElement>(null);
  const [data, setData] = useState<Workspace | null>(null);
  const [tab, setTab] = useState<Tab>("restaurant");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [menuAdding, setMenuAdding] = useState(false);
  const [opening, setOpening] = useState<Space | null>(null);
  useEffect(() => {
    if (!selected || !receiptRef.current) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = receiptRef.current;
    const focusable = () => Array.from(panel.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href]'));
    focusable()[0]?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSelected(null);
      if (event.key !== "Tab") return;
      const elements = focusable();
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
    panel.addEventListener("keydown", onKey);
    return () => { panel.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; previous?.focus(); };
  }, [selected]);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/hospitality/workspace");
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load billing.");
      setData(result);
      setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load billing."); }
  }, []);
  // Initial network hydration updates state only after the response arrives.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  async function command(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/hospitality/command", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to save.");
      await load(); setAdding(false); setMenuAdding(false); setOpening(null); setNotice("Saved successfully.");
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save."); return false; }
    finally { setBusy(false); }
  }
  const bill = data?.bills.find(b => b.id === selected);
  const visibleSpaces = data?.spaces.filter(s => s.kind === tab && s.name.toLowerCase().includes(query.toLowerCase())) ?? [];
  const openBills = data?.bills.filter(b => b.status === "open") ?? [];
  const settled = data?.bills.filter(b => b.status === "paid") ?? [];
  function switchTab(value: Tab) { setTab(value); setSelected(null); setAdding(false); setMenuAdding(false); setOpening(null); }
  return <section className="hospitality">
    <div className="hospitality__hero"><div><span className="eyebrow">BILLORA · HOSPITALITY</span><h2>Good service. Seamless billing.</h2><p>From the first order to the last night. Keep every charge together.</p></div><button className="btn btn--ghost" onClick={() => void load()} aria-label="Refresh billing"><ArrowClockwise size={18} /> Refresh</button></div>
    <div className="hospitality__stats"><div><span>Open bills</span><strong>{openBills.length}</strong></div><div><span>Unsettled charges</span><strong>{money(openBills.reduce((sum, b) => sum + b.total_cents, 0))}</strong></div><div><span>Cash collected · all time</span><strong>{money(settled.reduce((sum, b) => sum + b.total_cents, 0))}</strong></div><div><span>Active staff</span><strong>{data?.staff.filter(s => s.active).length ?? 0}</strong></div></div>
    <div className="hospitality__tabs" role="tablist" aria-label="Hospitality sections">{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => switchTab(id)}><Icon size={18} />{label}</button>)}</div>
    {error && <div className="hospitality__error" role="alert">{error}<button onClick={() => void load()}>Retry</button></div>}
    {notice && <p role="status" className="hospitality__notice">{notice}</p>}
    {!data && !error && <p role="status">Loading your workspace…</p>}
    {data && <>
      <div className="hospitality__toolbar"><div><h3>{tabs.find(t => t.id === tab)?.label}</h3><p>{tab === "qr" ? "Print a code for each table or room. Guests scan to view your menu." : tab === "staff" ? "Manage your team and assign a staff member to each bill." : tab === "bills" ? "Open tabs and settled receipts, all in one place." : "Choose a table or room to open its bill."}</p></div>{!["qr", "bills"].includes(tab) && <button className="btn btn--primary" onClick={() => setAdding(!adding)}><Plus size={16} />{tab === "staff" ? "Add staff" : tab === "restaurant" ? "Add table" : "Add room"}</button>}</div>
      {adding && <form className="hospitality__form card" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await command(tab === "staff" ? { action: "staff", name: f.get("name"), role: f.get("role") } : { action: "space", name: f.get("name"), kind: tab, capacity: Number(f.get("capacity")), rate_cents: Math.round(Number(f.get("rate") || 0) * 100) }); }}>
        <label>{tab === "staff" ? "Staff name" : "Table / room name"}<input name="name" required maxLength={100} placeholder={tab === "staff" ? "Alex Morgan" : tab === "restaurant" ? "Table 01" : "Garden suite"} /></label>
        {tab === "staff" ? <label>Role<select name="role"><option>Server</option><option>Manager</option><option>Reception</option><option>Housekeeping</option><option>Kitchen</option></select></label> : <><label>Capacity<input name="capacity" type="number" min="1" max="100" defaultValue="2" required /></label>{tab !== "restaurant" && <label>Nightly rate (USD)<input name="rate" type="number" min="0.01" max="1000000" step="0.01" required /></label>}</>}
        <button className="btn btn--primary" disabled={busy}>Save</button><button type="button" className="btn btn--ghost" onClick={() => setAdding(false)}>Cancel</button>
      </form>}
      {opening && <form className="hospitality__form card" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await command({ action: "open", space_id: opening.id, guest: f.get("guest"), staff_id: f.get("staff"), tax_percent: Number(f.get("tax")), check_in: f.get("check_in"), check_out: f.get("check_out") }); }}>
        <h3>Open bill · {opening.name}</h3><label>Guest name<input name="guest" defaultValue={opening.kind === "restaurant" ? "Walk-in" : ""} required maxLength={100} /></label><label>Assigned staff<select name="staff"><option value="">Unassigned</option>{data.staff.filter(s => s.active).map(s => <option value={s.id} key={s.id}>{s.name} · {s.role}</option>)}</select></label><label>Tax (%)<input name="tax" type="number" min="0" max="100" defaultValue="0" required /></label>
        {opening.kind !== "restaurant" && <><label>Check-in<input name="check_in" type="date" required /></label><label>Check-out<input name="check_out" type="date" required /></label><p>{money(opening.rate_cents)} per night. Room charges are added automatically.</p></>}
        <button disabled={busy} className="btn btn--primary">Open bill</button><button type="button" className="btn btn--ghost" onClick={() => setOpening(null)}>Cancel</button>
      </form>}
      {["restaurant", "hotel", "homestay"].includes(tab) && <div className="hospitality__grid">{visibleSpaces.map(s => { const active = openBills.find(b => b.space_id === s.id); return <button key={s.id} className={`hospitality__space card ${active ? "is-occupied" : ""}`} onClick={() => active ? setSelected(active.id) : setOpening(s)}><span className="hospitality__space-icon">{tab === "restaurant" ? <ForkKnife size={24} /> : <Bed size={24} />}</span><span className="hospitality__pill">{active ? "Open bill" : "Available"}</span><h3>{s.name}</h3><p>{s.capacity} {tab === "restaurant" ? "seats" : "guests"}{tab !== "restaurant" && ` · ${money(s.rate_cents)} / night`}</p><strong>{active ? money(active.total_cents) : "Start a new bill →"}</strong>{active?.staff_name && <small>Served by {active.staff_name}</small>}</button>; })}{visibleSpaces.length === 0 && <div className="hospitality__empty"><House size={32} /><h3>{query ? "No matching spaces" : "Make room for your first guest"}</h3><p>Add {tab === "restaurant" ? "a table" : "a room"} to start billing.</p></div>}</div>}
      {tab === "staff" && <div className="hospitality__grid">{data.staff.map(s => <article className="card hospitality__person" key={s.id}><div className="hospitality__avatar">{s.name.slice(0, 2).toUpperCase()}</div><h3>{s.name}</h3><p>{s.role} · {s.active ? "Active" : "Inactive"}</p><button className="btn btn--ghost" disabled={busy} onClick={() => void command({ action: "staff_toggle", id: s.id })}>{s.active ? "Deactivate" : "Activate"}</button></article>)}{!data.staff.length && <p className="hospitality__empty">Add your first team member to assign service.</p>}</div>}
      {tab === "qr" && <div className="hospitality__grid">{data.spaces.map(s => <article className="card hospitality__qr" key={s.id}><span className="eyebrow">SCAN FOR THE MENU</span><Image unoptimized src={`/api/hospitality/qr/${s.token}`} alt={`Menu QR code for ${s.name}`} width={180} height={180} /><h3>{s.name}</h3><p>{s.kind}</p><div className="hospitality__actions"><a className="btn btn--ghost" href={`/guest/${s.token}`} target="_blank" rel="noreferrer">Preview</a><a className="btn btn--primary" href={`/api/hospitality/qr/${s.token}`} download={`${s.name}-menu.svg`}>Download QR</a></div></article>)}{!data.spaces.length && <p className="hospitality__empty">Add a table or room to generate its QR code.</p>}</div>}
      {tab === "bills" && <div className="hospitality__bill-list">{data.bills.filter(b => `${b.number} ${b.guest} ${b.space_name}`.toLowerCase().includes(query.toLowerCase())).map(b => <button className="card hospitality__bill-row" key={b.id} onClick={() => setSelected(b.id)}><div><b>{b.space_name}</b><small>{b.number} · {b.guest}</small></div><span className="hospitality__pill">{b.status === "paid" ? "Paid · cash" : "Open"}</span><strong>{money(b.total_cents)}</strong></button>)}{!data.bills.length && <p className="hospitality__empty">Your bills will appear here when you open a table or room.</p>}</div>}
      {["restaurant", "hotel", "homestay"].includes(tab) && <article className="card hospitality__menu"><div className="hospitality__toolbar"><div><span className="eyebrow">MENU & EXTRAS</span><h3>Little extras. All accounted for.</h3><p>Shared across your restaurant, rooms, and guest QR menus.</p></div><button className="btn btn--ghost" onClick={() => setMenuAdding(!menuAdding)}><Plus size={16} />Add item</button></div>{menuAdding && <form className="hospitality__form" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await command({ action: "menu", name: f.get("name"), category: f.get("category"), price_cents: Math.round(Number(f.get("price")) * 100) }); }}><label>Item name<input name="name" required maxLength={100} /></label><label>Category<input name="category" defaultValue="Kitchen" required maxLength={50} /></label><label>Price (USD)<input name="price" type="number" min="0.01" max="10000" step="0.01" required /></label><button disabled={busy} className="btn btn--primary">Save item</button></form>}<div className="hospitality__menu-items">{data.menu.map(m => <div key={m.id}><span><b>{m.name}</b><small>{m.category}</small></span><strong>{money(m.price_cents)}</strong></div>)}{!data.menu.length && <p>Add food, drinks, or services to your menu.</p>}</div></article>}
      {bill && <div className="hospitality__overlay" onClick={() => setSelected(null)}><section ref={receiptRef} className="hospitality__receipt" role="dialog" aria-modal="true" aria-label="Bill details" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === "Escape") setSelected(null); }}><div className="hospitality__toolbar"><div><span className="eyebrow">{bill.number}</span><h2>{bill.space_name}</h2></div><button className="btn btn--ghost" onClick={() => setSelected(null)}>Close</button></div><p>{bill.guest}{bill.staff_name && ` · Served by ${bill.staff_name}`}</p>{bill.check_in && <p>{bill.check_in} → {bill.check_out}</p>}<span className="hospitality__pill">{bill.status === "paid" ? "Paid · cash received" : "Open bill"}</span><div className="hospitality__lines">{bill.lines.map(l => <div key={l.id}><span><b>{l.description}</b><small>{l.quantity} × {money(l.rate_cents)}</small></span><strong>{money(l.rate_cents * l.quantity)}</strong>{bill.status === "open" && !l.description.includes("· nightly stay") && <button aria-label={`Remove ${l.description}`} disabled={busy} onClick={() => void command({ action: "remove", bill_id: bill.id, line_id: l.id })}>×</button>}</div>)}{!bill.lines.length && <p>Add the first item to this bill.</p>}</div><div className="hospitality__totals"><p><span>Subtotal</span><b>{money(bill.subtotal_cents)}</b></p><p><span>Tax ({bill.tax_percent}%)</span><b>{money(bill.tax_cents)}</b></p><p><strong>Total</strong><strong>{money(bill.total_cents)}</strong></p></div>{bill.status === "open" && <><form className="hospitality__form" onSubmit={async e => { e.preventDefault(); const f = new FormData(e.currentTarget); await command({ action: "add", bill_id: bill.id, menu_id: f.get("item"), quantity: Number(f.get("quantity")) }); }}><label>Menu item<select name="item" required><option value="">Choose an item</option>{data.menu.map(m => <option value={m.id} key={m.id}>{m.name} · {money(m.price_cents)}</option>)}</select></label><label>Quantity<input type="number" name="quantity" defaultValue="1" min="1" max="100" required /></label><button className="btn btn--ghost" disabled={busy || !data.menu.length}>Add to bill</button></form><form onSubmit={e => { e.preventDefault(); void command({ action: "settle", bill_id: bill.id, payment_method: "cash" }); }}><label className="hospitality__confirm"><input key={bill.total_cents} type="checkbox" required /> I have received {money(bill.total_cents)} in cash.</label><button className="btn btn--primary" disabled={busy || !bill.lines.length}>Settle & close bill</button></form></>}<button className="btn btn--ghost hospitality__print" onClick={() => window.print()}>Print receipt</button>{error && <p role="alert" className="hospitality__error">{error}</p>}</section></div>}
    </>}
  </section>;
}
