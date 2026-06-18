import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../../utils/supabase/server";
import { createAdminClient } from "../../../../../utils/supabase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const admin = createAdminClient();
  const { data: file } = await admin
    .from("evidence_files")
    .select("storage_path, original_name, content_type")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!file) return new NextResponse("Not found", { status: 404 });

  const base = process.env.EWNAF_HOST;
  const token = process.env.EWNAF_UPLOAD_TOKEN;
  if (!base || !token) return new NextResponse("Storage not configured", { status: 503 });

  let upstream: Response;
  try {
    upstream = await fetch(`${base}/evidence/serve/${file.storage_path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    return new NextResponse("Storage unreachable", { status: 502 });
  }

  if (!upstream.ok) return new NextResponse("File not found on server", { status: 404 });

  const blob = await upstream.blob();
  return new NextResponse(blob, {
    headers: {
      "Content-Type": file.content_type ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(file.original_name)}"`,
    },
  });
}
