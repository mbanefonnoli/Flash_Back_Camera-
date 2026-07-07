import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function DELETE(
  request: Request,
  { params }: { params: { code: string; id: string } }
) {
  const code = params.code.toUpperCase();
  const { id } = params;
  const { password } = await request.json();

  if (!password) {
    return NextResponse.json({ success: false, error: "Password required." }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("host_password")
    .eq("code", code)
    .single();

  if (!event) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  if (event.host_password !== password) {
    return NextResponse.json({ success: false, error: "Incorrect password." }, { status: 401 });
  }

  const { data: photo } = await supabase
    .from("photos")
    .select("storage_path")
    .eq("id", id)
    .eq("event_code", code)
    .single();

  if (!photo) {
    return NextResponse.json({ success: false, error: "Photo not found." }, { status: 404 });
  }

  // Remove from storage first, then DB
  await supabase.storage.from("photos").remove([photo.storage_path]);

  const { error } = await supabase.from("photos").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
