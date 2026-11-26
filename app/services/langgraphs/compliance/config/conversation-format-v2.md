# Conversation Format V2

Primary response template (aligned to legacy behavior):

```md
## Document Overview

**Document:** ${documentDisplay}

---

**Your Question:**
_${userPrompt}_

---

**What I found:**

${conversationResponse}
```

Notes:
- For selected-document mode, `documentDisplay` should be `[${fileAName}](${url})`.
- For all-docs-in-LOB mode, append `### Documents Used` after the template.
- For all-docs-in-LOB mode, `documentDisplay` should be plain text (no hyperlink).
- `url` should include `?target=_blank` and append `#page=<top evidence page>` when available.
- Inline citations like `[file:page]` should be linkified to the corresponding `url#page=<page>` when a document URL is available.
- Evidence snippets are not shown by default in final markdown.
