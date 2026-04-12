import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Upload an image to the profile-pictures bucket and return its public URL.
 */
export async function uploadProfilePictureFile(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be less than 5MB");
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const storagePath = `${userId}/${Date.now()}.${fileExt}`;

  let { error: uploadError } = await supabase.storage
    .from("profile-pictures")
    .upload(storagePath, file, { cacheControl: "3600", upsert: true });

  if (
    uploadError &&
    (uploadError.message?.includes("not found") ||
      uploadError.message?.includes("Bucket"))
  ) {
    const createRes = await fetch("/api/storage/create-bucket", { method: "POST" });
    if (createRes.ok) {
      const retry = await supabase.storage
        .from("profile-pictures")
        .upload(storagePath, file, { cacheControl: "3600", upsert: true });
      uploadError = retry.error;
    }
  }

  if (uploadError) {
    throw new Error(
      uploadError.message ||
        "Upload failed. Ensure the profile-pictures bucket exists (Storage → New bucket → public)."
    );
  }

  const { data: urlData } = supabase.storage
    .from("profile-pictures")
    .getPublicUrl(storagePath);

  return urlData.publicUrl;
}
