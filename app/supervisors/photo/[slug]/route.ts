import { supervisorPhoto } from "@/lib/public-supervisors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const photo = await supervisorPhoto(slug);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
