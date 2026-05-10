// supabase-config.js — Supabase project configuration.
//
// This file is loaded BEFORE auth.js on every page that needs auth.
// Keeping the config here (separate from auth.js) means the key won't
// get overwritten when auth.js is updated.
//
// SECURITY NOTE: This file IS publicly visible in the browser. The
// anon key is *designed* to be exposed — all security comes from Row
// Level Security (RLS) policies in Supabase.
//
// The service_role key (admin) must NEVER be in this file.

window.__SUPABASE_CONFIG = {
  url: 'https://jvcpzmumkyjdyibmwlsd.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp2Y3B6bXVta3lqZHlpYm13bHNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTY2MzYsImV4cCI6MjA4OTg5MjYzNn0.JBOAoMdotrbxmL3M4nFhdJ6yQWX45YbgtDCgMtJktSE'
};
