export function normalizeRcnoaAddress(fields) {
  const addressFields = fields.length >= 20
    ? [fields[0], fields[3], fields[6], fields[9], fields[12], fields[15]]
    : fields.slice(0, 6);
  return addressFields.map((value) => String(value || '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\bSTREET\b/g, 'ST')
    .replace(/\bAVENUE\b/g, 'AVE')
    .replace(/\bROAD\b/g, 'RD')
    .replace(/\bDRIVE\b/g, 'DR')
    .replace(/\s+/g, ' ')
    .trim()).join('|');
}