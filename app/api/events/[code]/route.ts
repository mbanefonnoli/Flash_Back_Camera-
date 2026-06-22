import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { code: string } }
) {
  const code = params.code.toUpperCase();
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("events")
    .select("name, developed, max_shots, max_guests")
    .eq("code", code)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: "Event not found." }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      name: data.name,
      developed: data.developed,
      maxShots: data.max_shots ?? 27,
      maxGuests: data.max_guests ?? 0,
    },
  });
}
