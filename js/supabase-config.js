// Supabase 配置
var SUPABASE_URL = 'https://xdhogzcpqyishyepohvt.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkaG9nemNwcXlpc2h5ZXBvaHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5NDA0NjMsImV4cCI6MjA5MDUxNjQ2M30.lPiZriNywHX743EisWAGSbBh_yFMMXoDjEir8mPmo04';

// 等待 Supabase SDK 加载完成再初始化
function initSupabase() {
    if (window.supabase && window.supabase.createClient) {
        var db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        window.db = db;
        console.log('Supabase initialized');
    } else {
        setTimeout(initSupabase, 100);
    }
}
initSupabase();
