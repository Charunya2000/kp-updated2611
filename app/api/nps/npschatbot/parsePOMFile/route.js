import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";

/**
 * Read Java source file as raw text
 */
function readSource(code) {
 
  //console.log(code)
  let code1 = code.replace(/\r\n/g, "\n"); // normalize line endings
  console.log(code1)
  return code1;

}

/**
 * Remove Java comments
 */
function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
    .replace(/\/\/.*$/gm, "");       // line comments
}

/**
 * Extract class name
 */
function extractClassName(code) {
  const match = code.match(/class\s+(\w+)/);
  return match ? match[1] : null;
}

/**
 * Extract fields (selectors / variables)
 */function removeMethodsAndConstructors(code) {
  let result = "";
  let braceCount = 0;
  let insideMethod = false;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];

    // Detect method/constructor start
    if (
      !insideMethod &&
      code.slice(i).match(
        /^(public|protected|private)\s+[\w<>[\]]*\s*\w+\s*\([^)]*\)\s*\{/
      )
    ) {
      insideMethod = true;
    }

    if (insideMethod) {
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;

      if (braceCount === 0) {
        insideMethod = false;
      }
      continue;
    }

    result += char;
  }

  return result;
}

function extractStringFields(javaCode) {
  javaCode = javaCode.replace(/\r/g, "").replace(/^\uFEFF/, "");

  const idx = javaCode.indexOf("throws InterruptedException");
  const fieldSection = idx !== -1 ? javaCode.substring(0, idx) : javaCode;

  const fieldRegex =
    /\b(?:public|private|protected)?\s*(?:static\s+)?String\s+(\w+)\s*=\s*([\s\S]*?);/g;

  const fields = [];
  let match;

  while ((match = fieldRegex.exec(fieldSection)) !== null) {
    fields.push({
      name: match[1],
      value: match[2].trim(),
      raw: match[0].trim()
    });
  }

  return fields;
}


/** * Extract methods using brace counting */
function extractMethods(code) {
  const methods = [];
  const methodHeaderRegex = /(public|protected|private|static|\s)*\s*[\w<>[\]]+\s+(\w+)\s*\([^)]*\)\s*(throws\s+[\w,\s]+)?\s*\{/g;
  let match;

  while ((match = methodHeaderRegex.exec(code))) {
    const methodName = match[2];
    let index = match.index + match[0].length;
    let braceCount = 1;

    // Traverse through the code to capture the entire method body
    while (index < code.length && braceCount > 0) {
      if (code[index] === "{") {
        braceCount++;
      } else if (code[index] === "}") {
        braceCount--;
      }
      index++;
    }

    const methodBody = code.slice(match.index, index);
    methods.push({ methodName, methodContent: methodBody.trim() });
  }

  return methods;
}

/**
 * Parse POM Java file
 */
function parsePomFile(javaContent) {
  const cleanCode = readSource(javaContent);
 // const cleanCode = stripComments(rawCode);

  return {
    className: extractClassName(cleanCode),
    fields: extractStringFields(cleanCode),
    methods: extractMethods(cleanCode)
  };
}

/**
 * POST API
 * body: { filePath: "src/main/java/pages/LoginPage.java" }
 */
export async function POST(req) {
  try {
    const {javaContent} = await req.json();
    
    const result = parsePomFile(javaContent);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Parsing failed" },
      { status: 500 }
    );
  }
}
