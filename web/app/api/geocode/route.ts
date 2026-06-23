import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN = process.env.MAPBOX_TOKEN;

/**
 * Server-side proxy for the Mapbox Search Box API (token never reaches the client;
 * no browser-origin restriction). Two modes, sharing a session_token:
 *   GET /api/geocode?q=<text>&session=<uuid>   → suggestions (addresses + businesses)
 *   GET /api/geocode?id=<mapbox_id>&session=<uuid> → retrieve (coordinates)
 */
export async function GET(req: Request) {
  if (!TOKEN) {
    return NextResponse.json({ error: "MAPBOX_TOKEN not configured" }, { status: 500 });
  }
  const { searchParams } = new URL(req.url);
  const session = searchParams.get("session") ?? "default";
  const id = searchParams.get("id");
  const q = searchParams.get("q");
  const types = searchParams.get("types"); // optional: e.g. "address,street" or "poi"

  let url: string;
  if (id) {
    url =
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}` +
      `?session_token=${encodeURIComponent(session)}&access_token=${TOKEN}`;
  } else if (q) {
    url =
      `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(q)}` +
      `&country=us&limit=6&session_token=${encodeURIComponent(session)}&access_token=${TOKEN}` +
      (types ? `&types=${encodeURIComponent(types)}` : "");
  } else {
    return NextResponse.json({ error: "q or id is required" }, { status: 400 });
  }

  try {
    const r = await fetch(url, { cache: "no-store" });
    const j = await r.json();
    return NextResponse.json(j, { status: r.status });
  } catch {
    return NextResponse.json({ error: "geocode upstream failed" }, { status: 502 });
  }
}
