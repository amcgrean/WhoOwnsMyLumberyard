import { NextResponse } from "next/server";
import { searchAll } from "@/lib/search";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20));
  if (!q.trim()) return NextResponse.json({ results: [] });
  const results = await searchAll(q, limit);
  return NextResponse.json({ results });
}
