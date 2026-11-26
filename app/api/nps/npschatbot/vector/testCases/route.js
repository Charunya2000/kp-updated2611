export const runtime = "nodejs";
import { vectorizePromptNode } from "@/app/services/langgraphs/bcsChatBot/nodes/vectorizePrompt";
import * as fs from "fs";
import path from "path";

export async function POST(req) {
  try {
    const { useCase, metaData } = await req.json();

    if (!useCase || !metaData)
      return Response.json({ error: "useCase & metaData required" }, { status: 400 });

    const body={
        "usecase":useCase,
       "metadata":metaData

    }

    const res = await fetch("http://10.15.37.135:5005/searchTestCases", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const result = await res.json();
  return Response.json(result);}
  
  catch (err) {
    console.error("Search Error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
