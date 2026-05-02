import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";

const Body = z.object({
  email: z.string().email(),
  subject: z.string().min(2),
  claim: z.string().min(10),
  sourceUrl: z.string().url(),
  notes: z.string().optional(),
});

export async function POST(req: Request) {
  let parsed;
  try {
    const json = await req.json();
    parsed = Body.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid submission" }, { status: 400 });
  }

  const [row] = await db
    .insert(submissions)
    .values({
      submitterEmail: parsed.email,
      subjectType: parsed.subject,
      claim: parsed.claim,
      sourceUrl: parsed.sourceUrl,
      notes: parsed.notes ?? null,
    })
    .returning({ id: submissions.id });

  // Notify the operator. Resend is optional in dev — silently no-op if unset.
  const resendKey = process.env.RESEND_API_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (resendKey && adminEmail) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(resendKey);
      await resend.emails.send({
        from: "Who Owns My Lumberyard <noreply@whoownsmylumberyard.com>",
        to: adminEmail,
        subject: `New tip: ${parsed.subject}`,
        text: [
          `From: ${parsed.email}`,
          `Subject: ${parsed.subject}`,
          ``,
          `Claim:`,
          parsed.claim,
          ``,
          `Source: ${parsed.sourceUrl}`,
          parsed.notes ? `\nNotes:\n${parsed.notes}` : "",
        ].join("\n"),
      });
    } catch (err) {
      console.error("[submit] Resend send failed", err);
    }
  }

  return NextResponse.json({ ok: true, id: row.id });
}
