
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export const formatNumber = (value: number, decimals: number = 2) => {
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
    // Handle MMM-YYYY format (e.g., "May-2025")
    const monthYearMatch = dateStr.trim().match(/^(\w{3,})-(\d{4})$/i);
    
    if (monthYearMatch) {
      const [_, monthPart, yearPart] = monthYearMatch;
      const year = parseInt(yearPart);
      
      // Define month names and their variations
      const monthMap: {[key: string]: number} = {
        'jan': 0, 'january': 0,
        'feb': 1, 'february': 1,
        'mar': 2, 'march': 2,
        'apr': 3, 'april': 3,
        'may': 4,
        'jun': 5, 'june': 5,
        'jul': 6, 'july': 6,
        'aug': 7, 'august': 7,
        'sep': 8, 'september': 8,
        'oct': 9, 'october': 9,
        'nov': 10, 'november': 10,
        'dec': 11, 'december': 11
      };
      
      const monthIndex = monthMap[monthPart.toLowerCase()];
      
      if (monthIndex !== undefined && !isNaN(year)) {
        // Create a date object for the first day of the month
        const date = new Date(year, monthIndex, 1);
        // Convert to the internal month format (months since Jan 2024)
        const monthsSinceJan2024 = ((year - 2024) * 12) + monthIndex;
        console.log(`Parsed date (MMM-YYYY): ${dateStr} -> ${monthIndex + 1}/${year} (${monthsSinceJan2024})`);
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

export const monthToDate = (monthNumber: number): Date => {
  // Handle invalid month values
  if (typeof monthNumber !== 'number' || isNaN(monthNumber)) {
    console.error('Invalid month number passed to monthToDate:', monthNumber);
    return new Date(); // Return current date as fallback
  }
  
  // For negative months, clamp to 0 (Jan 2024)
  if (monthNumber < 0) {
    console.warn('Negative month number in monthToDate:', monthNumber, 'using 0 instead (Jan 2024)');
    monthNumber = 0;
  }
  
  const baseYear = 2024;
  const baseMonth = 0; // January (0-based)
  
  // Calculate the actual year and month
  const totalMonths = monthNumber + baseMonth;
  const year = baseYear + Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  
  const result = new Date(year, monthIndex, 1);
  console.log(`monthToDate: ${monthNumber} -> ${year}-${monthIndex + 1} (${result.toISOString()})`);
  return result;
};

export const dateToMonth = (date: Date): number => {
  // Make sure we have a valid Date object
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    console.error('Invalid date passed to dateToMonth:', date);
    return 0; // Return a safe default
  }
  
  const baseYear = 2024;
  const baseMonth = 0; // January (0-based)
  
  const currentYear = date.getFullYear();
  const currentMonth = date.getMonth(); // 0-based month index
  
  // Calculate the difference in years and add the month difference
  const yearDiff = currentYear - baseYear;
  const monthDiff = (yearDiff * 12) + (currentMonth - baseMonth);
  
  console.log(`dateToMonth: ${date.toISOString()} -> (${currentYear}-${currentMonth + 1}) = ${monthDiff} months since ${baseYear}-${baseMonth + 1}`);
  
  return monthDiff;
};
