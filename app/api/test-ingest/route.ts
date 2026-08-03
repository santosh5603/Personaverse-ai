import { NextResponse, type NextRequest } from "next/server";
import { fetchYoutubeThumbnail, processUploadedImage } from "@/lib/contentIngestion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");

      if (!(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "No file field found in the multipart body" },
          { status: 400 },
        );
      }

      const result = await processUploadedImage(file);
      return NextResponse.json({
        ok: true,
        source: "upload",
        fileName: file.name,
        mimeType: result.mimeType,
        byteLength: result.byteLength,
        base64Length: result.base64.length,
      });
    }

    const body = await req.json();
    const youtubeUrl = body?.youtubeUrl;

    if (typeof youtubeUrl !== "string" || youtubeUrl.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Provide { youtubeUrl } as JSON or a multipart file upload" },
        { status: 400 },
      );
    }

    const result = await fetchYoutubeThumbnail(youtubeUrl);
    return NextResponse.json({
      ok: true,
      source: "youtube",
      thumbnailQuality: result.thumbnailQuality,
      mimeType: result.mimeType,
      byteLength: result.byteLength,
      base64Length: result.base64.length,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 400 },
    );
  }
}
