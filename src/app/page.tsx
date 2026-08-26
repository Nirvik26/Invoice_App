"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowUp, Bell, CalendarBlank, CaretDown, ChartLineUp,
  Check, CheckCircle, Clock, Copy, DownloadSimple, FileText, GearSix,
  GridFour, MagnifyingGlass, PaperPlaneTilt, Plus, Question, Receipt,
  Sparkle, Trash, TrendUp, UserCircle, UsersThree, X,
} from "@phosphor-icons/react";

type View = "overview" | "invoices" | "clients" | "editor";
type Status = "Paid" | "Sent" | "Overdue" | "Draft";
type Item = { id: number; description: string; rate: number; qty: number };
type Invoice = { id: string; client: string; company: string; amount: number; due: string; status: Status; initials: string; tone: string };

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const invoices: Invoice[] = [
  { id:"INV-1038", client:"Mira Chen", company:"Atelier Miro", amount:5184, due:"Sep 05", status:"Sent", initials:"MC", tone:"peach" },
  { id:"INV-1037", client:"Noah Williams", company:"Northline Studio", amount:3400, due:"Sep 01", status:"Paid", initials:"NW", tone:"blue" },
  { id:"INV-1036", client:"Sofia Patel", company:"Common Ground", amount:2750, due:"Aug 26", status:"Overdue", initials:"SP", tone:"rose" },
  { id:"INV-1035", client:"Eli Foster", company:"Field Notes Co.", amount:1850, due:"Aug 24", status:"Draft", initials:"EF", tone:"green" },
  { id:"INV-1034", client:"Amara Okafor", company:"Studio Aster", amount:6200, due:"Aug 18", status:"Paid", initials:"AO", tone:"violet" },
];
const clients = [
  { name:"Mira Chen", company:"Atelier Miro", email:"mira@ateliermiro.com", total:12480, projects:4, initials:"MC", tone:"peach" },
  { name:"Amara Okafor", company:"Studio Aster", email:"hello@studioaster.co", total:9700, projects:3, initials:"AO", tone:"violet" },
  { name:"Noah Williams", company:"Northline Studio", email:"noah@northline.studio", total:8400, projects:3, initials:"NW", tone:"blue" },
  { name:"Sofia Patel", company:"Common Ground", email:"sofia@commonground.co", total:6250, projects:2, initials:"SP", tone:"rose" },
];

function Avatar({ initials, tone, large=false }: { initials:string; tone:string; large?:boolean }) {
  return <span className={`avatar ${tone}${large ? " large" : ""}`}>{initials}</span>;
}
function Badge({ status }: { status:Status }) {
  return <span className={`badge ${status.toLowerCase()}`}><i />{status}</span>;
}

export default function Home() {
  const [view,setView] = useState<View>("overview");
  const [query,setQuery] = useState("");
  const [filter,setFilter] = useState<"All"|Status>("All");
  const [toast,setToast] = useState("");
  const [draftReady,setDraftReady] = useState(false);
  const [client,setClient] = useState("Mira Chen");
  const [sent,setSent] = useState(false);
  const [items,setItems] = useState<Item[]>([
    {id:1,description:"Brand strategy workshop",rate:1200,qty:1},
    {id:2,description:"Visual identity direction",rate:1800,qty:1},
    {id:3,description:"Website design · 4 pages",rate:450,qty:4},
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = localStorage.getItem("billora-draft");
      if (saved) {
        try {
          const draft = JSON.parse(saved) as { items?:Item[]; client?:string };
          if (draft.items?.length) setItems(draft.items);
          if (draft.client) setClient(draft.client);
        } catch { localStorage.removeItem("billora-draft"); }
      }
      setDraftReady(true);
    },0);
    return () => window.clearTimeout(timer);
  },[]);
  useEffect(() => {
    if (draftReady) localStorage.setItem("billora-draft",JSON.stringify({items,client}));
  },[items,client,draftReady]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""),2600);
    return () => window.clearTimeout(timer);
  },[toast]);

  const shownInvoices = useMemo(() => {
    const q=query.toLowerCase().trim();
    return invoices.filter((invoice) => (!q || [invoice.id,invoice.client,invoice.company].some((value)=>value.toLowerCase().includes(q))) && (filter==="All" || invoice.status===filter));
  },[query,filter]);
  const shownClients = useMemo(() => {
    const q=query.toLowerCase().trim();
    return clients.filter((entry)=>!q || [entry.name,entry.company,entry.email].some((value)=>value.toLowerCase().includes(q)));
  },[query]);
  const subtotal=useMemo(()=>items.reduce((sum,item)=>sum+item.rate*item.qty,0),[items]);
  const tax=subtotal*.08;
  const total=subtotal+tax;
  const go=(next:View)=>{setView(next);setQuery("");};
  const notify=(message:string)=>setToast(message);

  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand" onClick={()=>go("overview")}><span className="brand-mark">b</span><span>billora</span></button>
      <nav aria-label="Primary navigation">
        <button className={view==="overview"?"active":""} onClick={()=>go("overview")}><GridFour size={19}/><span>Overview</span></button>
        <button className={view==="invoices"||view==="editor"?"active":""} onClick={()=>go("invoices")}><Receipt size={20}/><span>Invoices</span><em>5</em></button>
        <button className={view==="clients"?"active":""} onClick={()=>go("clients")}><UsersThree size={20}/><span>Clients</span></button>
        <button onClick={()=>notify("Reports are ready for your next growth chapter")}><ChartLineUp size={20}/><span>Reports</span></button>
      </nav>
      <div className="sidebar-bottom">
        <button onClick={()=>notify("Help center opened")}><Question size={20}/><span>Help center</span></button>
        <button onClick={()=>notify("Workspace settings opened")}><GearSix size={20}/><span>Settings</span></button>
        <div className="account"><Avatar initials="JD" tone="blue"/><div><strong>Jordan Davis</strong><span>Studio plan</span></div><CaretDown size={14}/></div>
      </div>
    </aside>

    <section className="workspace">
      <header className="topbar">
        <div className="mobile-brand"><span className="brand-mark">b</span><b>billora</b></div>
        {view==="editor"
          ? <button className="back" onClick={()=>go("invoices")}><ArrowLeft size={18}/> Back to invoices</button>
          : <label className="search"><MagnifyingGlass size={18}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder={view==="clients"?"Search clients...":"Search invoices..."}/><kbd>⌘ K</kbd></label>}
        <div className="top-actions"><button className="bell" onClick={()=>notify("You’re all caught up")} aria-label="Notifications"><Bell size={19}/><i/></button>{view!=="editor"&&<button className="primary" onClick={()=>setView("editor")}><Plus size={17}/> New invoice</button>}</div>
      </header>

      {view!=="editor" && <div className="page">
        <div className="page-heading"><div><p className="eyebrow">WORKSPACE / {view.toUpperCase()}</p><h1>{view==="overview"?"Overview":view==="invoices"?"Invoices":"Clients"}</h1><p>{view==="overview"?"Good morning, Jordan. Here’s how your business is moving.":view==="invoices"?"Track every invoice from draft to paid.":"Keep your best relationships and revenue in view."}</p></div><div className="period"><CalendarBlank size={17}/> Aug 1 – Aug 26, 2026 <CaretDown size={13}/></div></div>
        {view==="overview"&&<Overview onCreate={()=>setView("editor")} onInvoices={()=>go("invoices")}/>}
        {view==="invoices"&&<Invoices rows={shownInvoices} filter={filter} setFilter={setFilter} onCreate={()=>setView("editor")}/>}
        {view==="clients"&&<Clients rows={shownClients} onAdd={()=>notify("New client flow is ready to connect")}/>}
      </div>}

      {view==="editor"&&<Editor items={items} client={client} total={total} subtotal={subtotal} tax={tax} sent={sent} setClient={setClient} update={(id,key,value)=>setItems(rows=>rows.map(item=>item.id===id?{...item,[key]:value}:item))} add={()=>setItems(rows=>[...rows,{id:Date.now(),description:"New service",rate:0,qty:1}])} remove={(id)=>setItems(rows=>rows.filter(item=>item.id!==id))} send={()=>{setSent(true);notify(`Invoice sent to ${client}`);}} copy={async()=>{try{await navigator.clipboard.writeText(`${location.origin}/invoice/INV-1039`);}catch{}notify("Secure invoice link copied");}} notify={notify}/>}
    </section>
    {toast&&<div className="toast" role="status"><span><Check size={15}/></span>{toast}<button onClick={()=>setToast("")} aria-label="Dismiss"><X size={14}/></button></div>}
  </main>;
}

function Overview({onCreate,onInvoices}:{onCreate:()=>void;onInvoices:()=>void}) {
  const bars=[45,62,51,78,68,92,73,105,81,120];
  return <><section className="metrics">
    <article className="revenue-metric"><div><span>Revenue this month</span><b><ArrowUp size={12}/> 18.4%</b></div><strong>$24,860</strong><div className="mini-chart">{bars.map((height,i)=><i key={i} style={{height}} className={i>7?"hot":""}/>)}</div><p><Sparkle size={14} weight="fill"/> You’re on track for your best month yet.</p></article>
    <article><span className="metric-icon green"><TrendUp size={20}/></span><small>Outstanding</small><strong>$8,934</strong><p><b>3 invoices</b> waiting for payment</p></article>
    <article><span className="metric-icon amber"><Clock size={20}/></span><small>Overdue</small><strong>$2,750</strong><p><b>1 invoice</b> needs attention</p></article>
    <article><span className="metric-icon violet"><UsersThree size={20}/></span><small>Active clients</small><strong>12</strong><p><b>+2 new</b> this month</p></article>
  </section>
  <section className="overview-grid">
    <article className="panel chart-panel"><PanelTitle eyebrow="CASH FLOW" title="Revenue pulse"/><div className="bar-chart">{[38,55,44,72,63,88].map((height,i)=><div key={i}><span><i style={{height:`${height}%`}}/><i style={{height:`${Math.max(20,height-17)}%`}}/></span><small>{["Mar","Apr","May","Jun","Jul","Aug"][i]}</small></div>)}</div></article>
    <article className="panel quick"><PanelTitle eyebrow="SHORTCUT" title="Get paid, faster"/><p>Turn finished work into revenue while it’s still fresh.</p><button onClick={onCreate}><span><FileText size={21}/></span><div><b>Create an invoice</b><small>Start from your saved template</small></div><ArrowUp className="diagonal"/></button><div className="rate"><span>On-time payment rate <b>92%</b></span><i><em/></i><small>4% above businesses like yours</small></div></article>
  </section>
  <section className="panel recent"><div className="panel-heading"><PanelTitle eyebrow="RECENT ACTIVITY" title="Latest invoices"/><button onClick={onInvoices}>View all <ArrowUp className="diagonal"/></button></div><InvoiceTable rows={invoices.slice(0,4)}/></section></>;
}

function PanelTitle({eyebrow,title}:{eyebrow:string;title:string}) { return <div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>; }
function InvoiceTable({rows}:{rows:Invoice[]}) {
  return <div className="invoice-table"><div className="invoice-row table-head"><span>Client</span><span>Invoice</span><span>Due</span><span>Status</span><span>Amount</span></div>{rows.map(invoice=><button className="invoice-row" key={invoice.id}><span className="client"><Avatar initials={invoice.initials} tone={invoice.tone}/><span><b>{invoice.client}</b><small>{invoice.company}</small></span></span><span className="mono">{invoice.id}</span><span>{invoice.due}</span><Badge status={invoice.status}/><strong>{money.format(invoice.amount)}</strong></button>)}</div>;
}
function Invoices({rows,filter,setFilter,onCreate}:{rows:Invoice[];filter:"All"|Status;setFilter:(v:"All"|Status)=>void;onCreate:()=>void}) {
  const filters:("All"|Status)[]=["All","Draft","Sent","Paid","Overdue"];
  return <section className="panel invoices-panel"><div className="filters">{filters.map(entry=><button key={entry} className={filter===entry?"active":""} onClick={()=>setFilter(entry)}>{entry}<span>{entry==="All"?invoices.length:invoices.filter(invoice=>invoice.status===entry).length}</span></button>)}</div>{rows.length?<InvoiceTable rows={rows}/>:<div className="empty"><MagnifyingGlass size={25}/><h3>No invoices found</h3><p>Try another search or create a fresh invoice.</p><button className="primary" onClick={onCreate}><Plus/> New invoice</button></div>}</section>;
}
function Clients({rows,onAdd}:{rows:typeof clients;onAdd:()=>void}) {
  return <><div className="client-summary"><article><span>Total client value</span><strong>$36,830</strong><small><ArrowUp/> 12.6% from last month</small></article><article><span>Average project</span><strong>$3,069</strong><small>Across 12 active projects</small></article><button onClick={onAdd}><Plus/> Add new client</button></div><section className="client-grid">{rows.map(client=><article key={client.email}><div><Avatar initials={client.initials} tone={client.tone} large/><span>{client.projects} projects</span></div><h3>{client.name}</h3><p>{client.company}</p><a href={`mailto:${client.email}`}>{client.email}</a><footer><span>Lifetime value</span><b>{money.format(client.total)}</b></footer></article>)}</section></>;
}

function Editor({items,client,total,subtotal,tax,sent,setClient,update,add,remove,send,copy,notify}:{items:Item[];client:string;total:number;subtotal:number;tax:number;sent:boolean;setClient:(v:string)=>void;update:(id:number,key:keyof Item,value:string|number)=>void;add:()=>void;remove:(id:number)=>void;send:()=>void;copy:()=>void;notify:(v:string)=>void}) {
  return <div className="editor-page"><div className="editor-heading"><div><p className="eyebrow">DRAFT / INV-1039</p><h1>New invoice</h1></div><span><CheckCircle weight="fill"/> Saved to this device</span></div><div className="editor-layout"><section className="invoice-paper"><header><div><span className="brand-mark">b</span><b>billora studio</b></div><span>INVOICE</span></header><div className="invoice-meta"><label><span>Bill to</span><div><UserCircle/><input value={client} onChange={e=>setClient(e.target.value)} aria-label="Client name"/><CaretDown/></div><small>mira@ateliermiro.com</small></label><label><span>Invoice number</span><input value="INV-1039" readOnly/></label><label><span>Due date</span><div><CalendarBlank/><input value="Sep 09, 2026" readOnly/></div></label></div><div className="lines"><div className="line line-head"><span>Service</span><span>Rate</span><span>Qty</span><span>Amount</span><span/></div>{items.map(item=><div className="line" key={item.id}><input className="description" value={item.description} onChange={e=>update(item.id,"description",e.target.value)}/><div className="money"><span>$</span><input type="number" min="0" value={item.rate} onChange={e=>update(item.id,"rate",Number(e.target.value))}/></div><input className="qty" type="number" min="1" value={item.qty} onChange={e=>update(item.id,"qty",Number(e.target.value))}/><b>{money.format(item.rate*item.qty)}</b><button onClick={()=>remove(item.id)} aria-label="Remove item"><Trash/></button></div>)}<button className="add" onClick={add}><Plus/> Add line item</button></div><div className="paper-footer"><label><span>Notes</span><textarea defaultValue="Thank you for working with us. Payment is due within 14 days."/></label><div><p><span>Subtotal</span><span>{money.format(subtotal)}</span></p><p><span>Tax <em>8%</em></span><span>{money.format(tax)}</span></p><p><b>Total</b><b>{money.format(total)}</b></p></div></div></section><aside className="editor-side"><section><p className="eyebrow">INVOICE TOTAL</p><strong>{money.format(total)}</strong><small>USD · due in 14 days</small><div className="payment"><Sparkle weight="fill"/><div><b>Online payments on</b><p>Your client can pay securely by card.</p></div><button onClick={()=>notify("Online payments are enabled")}><Check/></button></div><button className="send" onClick={send}>{sent?<><CheckCircle weight="fill"/> Invoice sent</>:<><PaperPlaneTilt weight="fill"/> Send invoice</>}</button><button className="download" onClick={()=>window.print()}><DownloadSimple/> Download PDF</button></section><section className="share"><div><Copy/><span><b>Share a secure link</b><p>Anyone with the link can view and pay.</p></span></div><button onClick={copy}>Copy link</button></section><p className="tip"><Sparkle weight="fill"/> Billora remembers this draft on your device.</p></aside></div></div>;
}
