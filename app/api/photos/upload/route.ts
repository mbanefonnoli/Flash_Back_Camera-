import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getPublicUrl } from "@/lib/supabase-public";

export async function POST(request: Request) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;
  const eventCode = (formData.get("eventCode") as string | null)?.trim().toUpperCase();
  const guestName = (formData.get("guestName") as string | null)?.trim();

  if (!image || !eventCode || !guestName) {
    return NextResponse.json(
      { success: false, error: "image, eventCode, and guestName are required." },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("developed, max_shots, max_guests")
    .eq("code", eventCode)
    .single();

  if (eventError || !event) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  if (event.developed) {
    return NextResponse.json(
      { success: false, error: "Film already developed — no more shots." },
      { status: 400 }
    );
  }

  // Enforce per-guest shot limit
  const maxShots = event.max_shots ?? 27;
  const { count: guestShotCount } = await supabase
    .from("photos")
    .select("id", { count: "exact", head: true })
    .eq("event_code", eventCode)
    .eq("guest_name", guestName);

  if ((guestShotCount ?? 0) >= maxShots) {
    return NextResponse.json(
      { success: false, error: `You've used all ${maxShots} shots.` },
      { status: 400 }
    );
  }

  // Enforce max guests limit (only checked when guest takes their first photo)
  const maxGuests = event.max_guests ?? 0;
  if (maxGuests > 0 && (guestShotCount ?? 0) === 0) {
    const { data: guestRows } = await supabase
      .from("photos")
      .select("guest_name")
      .eq("event_code", eventCode);
    const uniqueGuests = new Set((guestRows ?? []).map((r) => r.guest_name)).size;
    if (uniqueGuests >= maxGuests) {
      return NextResponse.json(
        { success: false, error: "This event is full — no more guests allowed." },
        { status: 400 }
      );
    }
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const storagePath = `${eventCode}/${crypto.randomUUID()}.jpg`;

  const { error: storageError } = await supabase.storage
    .from("photos")
    .upload(storagePath, buffer, { contentType: "image/jpeg", upsert: false });

  if (storageError) {
    return NextResponse.json({ success: false, error: storageError.message }, { status: 500 });
  }

  const { error: dbError } = await supabase.from("photos").insert({
    event_code: eventCode,
    guest_name: guestName,
    storage_path: storagePath,
  });

  if (dbError) {
    await supabase.storage.from("photos").remove([storagePath]);
    return NextResponse.json({ success: false, error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { url: getPublicUrl(storagePath) } });
}
