import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST() {
  try {
    // Verify user is authenticated
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if service role key is available
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { 
          error: "Service role key not configured. Please create the bucket manually in Supabase Dashboard → Storage." 
        },
        { status: 500 }
      );
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error("Error listing buckets:", listError);
      return NextResponse.json(
        { error: "Failed to check buckets" },
        { status: 500 }
      );
    }

    const bucketExists = buckets?.some((b) => b.name === "profile-pictures");

    if (bucketExists) {
      return NextResponse.json({ 
        success: true, 
        message: "Bucket already exists" 
      });
    }

    // Create the bucket using admin client
    const { data, error } = await supabaseAdmin.storage.createBucket(
      "profile-pictures",
      {
        public: true,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        fileSizeLimit: 5242880, // 5MB
      }
    );

    if (error) {
      console.error("Error creating bucket:", error);
      return NextResponse.json(
        { error: error.message || "Failed to create bucket" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Bucket created successfully",
      data,
    });
  } catch (err: any) {
    console.error("Bucket creation error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to create bucket" },
      { status: 500 }
    );
  }
}

