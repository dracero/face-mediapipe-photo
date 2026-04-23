// Client-side database entry point
// This file will be compiled by Astro and made available to client scripts

import { supabase, initializeSupabaseCompat } from '../lib/photo-storage/SupabaseCompatLayer';

// Export for client-side use
export { supabase, initializeSupabaseCompat };

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  (window as any).initializeSupabaseCompat = initializeSupabaseCompat;
}