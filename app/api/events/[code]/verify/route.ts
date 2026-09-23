import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { verifyPassword } from "@/lib/password";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();

  if (!rateLimit(clientKey(request, `verify:${code}`), 10, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Try again in a minute." },
      { status: 429 }
    );
  }

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

  if (!(await verifyPassword(password, event.host_password))) {
    return NextResponse.json({ success: false, error: "Incorrect password." }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
