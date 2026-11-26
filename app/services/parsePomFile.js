import { chatCompletion } from "@/app/services/chatCompletionService2.js";

export function countTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}



export function chunkLargeMethodByLines(methodContent, maxTokens) {
  const lines = methodContent.split("\n");
  const chunks = [];
  let current = [];
  let currentTokens = 0;

  for (const line of lines) {
    const lineWithNewline = line + "\n";
    const t = countTokens(lineWithNewline);

    // If a single line itself larger than maxTokens, emit it as its own chunk (best effort)
    if (t > maxTokens) {
      if (current.length) {
        chunks.push(current.join("\n"));
        current = [];
        currentTokens = 0;
      }
      chunks.push(lineWithNewline);
      continue;
    }

    if (currentTokens + t > maxTokens) {
      // flush current
      chunks.push(current.join("\n"));
      current = [lineWithNewline];
      currentTokens = t;
    } else {
      current.push(lineWithNewline);
      currentTokens += t;
    }
  }

  if (current.length) chunks.push(current.join("\n"));
  return chunks;
}

/**
 * Group methods into chunks where each chunk contains one or more methods and
 * the total token count is <= maxTokens (approx). If a method alone exceeds maxTokens,
 * it will be split using chunkLargeMethodByLines.
 *
 * methods: [{ methodName, methodContent }]
 *
 * Returns:
 * [
 *   { chunkMethods: [{ methodName, content }], tokenCount: N },
 *   ...
 * ]
 */
function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/\n+/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\\/g, '')
    .trim();
}
export function chunkMethods(methods, maxTokens = 2000) {
  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;

  for (const m of methods) {
    const header = `// method: ${m.methodName}\n`;
    const methodText = header + (m.methodContent || "");
    const methodTokens = countTokens(methodText);

    if (methodTokens > maxTokens) {
      // flush existing chunk if any
      if (currentChunk.length) {
        chunks.push({ chunkMethods: currentChunk, tokenCount: currentTokens });
        currentChunk = [];
        currentTokens = 0;
      }

      // split this large method into smaller pieces
      const subChunks = chunkLargeMethodByLines(methodText, maxTokens);
      for (const sc of subChunks) {
        chunks.push({
          chunkMethods: [{ methodName: m.methodName, content: sc }],
          tokenCount: countTokens(sc),
        });
      }
      continue;
    }

    if (currentTokens + methodTokens > maxTokens) {
      // flush chunk
      if (currentChunk.length) {
        chunks.push({ chunkMethods: currentChunk, tokenCount: currentTokens });
      }
      // start new chunk
      currentChunk = [{ methodName: m.methodName, content: methodText }];
      currentTokens = methodTokens;
    } else {
      // append to current chunk
      currentChunk.push({ methodName: m.methodName, content: methodText });
      currentTokens += methodTokens;
    }
  }

  if (currentChunk.length) {
    chunks.push({ chunkMethods: currentChunk, tokenCount: currentTokens });
  }

  return chunks;
}

// ---------- PLACEHOLDERS (YOU ALREADY HAVE THESE) ----------

// 1️⃣ Fetch Java file from GitHub
async function fetchJavaFileFromGithub(filePath) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const githubResponse = await fetch(`${baseUrl}/api/nps/npschatbot/github`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetFile: filePath })
  });

  if (githubResponse.ok) {
    const gitHubData = await githubResponse.json();

    const cleanedScript = gitHubData.results

      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '    ')
      .replace(/\n[ ]{8,}/g, '\n    ');


    return cleanedScript
  }
}

// 2️⃣ Extract fields + methods from Java file
async function extractPomMetadata(javaFileContent) {
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const pomFileData = await fetch(`${baseUrl}/api/parsePOMFile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ javaContent: javaFileContent })
  });
  const pomResults = await pomFileData.json();
  console.log(pomResults)
  // 🔁 YOU ALREADY HAVE THIS
  // return JSON like:
  // {
  //   className: "",
  //   fields: [...],
  //   methods: [{ name, content }]
  // }
  return pomResults
}

// 3️⃣ Call LLM for summary
async function callLLM(systemMessage) {
  const messages = [

    {
      role: "system",
      content: systemMessage
    }
  ];

  // Make the main chat completion request
  const completionConfig = {
    temperature: 0.7,
    max_tokens: 1000,
    model: "gpt-4o",
    messages: messages,
    teamName: 'nps',
    assistantName: 'npschatbot'
  };

  // Extract the main response
  const response = await chatCompletion(completionConfig);
  return response;

}

function buildChunkVectorPayload(chunkMethods, chunkIndex) {
  // 1️⃣ Build embedding text from summaries only
  const embeddingText = chunkMethods
    .map(m => `${m.methodName} method: ${m.summary}`)
    .filter(Boolean)
    .join(". ");

  // 2️⃣ Return vector-ready object
  return {
    usecase: "POMMapping",
    id: `chunk-${chunkIndex}`,
    content: embeddingText,
    metadata: {
      methods: chunkMethods.map(m => ({
        methodName: m.methodName,
        summary: m.summary,
        content: m.content
      }))
    }
  };
}

function mergeSummaries(chunk, llmResponseText) {
  const clean = llmResponseText
    .replace(/```json|```/g, "")
    .trim();

  const parsed = JSON.parse(clean);

  const summaryMap = new Map(
    parsed.methods.map(m => [m.methodName, m.summary])
  );

  return {
    ...chunk,
    methods: chunk.chunkMethods.map(m => ({
      ...m,
      summary: summaryMap.get(m.methodName) || ""
    }))
  };
}

//     const body={
//         "usecase":useCase,
//         "embeddings":embedding,
//         "dimension":dim,
//         "metadata":metadata

//     }
// }


// ---------- MAIN PIPELINE ----------
export async function summarizePOM() {

  const javaFiles = ["nSQ.java"
  ]

  const resultss = [];
  const results = [];

  for (const filePath of javaFiles) {
    // 🔹 Step 1: fetch Java content
    const javaContent = await fetchJavaFileFromGithub(filePath);

    // 🔹 Step 2: extract fields + methods

    const pomJson = await extractPomMetadata(javaContent);

    // 🔹 Step 3: stringify for token counting
    const pomText = JSON.stringify(pomJson);

    //const tokenCount = countTokens(pomText);
    const chunks = await chunkMethods(pomJson.methods)


    const summaries = [];
    const summarizedChunks = [];


    // 🔹 Step 5: summarize each chunk
    for (const chunk of chunks) {
      const llmInput = JSON.stringify({

        chunkMethods: chunk.chunkMethods.map(m => ({
          methodName: m.methodName,
          content: normalizeText(m.content)
        }))
      });


      console.log(llmInput)

      const prompt = `
You are a Senior Automation Engineer.

Your task is to analyze Selenium Page Object Model (POM) methods written in Java
and produce concise, precise summaries that explain:

- What UI action or validation the method performs
- Which page elements it interacts with
- Any navigation, waits, or conditions involved


Rules:
- Do NOT restate code
- Do NOT mention implementation details unless essential
- Keep summaries under 2 sentences
- Use clear, test-automation-friendly language
- Output must be valid JSON only
Return JSON in the following format:
{
  "className": "<ClassName>",
  "methods": [
    {
      "methodName": "..",
      "summary": "..."
    },
    {
      "methodName": "..",
      "summary": "..."
    }
  ]
}

CONTENT:
${llmInput}
`;

      const summary = await callLLM(prompt);
      summaries.push(summary);
      const updatedChunk = mergeSummaries(chunk, summary);

      const test = buildChunkVectorPayload(updatedChunk.methods, 0)
      const jsonOutput = JSON.stringify(test, null, 2);
      const cleanjson = jsonOutput
        .replace(/```json|```/g, "")
        .trim();

      const parsedjosn = JSON.parse(cleanjson);

      summarizedChunks.push(updatedChunk);


    }

    let chunkindex = 0
    for (const summary of summarizedChunks) {
      const chunkvector = buildChunkVectorPayload(summarizedChunks.methods, chunkindex)
      chunkindex++
      // for (const item of summary.methods) {
      resultss.push(chunkvector
        // useCase: "POMMapping",
        // content:item.summary,
        // metadata:{
        //   methodName: item.methodName,
        //   methodContent: item.content,
        //   summary: item.summary}
      );
      // }
    }

    const jsonOutput1 = JSON.stringify(resultss, null, 2);
    const cleanjson1 = jsonOutput1
      .replace(/```json|```/g, "")
      .trim();

    const parsedjosn1 = JSON.parse(cleanjson1);
    console.log(cleanjson1)
    results.push({
      filePath,
      className: pomJson.className,
      summarizedChunks
    });
  }

  return Response.json({
    success: true,
    results
  });
}
