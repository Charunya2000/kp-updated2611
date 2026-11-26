# InfoSource AI Search & Agent Skills Execution Graph

```mermaid
graph TD
    A[User Prompt]
    B[Retrieve Relevant Docs (AI Search)]
    C[Chunk & Vectorize]
    D[Apply Approach Skill]\n(Advise, Key Points)
    E[Apply Impress Skill]\n(Differentiators, Engage)
    F[Apply Follow-up Skill]\n(Next Steps, Summary)
    G[Apply Finetune Skill]\n(Q&A Prep, Avoid)
    H[Compose Structured Response]
    I[Render in UI with Citations]

    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
```

---

**Legend:**
- **Blue nodes** (D-G): Each skill is a distinct processing step, transforming or annotating the response.
- **H**: Combines all skill outputs into a structured markdown response (sections or tags).
- **I**: UI renders the response, optionally showing skill sections or tags.

**Notes:**
- Each skill node can be implemented as a function, plugin, or LLM prompt section.
- The graph can be extended to branch or loop through only relevant skills based on user intent.
- Skill outputs can be annotated in the response for traceability and UI display.
