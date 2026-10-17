"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WidgetBoard, type Preferences } from "./WidgetBoard";

export function WorkspaceWidgets() {
  const [data, setData] = useState<Preferences | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/hospitality/settings", { signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(setData).catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);
  if (failed) return <p className="widget-hint">Widgets could not load. <Link href="/settings">Open settings to retry</Link></p>;
  if (!data) return null;
  return <section aria-label="Your widgets" className="workspace-widgets"><div className="hospitality__toolbar"><h3>{data.business_name || "Your widgets"}</h3><Link href="/settings" className="btn btn--ghost">Customize widgets</Link></div>{data.widgets.some(w => w.enabled) ? <WidgetBoard widgets={data.widgets} /> : <p className="widget-hint">Add your payment QR, notices, or useful links in Settings.</p>}</section>;
}
