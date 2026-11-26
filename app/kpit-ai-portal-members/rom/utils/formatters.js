// Utility functions for formatting ROM data

export const formatCurrency = (value) => {
  if (!value) return 'Not calculated';
  
  // Return raw number without any formatting
  return value.toString();
};

export const formatROMValue = (romValue) => {
  if (!romValue) return 'Not calculated';
  
  // Return raw value without any formatting
  return romValue.toString();
};

// Parse K value from string (e.g., "$300" or "300" → 300)
export const parseK = (input) => {
  if (!input) return 0;
  
  // Remove $, commas, and any whitespace, then parse as number
  const cleaned = String(input).replace(/[$,\s]/g, '');
  const parsed = parseFloat(cleaned);
  
  return isNaN(parsed) ? 0 : parsed;
};

// Format K value to full USD (e.g., 300 → "$300,000")
export const formatUSDFromK = (k) => {
  if (k === null || k === undefined || isNaN(k)) return 'Not calculated';
  
  const fullValue = k * 1000;
  return `$${fullValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

// Format full USD amount directly (e.g., 300000 → "$300,000")
export const formatUSD = (amount) => {
  if (amount === null || amount === undefined) return 'Not calculated';
  
  // If string, remove $, commas, and whitespace before parsing
  const cleaned = typeof amount === 'string' ? amount.replace(/[$,\s]/g, '') : amount;
  const numAmount = parseFloat(cleaned);
  
  if (isNaN(numAmount)) return 'Not calculated';
  
  return `$${numAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

export const getProgressStep = (status) => {
  const steps = {
    'input_processed': 1,
    'similar_rom_found': 2,
    'extracting_details_waiting': 3,
    'details_extracted': 4,
    'details_reviewed': 5,
    'detailed_rom_generated': 6,
    'rom_reviewed': 7,
    'final_summary_generated': 8,
    'completed': 9
  };
  
  return steps[status] || 0;
};

export const getProgressLabel = (status) => {
  const labels = {
    'input_processed': 'Input Processed',
    'similar_rom_found': 'Similar ROMs Found',
    'extracting_details_waiting': 'Extracting Details',
    'details_extracted': 'Details Ready',
    'details_reviewed': 'Details Reviewed',
    'detailed_rom_generated': 'ROM Generated',
    'rom_reviewed': 'ROM Reviewed',
    'final_summary_generated': 'Summary Generated',
    'completed': 'Completed'
  };
  
  return labels[status] || 'Processing';
};