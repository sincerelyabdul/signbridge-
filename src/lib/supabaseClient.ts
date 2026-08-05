import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';

const isPlaceholder = 
  !supabaseUrl || 
  !supabaseAnonKey || 
  supabaseUrl.includes('your-project-reference') || 
  supabaseAnonKey.includes('your-supabase-anon');

if (isPlaceholder) {
  console.warn(
    'SignBridge Warning: Supabase API keys are not configured. The application is running in local offline/simulation mode.'
  );
}

// Fallback to placeholder values if keys are missing to prevent runtime crash
export const supabase = createClient(
  isPlaceholder ? 'https://placeholder-project.supabase.co' : supabaseUrl,
  isPlaceholder ? 'placeholder-anon-key' : supabaseAnonKey
);
