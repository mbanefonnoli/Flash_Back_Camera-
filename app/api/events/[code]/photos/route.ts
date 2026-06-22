import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getPublicUrl } from "@/lib/supabase-public";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();
  const supabase = createServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("developed")
    .eq("code", code)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  if (!event.developed) {
    return NextResponse.json({ success: true, data: { photos: [], developed: false } });
  }

  const { data: rows, error: photosError } = await supabase
    .from("photos")
    .select("id, guest_name, storage_path, created_at")
    .eq("event_code", code)
    .order("created_at", { ascending: true });

  if (photosError) {
    return NextResponse.json({ success: false, error: photosError.message }, { status: 500 });
  }

  const photos = (rows ?? []).map((p) => ({
    id: p.id,
    guest_name: p.guest_name,
    url: getPublicUrl(p.storage_path),
    created_at: p.created_at,
  }));

  return NextResponse.json({ success: true, data: { photos, developed: true } });
}
