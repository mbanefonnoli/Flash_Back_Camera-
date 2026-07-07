import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, name, rating, body, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { reviews: data ?? [] } });
}

export async function POST(request: Request) {
  const { name, rating, body } = await request.json();

  const trimmedName = typeof name === "string" ? name.trim() : "";
  const trimmedBody = typeof body === "string" ? body.trim() : "";
  const ratingNum = Number(rating);

  if (!trimmedName || !trimmedBody) {
    return NextResponse.json({ success: false, error: "Name and review text are required." }, { status: 400 });
  }
  if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return NextResponse.json({ success: false, error: "Rating must be between 1 and 5." }, { status: 400 });
  }
  if (trimmedName.length > 60 || trimmedBody.length > 500) {
    return NextResponse.json({ success: false, error: "Name or review text is too long." }, { status: 400 });
  }

  const supabase = createServerClient();
  const { error } = await supabase.from("reviews").insert({
    name: trimmedName,
    rating: ratingNum,
    body: trimmedBody,
  });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
