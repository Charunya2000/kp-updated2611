'use server';

async function filterPii(text) {
  // Regular expressions for different types of PII
  // const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const phoneRegex = /\b\d{3}[-.\s]??\d{3}[-.\s]??\d{4}\b/g;
  const ssnRegex = /\b\d{3}[-.\s]??\d{2}[-.\s]??\d{4}\b/g;
  const creditCardRegex = /\b(?:\d[ -]*?){13,16}\b/g;
  // const nameRegex = /\b([A-Z][a-z]*\s[A-Z][a-z]*)\b/g; // Simplistic name regex

  // Replace PII with '[REDACTED]'
  let filteredText = text
    // .replace(emailRegex, '[REDACTED]')
    .replace(phoneRegex, '[REDACTED]')
    .replace(ssnRegex, '[REDACTED]')
    .replace(creditCardRegex, '[REDACTED]')
    // .replace(nameRegex, '[REDACTED]')
    ;

  return filteredText;
}

export { filterPii };