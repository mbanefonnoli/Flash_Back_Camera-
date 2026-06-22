import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function POST(request: Request) {
  const { name, host_password, max_shots, max_guests } = await request.json();

  if (!name?.trim() || !host_password?.trim()) {
    return NextResponse.json({ success: false, error: "Name and password required." }, { status: 400 });
  }

  const shots = typeof max_shots === "number" && max_shots > 0 ? max_shots : 27;
  const guests = typeof max_guests === "number" && max_guests >= 0 ? max_guests : 0;

  const supabase = createServerClient();
  let code = "";
  let attempts = 0;

  while (attempts < 10) {
    const candidate = randomCode();
    const { data } = await supabase
      .from("events")
      .select("code")
      .eq("code", candidate)
      .maybeSingle();

    if (!data) { code = candidate; break; }
    attempts++;
  }

  if (!code) {
    return NextResponse.json({ success: false, error: "Could not generate unique code." }, { status: 500 });
  }

  const { error } = await supabase.from("events").insert({
    code,
    name: name.trim(),
    host_password: host_password.trim(),
    developed: false,
    max_shots: shots,
    max_guests: guests,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { code } });
}
