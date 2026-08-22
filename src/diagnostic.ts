
import { supabase } from './lib/supabase';

async function inspectSchema() {
  const tables = ['buildings', 'floors', 'rooms', 'floor_maps', 'accessibility_features'];
  
  for (const table of tables) {
    console.log(`--- Inspecting foreign keys for table: ${table} ---`);
    
    // This query is specific to PostgreSQL information_schema
    const { data, error } = await (supabase as any).from('information_schema.key_column_usage')
      .select('column_name, referenced_table_name, referenced_column_name')
      .eq('table_name', table);
    
    if (error) {
      console.error(`Error fetching foreign keys for ${table}:`, error);
    } else {
      console.log(`Foreign keys for ${table}:`, JSON.stringify(data, null, 2));
    }
  }
}

inspectSchema();
