export function GET() {
  return Response.json({ message: "route works" });
}
export async function POST(req) {
  return Response.json({ route: "POST works" });
}