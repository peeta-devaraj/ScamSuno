import type { Metadata } from "next";
import { mockMode } from "@/server/gnani/client";
import "./styles.css";

export const metadata: Metadata = {
  title: "ScamSuno — Can you survive a scam call?",
  description: "Practise answering a fictional bank scam call in English or Hindi. See the red flags and learn how to respond.",
};

// Also runs when Vercel builds the application.
mockMode();

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
