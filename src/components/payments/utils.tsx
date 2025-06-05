
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export const formatNumber = (value: number, decimals: number = 0) => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(Math.abs(value));
};

export const parseCurrencyAmount = (amountStr: string): number => {
  const cleanAmount = amountStr.replace(/[₹,\s]/g, '').replace(/[^\d.-]/g, '');
  return parseFloat(cleanAmount) || 0;
};

export const parseDate = (dateStr: string): number => {
  // Skip header row value 'date'
  if (dateStr.toLowerCase() === 'date') {
    return -1; // Return invalid month number
  }
  
  // If it's already a number, return it
  if (!isNaN(Number(dateStr))) {
    return Number(dateStr);
  }
  
  try {
    // Handle MMM-YYYY or Month-YYYY format (e.g., "May-2025" or "May-2025")
    if (dateStr.includes('-')) {
      const [monthPart, yearPart] = dateStr.split('-');
      let month: number = 0;
      const year = parseInt(yearPart.trim());
      
      // Define month names and their variations
      const monthVariations = [
        ['january', 'jan'],
        ['february', 'feb'],
        ['march', 'mar'],
        ['april', 'apr'],
        ['may'],
        ['june', 'jun'],
        ['july', 'jul'],
        ['august', 'aug'],
        ['september', 'sep'],
        ['october', 'oct'],
        ['november', 'nov'],
        ['december', 'dec']
      ];
      
      // Try to match the month part with known variations
      const monthLower = monthPart.trim().toLowerCase();
      const monthIndex = monthVariations.findIndex(variations => 
        variations.some(v => monthLower.startsWith(v))
      );
      
      if (monthIndex >= 0) {
        month = monthIndex + 1;
      } else {
        // Try to parse as month number if text parsing fails
        const monthNum = parseInt(monthPart.trim());
        if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
          month = monthNum;
        }
      }
      
      if (month >= 1 && month <= 12 && !isNaN(year)) {
        // Calculate months since Jan 2024 (our reference point)
        const monthsSinceJan2024 = ((year - 2024) * 12) + (month - 1);
        return monthsSinceJan2024;
      }
    }
    
    // Fallback to Date parsing for other formats
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const baselineYear = 2024;
      const baselineMonth = 1;
      const monthNumber = (year - baselineYear) * 12 + (month - baselineMonth) + 1;
      console.log(`Parsed date (fallback): ${dateStr} -> ${month}/${year} (${monthNumber})`);
      return monthNumber;
    }
    
    // If we get here, we couldn't parse the date
    console.warn(`Could not parse date: ${dateStr}`);
    return 1;
  } catch (error) {
    console.error('Date parsing error:', error, 'for date:', dateStr);
    return 1;
  }
};

export const monthToDate = (month: number): Date => {
  // Input validation
  if (typeof month !== 'number' || isNaN(month)) {
    console.error('Invalid month number passed to monthToDate:', month);
    return new Date(); // Return current date as fallback
  }
  
  // For negative months or months < 0, we need special handling
  if (month < 0) {
    console.warn('Negative month number in monthToDate:', month, 'using 0 instead');
    month = 0;
  }
  
  // Debug
  console.log(`monthToDate converting month ${month} to date`);
  
  // Simple direct calculation: month 0 = Jan 2024
  const year = 2024 + Math.floor(month / 12);
  const monthIndex = month % 12;
  
  const result = new Date(year, monthIndex, 1);
  console.log(`monthToDate result: ${result.toISOString()} (year: ${year}, month: ${monthIndex})`);
  return result;
};

export const dateToMonth = (date: Date): number => {
  // Make sure we have a valid Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date passed to dateToMonth:', date);
    return 0; // Return a safe default
  }
  
  // Simple direct conversion: Jan 2024 = month 0
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based month index
  
  // Calculate relative to 2024 base year
  return (year - 2024) * 12 + month;
};
