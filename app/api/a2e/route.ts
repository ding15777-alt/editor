import { NextRequest, NextResponse } from "next/server";

const API_ORIGIN = "https://video.a2e.ai";

function token() {
  return process.env.A2E_API_TOKEN;
}

async function a2e(path: string, init: RequestInit = {}) {
  const apiToken = token();
  if (!apiToken) throw new Error("A2E_API_TOKEN is not configured. Add it in your Vercel project settings to enable live generations.");
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as { message?: string; error?: string; data?: { uploadUrl?: string; cdnUrl?: string } } & Record<string, unknown>;
  if (!response.ok) throw new Error(body.message || body.error || `A2E returned ${response.status}.`);
  return body;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { action?: string; name?: string; contentType?: string; size?: number; payload?: unknown };
    if (body.action === "upload-url") {
      const name = String(body.name || "upload.png").replace(/[^a-zA-Z0-9._-]/g, "-");
      const data = await a2e("/api/v1/r2/upload-presigned-url", {
        method: "POST",
        body: JSON.stringify({ key: `motionroom-${Date.now()}-${name}`, purpose: "STAGING", contentType: body.contentType || "image/png", fileSize: body.size }),
      });
      const upload = data?.data;
      if (!upload?.uploadUrl || !upload?.cdnUrl) throw new Error("A2E did not return an upload destination.");
      return NextResponse.json({ uploadUrl: upload.uploadUrl, cdnUrl: upload.cdnUrl });
    }
    if (body.action === "generate-video") return NextResponse.json(await a2e("/api/v1/userImage2Video/start", { method: "POST", body: JSON.stringify(body.payload) }));
    if (body.action === "generate-image") return NextResponse.json(await a2e("/api/v1/userText2Image/start", { method: "POST", body: JSON.stringify(body.payload) }));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete the request." }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const kind = request.nextUrl.searchParams.get("kind");
    const id = request.nextUrl.searchParams.get("id");
    if (!id || (kind !== "video" && kind !== "image")) return NextResponse.json({ error: "Task id and kind are required." }, { status: 400 });
    const path = kind === "video" ? `/api/v1/userImage2Video/${encodeURIComponent(id)}` : `/api/v1/userText2Image/${encodeURIComponent(id)}`;
    return NextResponse.json(await a2e(path));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to check the task." }, { status: 503 });
  }
}
