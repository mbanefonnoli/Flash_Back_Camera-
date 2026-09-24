import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { rateLimit, clientKey } from "@/lib/rate-limit";

export async function POST(
  request: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();

  // Tighter than the login limits: this endpoint guards the whole event.
  if (!rateLimit(clientKey(request, `recover:${code}`), 5, 15 * 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const { recoveryCode, newPassword } = await request.json();

  if (!recoveryCode?.trim() || !newPassword?.trim()) {
    return NextResponse.json(
      { success: false, error: "Recovery code and new password are required." },
      { status: 400 }
    );
  }

  const password = newPassword.trim();
  if (password.length < 4 || password.length > 100) {
    return NextResponse.json(
      { success: false, error: "Password must be between 4 and 100 characters." },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: event } = await supabase
    .from("events")
    .select("recovery_hash")
    .eq("code", code)
    .single();

  if (!event) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  if (!event.recovery_hash) {
    return NextResponse.json(
      { success: false, error: "This event was created before recovery codes existed." },
      { status: 400 }
    );
  }

  const normalised = recoveryCode.trim().toUpperCase().replace(/\s/g, "");
  if (!(await verifyPassword(normalised, event.recovery_hash))) {
    return NextResponse.json({ success: false, error: "Incorrect recovery code." }, { status: 401 });
  }

  const { error } = await supabase
    .from("events")
    .update({ host_password: await hashPassword(password) })
    .eq("code", code);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
