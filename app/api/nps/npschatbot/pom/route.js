export const runtime = "nodejs";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";
import * as fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const { nuid, useCase, content, className, topK = 3 } = await req.json();

    if (!nuid) {
      return Response.json({ error: "nuid required" }, { status: 400 });
    }

    if (!useCase || !content)
      return Response.json({ error: "useCase & text required" }, { status: 400 });

    const embedding = await vectorizePromptNode(content, nuid);
    //const embedding=content
    const dim = embedding.length;
    const body = {
      "usecase": useCase,
      "embeddings": embedding,
      "dimension": dim,
      "className": className

    }

    const res = await fetch("http://10.15.37.135:5005/searchPOM", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await res.json();
    return Response.json(result);
  }

  catch (err) {
    console.error("Search Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
