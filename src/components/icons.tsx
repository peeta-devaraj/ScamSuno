export type IconName = "wave" | "phone" | "end" | "arrow" | "arrow-up" | "shield" | "mic" | "keyboard" |
  "lock" | "headphones" | "replay" | "check" | "close" | "warning" | "download" | "share" | "link" | "globe";

const paths: Record<IconName, string> = {
  wave: "M2 12h4l2-6 4 12 4-12 2 6h4",
  phone: "M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3.1a2 2 0 0 1-.6 2.1l-1.3 1.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.6l3.1.5a2 2 0 0 1 1.8 2.1Z",
  end: "M2 15v-2a3 3 0 0 1 1.4-2.6 16 16 0 0 1 17.2 0A3 3 0 0 1 22 13v2a1 1 0 0 1-1.2 1l-4-1a1 1 0 0 1-.8-1v-1a12 12 0 0 0-8 0v1a1 1 0 0 1-.8 1l-4 1A1 1 0 0 1 2 15Z",
  arrow: "M4 12h15m-6-6 6 6-6 6", "arrow-up": "M6 18 18 6M8 6h10v10",
  shield: "m12 22 1.5-.7C18 19 21 15 21 10V5l-9-3-9 3v5c0 5 3 9 7.5 11.3L12 22Zm-4-10 2.5 2.5 5.5-6",
  mic: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Zm-6 8v1a6 6 0 0 0 12 0v-1m-6 7v5m-3 0h6",
  keyboard: "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 4h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M18 13h.01m-8 2h4",
  lock: "M5 10h14v11H5Zm3 0V6a4 4 0 0 1 8 0v4m-4 5v2",
  headphones: "M3 14v-2a9 9 0 0 1 18 0v2M3 13h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm18 0h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2Z",
  replay: "M3 12a9 9 0 1 1 2.6 6.4M3 12V5m0 7h7", check: "m4 12 5 5L20 6", close: "m6 6 12 12M18 6 6 18",
  warning: "m10.5 4-8 14a1.7 1.7 0 0 0 1.5 2.5h16a1.7 1.7 0 0 0 1.5-2.5l-8-14a1.7 1.7 0 0 0-3 0ZM12 9v4m0 3h.01",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  share: "M12 16V3m-5 5 5-5 5 5M5 12H3v9h18v-9h-2",
  link: "M10 13a4 4 0 0 0 6 .4l3-3a4 4 0 0 0-5.7-5.7L12 6m2 5a4 4 0 0 0-6-.4l-3 3a4 4 0 0 0 5.7 5.7L12 18",
  globe: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0 0c5-5.5 5-14.5 0-20-5 5.5-5 14.5 0 20ZM2 12h20",
};

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>;
}
