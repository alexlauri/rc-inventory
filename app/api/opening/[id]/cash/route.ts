import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_DENOMINATIONS = [
  { denomination: "$1", unit_value: 1, sort_order: 1 },
  { denomination: "$5", unit_value: 5, sort_order: 2 },
  { denomination: "$10", unit_value: 10, sort_order: 3 },
  { denomination: "$20", unit_value: 20, sort_order: 4 },
  { denomination: "$50", unit_value: 50, sort_order: 5 },
  { denomination: "$100", unit_value: 100, sort_order: 6 },
  { denomination: "coins", unit_value: 1, sort_order: 7 },
];

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: cashCount, error: cashCountError } = await supabase
      .from("opening_cash_counts")
      .select("id, status, actual_total, expected_total, variance")
      .eq("opening_run_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cashCountError) {
      throw new Error(cashCountError.message || "Failed to load cash count");
    }

    if (!cashCount) {
      return NextResponse.json({ cashCount: null, denominations: [] });
    }

    const { data: denominations, error: denominationError } = await supabase
      .from("opening_cash_count_denominations")
      .select("id, denomination, unit_value, quantity, amount, sort_order")
      .eq("cash_count_id", cashCount.id)
      .order("sort_order", { ascending: true });

    if (denominationError) {
      throw new Error(denominationError.message || "Failed to load denominations");
    }

    return NextResponse.json({
      cashCount,
      denominations: denominations ?? [],
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to load cash count",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: existingCashCount, error: existingError } = await supabase
      .from("opening_cash_counts")
      .select("id")
      .eq("opening_run_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      throw new Error(existingError.message || "Failed to check existing cash count");
    }

    if (existingCashCount) {
      return NextResponse.json({ cashCountId: existingCashCount.id });
    }

    const { data: cashCount, error: cashCountError } = await supabase
      .from("opening_cash_counts")
      .insert({
        opening_run_id: id,
        status: "draft",
        actual_total: 0,
      })
      .select("id")
      .single();

    if (cashCountError || !cashCount) {
      throw new Error(cashCountError?.message || "Failed to create cash count");
    }

    const denominationRows = DEFAULT_DENOMINATIONS.map((row) => ({
      cash_count_id: cashCount.id,
      denomination: row.denomination,
      unit_value: row.unit_value,
      quantity: row.denomination === "coins" ? null : 0,
      amount: 0,
      sort_order: row.sort_order,
    }));

    const { error: denominationError } = await supabase
      .from("opening_cash_count_denominations")
      .insert(denominationRows);

    if (denominationError) {
      throw new Error(denominationError.message);
    }

    return NextResponse.json({ cashCountId: cashCount.id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to init cash count" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createClient();

    const denominationId = body.denomination_id as string;
    const quantity = body.quantity as number | null;
    const amount = body.amount as number;

    if (!denominationId) {
      return NextResponse.json(
        { error: "denomination_id is required" },
        { status: 400 }
      );
    }

    const { error: denominationError } = await supabase
      .from("opening_cash_count_denominations")
      .update({
        quantity,
        amount,
      })
      .eq("id", denominationId);

    if (denominationError) {
      throw new Error(denominationError.message || "Failed to update denomination");
    }

    const { data: cashCount, error: cashCountError } = await supabase
      .from("opening_cash_counts")
      .select("id")
      .eq("opening_run_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cashCountError || !cashCount) {
      throw new Error(cashCountError?.message || "Failed to load cash count");
    }

    const { data: denominations, error: totalsError } = await supabase
      .from("opening_cash_count_denominations")
      .select("amount")
      .eq("cash_count_id", cashCount.id);

    if (totalsError) {
      throw new Error(totalsError.message || "Failed to recalculate total");
    }

    const actualTotal =
      denominations?.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) ?? 0;

    const { data: updatedCashCount, error: updateCashCountError } = await supabase
      .from("opening_cash_counts")
      .update({
        actual_total: actualTotal,
      })
      .eq("id", cashCount.id)
      .select("id, status, actual_total, expected_total, variance")
      .single();

    if (updateCashCountError) {
      throw new Error(updateCashCountError.message || "Failed to update cash total");
    }

    const { data: updatedDenomination, error: updatedDenominationError } = await supabase
      .from("opening_cash_count_denominations")
      .select("id, denomination, unit_value, quantity, amount, sort_order")
      .eq("id", denominationId)
      .single();

    if (updatedDenominationError || !updatedDenomination) {
      throw new Error(
        updatedDenominationError?.message || "Failed to load updated denomination"
      );
    }

    return NextResponse.json({
      denomination: updatedDenomination,
      cashCount: updatedCashCount,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to update cash count",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = createClient();

    const { data: cashCount, error: cashCountError } = await supabase
      .from("opening_cash_counts")
      .select("id")
      .eq("opening_run_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cashCountError) {
      throw new Error(cashCountError.message || "Failed to load cash count");
    }

    if (!cashCount) throw new Error("Missing cash count");

    const { data: denominations } = await supabase
      .from("opening_cash_count_denominations")
      .select("amount")
      .eq("cash_count_id", cashCount.id);

    const total =
      denominations?.reduce((sum, row) => sum + Number(row.amount ?? 0), 0) ?? 0;

    await supabase
      .from("opening_cash_counts")
      .update({
        status: "submitted",
        actual_total: total,
        submitted_at: new Date().toISOString(),
      })
      .eq("id", cashCount.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit" },
      { status: 500 }
    );
  }
}