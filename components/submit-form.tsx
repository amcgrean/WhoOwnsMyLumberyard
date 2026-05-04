"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";

const SubmissionSchema = z.object({
  email: z.string().email(),
  subject: z.string().min(2, "Tell us which yard, company, or owner this is about."),
  claim: z.string().min(10, "Describe the claim in at least a sentence."),
  sourceUrl: z.string().url("A source URL is required."),
  notes: z.string().optional(),
});

type SubmissionInput = z.infer<typeof SubmissionSchema>;

export function SubmitForm() {
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SubmissionInput>({ resolver: zodResolver(SubmissionSchema) });

  async function onSubmit(values: SubmissionInput) {
    setStatus("submitting");
    setServerError(null);
    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      setStatus("success");
      reset();
    } catch (err) {
      setStatus("error");
      setServerError(err instanceof Error ? err.message : "Submission failed");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-md border border-[var(--color-rule)] p-6">
        <h2 className="font-serif text-xl">Thanks — submission received.</h2>
        <p className="mt-2 text-[var(--color-muted)]">
          We review every submission. If your tip leads to a database update, you&rsquo;ll see it
          appear within a few days.
        </p>
        <button
          type="button"
          className="mt-4 text-sm underline"
          onClick={() => setStatus("idle")}
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <Field label="Your email" error={errors.email?.message}>
        <input
          type="email"
          autoComplete="email"
          {...register("email")}
          className="input"
          placeholder="you@example.com"
        />
      </Field>
      <Field
        label="Which yard, company, or owner is this about?"
        error={errors.subject?.message}
      >
        <input
          type="text"
          {...register("subject")}
          className="input"
          placeholder='e.g. "Beisser Lumber, Grimes IA" or "US LBM"'
        />
      </Field>
      <Field
        label="The claim or correction"
        error={errors.claim?.message}
        hint="What should the database say?"
      >
        <textarea
          {...register("claim")}
          rows={4}
          className="input"
          placeholder="e.g. US LBM acquired Beisser Lumber in March 2022."
        />
      </Field>
      <Field
        label="Source URL"
        error={errors.sourceUrl?.message}
        hint="Required. A link to a press release, SEC filing, news article, or store-locator page."
      >
        <input type="url" {...register("sourceUrl")} className="input" placeholder="https://..." />
      </Field>
      <Field label="Notes (optional)">
        <textarea {...register("notes")} rows={3} className="input" />
      </Field>
      {serverError ? (
        <p className="text-sm text-[var(--color-badge-pe)]">{serverError}</p>
      ) : null}
      <button
        type="submit"
        disabled={status === "submitting"}
        className="rounded-md bg-[var(--color-accent)] text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {status === "submitting" ? "Sending…" : "Submit"}
      </button>

      <style jsx>{`
        .input {
          display: block;
          width: 100%;
          border: 1px solid var(--color-rule);
          border-radius: 6px;
          padding: 0.55rem 0.75rem;
          font-size: 1rem;
          background: var(--color-paper);
          color: var(--color-ink);
        }
        .input:focus {
          outline: none;
          border-color: var(--color-accent);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-accent) 25%, transparent);
        }
      `}</style>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm mb-1">{label}</span>
      {hint ? <span className="block text-xs text-[var(--color-muted)] mb-1">{hint}</span> : null}
      {children}
      {error ? <span className="block text-xs text-[var(--color-badge-pe)] mt-1">{error}</span> : null}
    </label>
  );
}
