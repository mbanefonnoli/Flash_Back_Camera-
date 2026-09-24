import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createServerClient } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";
import { rateLimit, clientKey } from "@/lib/rate-limit";
import { CONTENT_TYPES, sniffImageType } from "@/lib/image";

const SHOT_OPTIONS = [12, 24, 27, 36];
const MAX_GUESTS_ALLOWED = 500;
const MAX_COVER_BYTES = 8 * 1024 * 1024;

// No I, L, O, 0 or 1 — these get misread when a host copies the code by hand.
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function randomRecoveryCode() {
  const bytes = randomBytes(12);
  let out = "";
  for (let i = 0; i < 12; i++) out += RECOVERY_ALPHABET[bytes[i] % RECOVERY_ALPHABET.length];
  return `${out.slice(0, 4)}-${out.slice(4, 8)}-${out.slice(8, 12)}`;
}

export async function POST(request: Request) {
  if (!rateLimit(clientKey(request, "create"), 5, 60_000)) {
    return NextResponse.json(
      { success: false, error: "Too many events created. Try again in a minute." },
      { status: 429 }
    );
  }

  const formData = await request.formData();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const hostPassword = (formData.get("host_password") as string | null)?.trim() ?? "";
  const cover = formData.get("cover") as File | null;

  if (!name || !hostPassword) {
    return NextResponse.json({ success: false, error: "Name and password required." }, { status: 400 });
  }

  if (name.length > 80) {
    return NextResponse.json({ success: false, error: "Event name is too long." }, { status: 400 });
  }
  if (hostPassword.length < 4 || hostPassword.length > 100) {
    return NextResponse.json(
      { success: false, error: "Password must be between 4 and 100 characters." },
      { status: 400 }
    );
  }

  const requestedShots = Number(formData.get("max_shots"));
  const requestedGuests = Number(formData.get("max_guests"));

  const shots = SHOT_OPTIONS.includes(requestedShots) ? requestedShots : 27;
  const guests = Number.isFinite(requestedGuests)
    ? Math.min(Math.max(Math.floor(requestedGuests), 0), MAX_GUESTS_ALLOWED)
    : 0;

  let coverBuffer: Buffer | null = null;
  let coverType: keyof typeof CONTENT_TYPES | null = null;

  if (cover && cover.size > 0) {
    if (cover.size > MAX_COVER_BYTES) {
      return NextResponse.json(
        { success: false, error: "Background image is too large (8MB max)." },
        { status: 400 }
      );
    }

    coverBuffer = Buffer.from(await cover.arrayBuffer());
    coverType = sniffImageType(coverBuffer);

    if (!coverType) {
      return NextResponse.json(
        { success: false, error: "Background must be a JPEG, PNG, or WebP image." },
        { status: 400 }
      );
    }
  }

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

  let coverPath: string | null = null;

  if (coverBuffer && coverType) {
    coverPath = `covers/${code}.${coverType}`;
    const { error: coverError } = await supabase.storage
      .from("photos")
      .upload(coverPath, coverBuffer, { contentType: CONTENT_TYPES[coverType], upsert: true });

    if (coverError) {
      return NextResponse.json({ success: false, error: coverError.message }, { status: 500 });
    }
  }

  const recoveryCode = randomRecoveryCode();

  const { error } = await supabase.from("events").insert({
    code,
    name,
    host_password: await hashPassword(hostPassword),
    recovery_hash: await hashPassword(recoveryCode),
    developed: false,
    max_shots: shots,
    max_guests: guests,
    cover_path: coverPath,
  });

  if (error) {
    if (coverPath) await supabase.storage.from("photos").remove([coverPath]);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // Only time the recovery code is ever readable — the DB holds a hash.
  return NextResponse.json({ success: true, data: { code, recoveryCode } });
}
