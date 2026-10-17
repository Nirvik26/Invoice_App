import Image from "next/image";

export type Widget = {
  id: string;
  kind: "qr" | "note" | "link";
  title: string;
  content: string;
  url: string;
  image_data: string;
  enabled: boolean;
  public: boolean;
  position: number;
};
export type Preferences = { business_name: string; receipt_note: string; widgets: Widget[]; database?: string };

export function WidgetBoard({ widgets }: { widgets: Widget[] }) {
  const visible = widgets.filter(w => w.enabled);
  if (!visible.length) return null;
  return <div className="widget-board">{visible.map(widget => <article key={widget.id} className={`widget-card widget-card--${widget.kind}`}>
    <span className="eyebrow">{widget.kind === "qr" ? "SCAN QR CODE" : widget.kind === "link" ? "QUICK LINK" : "NOTICE"}</span>
    <h3>{widget.title}</h3>
    {widget.kind === "qr" && widget.image_data && <Image unoptimized src={widget.image_data} alt={widget.title} width={200} height={200} className="widget-card__qr" />}
    {widget.content && <p>{widget.content}</p>}
    {widget.kind === "link" && <a href={widget.url} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">Open link ↗</a>}
    {widget.kind === "qr" && <a href={widget.image_data} download="qr-code.png" className="btn btn--ghost">Download QR</a>}
  </article>)}</div>;
}
