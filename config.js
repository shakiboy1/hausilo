// Hausilo settings. The site stays in "coming soon" mode until the first two values are filled in.
// Where to find them: Supabase dashboard > your project > Connect (or Settings > API Keys).
window.HAUSILO = {
  supabaseUrl: "",       // Project URL, looks like https://abcdefghijkl.supabase.co
  supabaseKey: "",       // Publishable key, starts with sb_publishable_   (never paste a key that starts with sb_secret_)
  resetByEmail: false    // change to true once Supabase can send email from your own address (Authentication > Emails > SMTP)
};
