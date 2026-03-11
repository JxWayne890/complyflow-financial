const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewnyzqcsuuhiyhnoxbta.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3bnl6cWNzdXVoaXlobm94YnRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2Nzc0ODAsImV4cCI6MjA4NjI1MzQ4MH0.QuO5Wt4-TvbfzV9UKRiUizF45X0pBMzqyqNEO8klhXU';

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase
    .from('content_versions')
    .select('body, title, chart_data')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (error) {
    console.error("Error:", error);
  } else {
    data.forEach((row, i) => {
      console.log(`\n--- DRAFT ${i + 1}: ${row.title} ---`);
      console.log("CHART DATA:", !!row.chart_data);
      console.log("BODY LENGTH:", row.body?.length);
      console.log("BODY START:", row.body?.substring(0, 150));
      console.log("FULL BODY:", row.body);
    });
  }
}
check();
