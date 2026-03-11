import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pin = String(body.pin ?? "").trim();
    const supabase = createClient();

    if (!pin) {
      return NextResponse.json(
        { error: "PIN is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, active")
      .eq("pin", pin)
      .eq("active", true)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to log in",
          details: error.message,
          code: error.code,
          hint: error.hint,
        },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Invalid PIN" },
        { status: 401 }
      );
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to log in",
      },
      { status: 500 }
    );
  }
}