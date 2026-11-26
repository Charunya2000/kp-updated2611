export const runtime = "nodejs";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";

export async function GET(req) {
  return Response.json({ "MEssage": "Works" })
}

export async function POST(req) {

  const { nuid, useCase, content, metadata } = await req.json();

  if (!nuid) {
    return Response.json({ error: "nuid required" }, { status: 400 });
  }

  if (!useCase || !content)
    return Response.json({ error: "useCase & text required" }, { status: 400 });

  const embedding = await vectorizePromptNode(content, nuid);
  const dim = embedding.length;
  const body = {
    "usecase": useCase,
    "embeddings": embedding,
    "dimension": dim,
    "metadata": metadata

  }


  const res = await fetch("http://10.15.37.135:5005/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const result = await res.json();
  return Response.json(result);
}