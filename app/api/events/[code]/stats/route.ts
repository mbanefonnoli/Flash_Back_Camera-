import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();
  const guest = request.nextUrl.searchParams.get("guest");
  const supabase = createServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("developed")
    .eq("code", code)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  const { count: photoCount } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("event_code", code);

  const { data: guestRows } = await supabase
    .from("photos")
    .select("guest_name")
    .eq("event_code", code);

  const guestCount = new Set((guestRows ?? []).map((r) => r.guest_name)).size;

  const result: Record<string, unknown> = {
    photoCount: photoCount ?? 0,
    guestCount,
    developed: event.developed,
  };

  if (guest) {
    const { count: guestShots } = await supabase
      .from("photos")
      .select("id", { count: "exact", head: true })
      .eq("event_code", code)
      .eq("guest_name", guest);
    result.guestShots = guestShots ?? 0;
  }

  return NextResponse.json({ success: true, data: result });
}
