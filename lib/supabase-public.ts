import { createClient } from "@supabase/supabase-js";

const client = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function getPublicUrl(storagePath: string): string {
  const { data } = client.storage.from("photos").getPublicUrl(storagePath);
  return data.publicUrl;
}
