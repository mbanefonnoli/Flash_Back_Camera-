import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();
  const { password } = await request.json();

  if (!password) {
    return NextResponse.json({ success: false, error: "Password required." }, { status: 400 });
  }

  const supabase = createServerClient();

  const { data: event, error: fetchError } = await supabase
    .from("events")
    .select("host_password, developed")
    .eq("code", code)
    .single();

  if (fetchError || !event) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  if (event.host_password !== password) {
    return NextResponse.json({ success: false, error: "Incorrect password." }, { status: 401 });
  }

  if (event.developed) {
    return NextResponse.json({ success: true, data: { already: true } });
  }

  const { error: updateError } = await supabase
    .from("events")
    .update({ developed: true })
    .eq("code", code);

  if (updateError) {
    return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
