"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { createMutationClient } from "@/lib/mutation-client";
import { WidgetBoard, type Preferences, type Widget } from "./WidgetBoard";

type Draft = Omit<Widget, "id" | "position"> & { id?: string };
const blank = (): Draft => ({ kind: "qr", title: "", content: "", url: "", image_data: "", enabled: true, public: false });

export function SettingsWorkspace() {
  const mutate = useRef(createMutationClient());
  const [data, setData] = useState<Preferences | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const editor = useRef<HTMLFormElement>(null);
  const load = useCallback(async () => {
    const response = await fetch("/api/hospitality/settings");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load settings.");
    setData(result);
  }, []);
  useEffect(() => {
    // Network hydration sets state after the asynchronous response.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load().catch(e => setError(e instanceof Error ? e.message : "Could not load settings."));
  }, [load]);
  async function save(payload: Record<string, unknown>) {
    setBusy(true); setError(""); setNotice("");
    try {
      const submission = { ...payload };
      // Existing images use an authenticated asset URL; only send new file bytes.
      if (typeof submission.image_data === "string" && submission.image_data.startsWith("/api/hospitality/widget-image/")) delete submission.image_data;
      await mutate.current("/api/hospitality/settings", submission);
      setNotice("Changes saved.");
      try { await load(); } catch { setError("Saved, but the view could not refresh. Reload settings before making another change."); }
      return true;
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save settings."); return false; }
    finally { setBusy(false); }
  }
  function edit(widget?: Widget) {
    setDraft(widget ? { ...widget } : blank()); setEditing(true); setError(""); setNotice("");
    requestAnimationFrame(() => editor.current?.scrollIntoView({ behavior: "smooth", block: "center" }));
  }
  async function readImage(file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      setError("Choose a PNG, JPEG, or WebP image up to 2 MB."); return;
    }
    setReading(true); setError("");
    try {
      const image_data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read this image. Try again."));
        reader.readAsDataURL(file);
      });
      setDraft(value => ({ ...value, image_data }));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not read image."); }
    finally { setReading(false); }
  }
  return <section className="settings-workspace">
    <div className="hospitality__hero"><div><span className="eyebrow">MAKE IT YOURS</span><h2>One workspace. Your way.</h2><p>Business details, payment QR images, and the little things your team needs.</p></div></div>
    {error && <div className="hospitality__error" role="alert">{error}<button onClick={() => void load().then(() => setError("")).catch(() => setError("Settings unavailable. Start the Django backend and retry."))}>Retry connection</button></div>}
    {notice && <p role="status" className="hospitality__notice">{notice}</p>}
    {!data && !error && <p role="status">Loading settings…</p>}
    {data && <>
      <form className="card settings-profile" key={`${data.business_name}:${data.receipt_note}`} onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); void save({ action: "profile", business_name: form.get("business_name"), receipt_note: form.get("receipt_note") }); }}>
        <div><h3>Business profile</h3><p>Shown on your hospitality dashboard and guest menus.</p></div>
        <label>Business name<input name="business_name" defaultValue={data.business_name} maxLength={100} placeholder="Your restaurant or property" /></label>
        <label>Guest message<textarea name="receipt_note" defaultValue={data.receipt_note} maxLength={300} placeholder="Thank you for visiting us." rows={2} /></label>
        <button className="btn btn--primary" disabled={busy}>Save business details</button>
      </form>
      <div className="hospitality__toolbar"><div><h3>Widgets <small>{data.widgets.length} / 12</small></h3><p>Add QR codes, notices, and links. Use the arrows to change their order.</p></div><button className="btn btn--primary" disabled={busy || reading || data.widgets.length >= 12} onClick={() => edit()}>+ Add widget</button></div>
      {editing && <form ref={editor} className="card settings-editor" onSubmit={async e => { e.preventDefault(); if (await save({ action: "save", ...draft })) { setEditing(false); setDraft(blank()); } }}>
        <h3>{draft.id ? "Edit widget" : "New widget"}</h3>
        <div className="settings-fields"><label>Widget type<select value={draft.kind} disabled={reading || busy} onChange={e => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}><option value="qr">QR code image</option><option value="note">Text notice</option><option value="link">Useful link</option></select></label><label>Title<input value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} required maxLength={100} placeholder="Scan to pay, Wi-Fi, or today's special" /></label></div>
        {draft.kind === "qr" && <div className="settings-upload"><label>Upload QR code<input key={draft.id || "new"} type="file" accept="image/png,image/jpeg,image/webp" disabled={busy || reading} onChange={e => void readImage(e.target.files?.[0])} /></label><p>PNG, JPEG, or WebP · maximum 2 MB / 4 megapixels. Use the original QR image for clear scanning.</p>{reading && <p role="status">Reading image…</p>}{draft.image_data && <Image src={draft.image_data} unoptimized alt="Uploaded QR preview" width={200} height={200} className="widget-card__qr" />}<small>Uploading a payment QR does not verify or automatically record payments.</small></div>}
        {draft.kind === "link" && <label>Link URL<input type="url" required value={draft.url} maxLength={1000} onChange={e => setDraft({ ...draft, url: e.target.value })} placeholder="https://example.com" /></label>}
        <label>Description<textarea rows={3} value={draft.content} onChange={e => setDraft({ ...draft, content: e.target.value })} maxLength={1000} placeholder="Instructions or information for this widget" /></label>
        <div className="settings-checks"><label><input type="checkbox" checked={draft.enabled} onChange={e => setDraft({ ...draft, enabled: e.target.checked })} /> Show on dashboard</label><label><input type="checkbox" checked={draft.public} onChange={e => setDraft({ ...draft, public: e.target.checked })} /> Also show on public guest menus</label></div><p className="widget-hint">Hidden widgets are not displayed on either surface. Public widgets are visible to anyone with a guest-menu link.</p>
        <div className="hospitality__actions"><button className="btn btn--primary" disabled={busy || reading || (draft.kind === "qr" && !draft.image_data)}>Save widget</button><button type="button" className="btn btn--ghost" disabled={reading || busy} onClick={() => setEditing(false)}>Cancel</button></div>
      </form>}
      {!data.widgets.length && !editing && <div className="hospitality__empty"><h3>Your QR code belongs here.</h3><p>Upload a payment or Wi-Fi QR, or add a notice for your team.</p><button className="btn btn--primary" onClick={() => edit()}>Upload your first QR</button></div>}
      <div className="settings-widget-list">{data.widgets.map((widget, index) => <article className="card settings-widget-row" key={widget.id}><div>{widget.kind === "qr" && <Image unoptimized src={widget.image_data} width={64} height={64} alt={`${widget.title} thumbnail`} />}<div><h4>{widget.title}</h4><small>{widget.kind === "qr" ? "QR image" : widget.kind} · {widget.enabled ? widget.public ? "Dashboard + guest menus" : "Dashboard only" : "Hidden"}</small></div></div><div className="settings-row-actions"><button className="btn btn--ghost" disabled={busy || reading} onClick={() => edit(widget)}>Edit</button><button aria-label={`Move ${widget.title} up`} disabled={busy || index === 0} onClick={() => void save({ action: "move", id: widget.id, direction: "up" })}>↑</button><button aria-label={`Move ${widget.title} down`} disabled={busy || index === data.widgets.length - 1} onClick={() => void save({ action: "move", id: widget.id, direction: "down" })}>↓</button><button className="btn btn--ghost" disabled={busy} onClick={() => setDeleting(widget.id)}>Remove</button></div>{deleting === widget.id && <div className="settings-delete" role="alert"><p>Remove “{widget.title}” and its uploaded image?</p><button className="btn btn--ghost" disabled={busy} onClick={async () => { if (await save({ action: "delete", id: widget.id })) { setDeleting(null); if (draft.id === widget.id) setEditing(false); } }}>Confirm removal</button><button className="btn btn--ghost" onClick={() => setDeleting(null)}>Keep widget</button></div>}</article>)}</div>
      {data.widgets.some(w => w.enabled) && <section className="settings-preview"><h3>Dashboard preview</h3><WidgetBoard widgets={data.widgets} /></section>}
      <article className="card settings-database"><h3>Database connection</h3><p>Hospitality backend: <strong>{data.database}</strong></p><p>Neon is configured through server environment variables. Credentials are never stored in a widget or shown here.</p></article>
    </>}
  </section>;
}
