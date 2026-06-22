// Database types — shared between API routes and pages
// Do NOT import or instantiate a Supabase client from this file.
// Server-side DB access: @/lib/supabase-server
// Public URL building:   @/lib/supabase-public

export type Event = {
  id: string;
  code: string;
  name: string;
  host_password: string;
  developed: boolean;
  created_at: string;
};

export type Photo = {
  id: string;
  event_code: string;
  guest_name: string;
  storage_path: string;
  created_at: string;
};

// Returned by API routes (storage_path resolved to public URL server-side)
export type PhotoWithUrl = {
  id: string;
  guest_name: string;
  url: string;
  created_at: string;
};
