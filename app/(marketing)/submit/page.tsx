import type { Metadata } from "next";
import { SubmitForm } from "@/components/submit-form";

export const metadata: Metadata = {
  title: "Submit a correction",
  description: "Submit a source-backed correction or tip about a business, company, or owner.",
};

export default function SubmitPage() {
  return (
    <div className="mx-auto px-4 py-12 max-w-2xl">
      <h1 className="font-serif text-3xl mb-2">Submit a correction or tip</h1>
      <p className="text-[var(--color-muted)] mb-8">
        Spotted something wrong, or know an ownership detail that isn&rsquo;t here yet? Send it
        in. A source URL is required — every claim on this site links to a public document.
      </p>
      <SubmitForm />
    </div>
  );
}
