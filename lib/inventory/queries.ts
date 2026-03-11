import { createClient } from "@/lib/supabase/client";

export async function getActiveInventoryItems() {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("active", true)
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createCountSession() {
  const supabase = createClient();

  // 1. create the count session
  const { data: count, error: countError } = await supabase
    .from("inventory_counts")
    .insert({
      status: "draft",
      trailer_complete: false,
      storage_complete: false,
    })
    .select("*")
    .single();

  if (countError) {
    throw countError;
  }

  // 2. fetch active items
  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  // 3. create one line per item
  const lines =
    items?.map((item) => ({
      inventory_count_id: count.id,
      inventory_item_id: item.id,
      trailer_qty: 0,
      storage_qty: 0,
      notes: null,
      item_name: item.name,
      item_category: item.category,
      item_unit: item.unit,
      item_threshold: item.threshold,
      item_par: item.par,
      item_sort_order: item.sort_order,
    })) ?? [];

  const { error: linesError } = await supabase
    .from("inventory_count_lines")
    .insert(lines);

  if (linesError) {
    throw linesError;
  }

  return count;
}