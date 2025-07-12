import { Payment } from '@/types/project';

export interface CalculatedInterestResult {
  newInterestPayments: Payment[];
  allPaymentsWithInterest: Payment[];
  totalInterest: number;
}

interface CalculateInterestParams {
  payments: Payment[];
  interestRate: number;
  projectEndDate?: Date;
}

export const calculateMonthlyInterestLogic = ({
  payments,
  interestRate,
  projectEndDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
}: CalculateInterestParams): CalculatedInterestResult => {
  if (!payments.length) {
    return {
      newInterestPayments: [],
      allPaymentsWithInterest: [],
      totalInterest: 0
    };
  }

  // Sort payments by date
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : monthToDate(a.month);
    const dateB = b.date ? new Date(b.date) : monthToDate(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  // Find the earliest payment date to start calculation
  const firstPayment = sortedPayments[0];
  const startDate = firstPayment.date ? new Date(firstPayment.date) : monthToDate(firstPayment.month);
  
  // Find the latest payment date
  const lastPayment = sortedPayments[sortedPayments.length - 1];
  const lastPaymentDate = lastPayment.date ? new Date(lastPayment.date) : monthToDate(lastPayment.month);

  // Use the later of projectEndDate or lastPaymentDate
  const calcEndDate = (projectEndDate && projectEndDate > lastPaymentDate) ? projectEndDate : lastPaymentDate;

  // Calculate interest month by month until calcEndDate
  const newInterestPayments: Payment[] = [];
  const monthlyRate = interestRate / 100 / 12; // Convert annual percentage to monthly decimal

  // Group payments by month for easier processing
  const paymentsByMonth = new Map<string, Payment[]>();
  
  sortedPayments.forEach(payment => {
    const paymentDate = payment.date ? new Date(payment.date) : monthToDate(payment.month);
    const monthKey = `${paymentDate.getFullYear()}-${paymentDate.getMonth()}`;
    
    if (!paymentsByMonth.has(monthKey)) {
      paymentsByMonth.set(monthKey, []);
    }
    paymentsByMonth.get(monthKey)!.push(payment);
  });

  // Process each month from start date to calcEndDate
  let currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  let currentPrincipal = 0;
  
  while (currentDate <= calcEndDate) {
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
    const monthPayments = paymentsByMonth.get(monthKey) || [];
    
    // Get principal at start of this month
    let monthStartPrincipal = currentPrincipal;
    
    // Calculate daily interest for this month
    const monthInterest = calculateProRatedMonthlyInterest(
      currentDate,
      monthStartPrincipal,
      monthPayments,
      monthlyRate
    );
    
    // Update principal for next month by processing all payments in this month
    for (const payment of monthPayments) {
      if (payment.type === 'drawdown') {
        // Drawdown increases principal
        currentPrincipal += Math.abs(payment.amount);
      } else if (payment.type === 'repayment') {
        // Repayment reduces principal
        currentPrincipal -= Math.abs(payment.amount);
        // Ensure principal doesn't go negative (surplus/overpayment)
        currentPrincipal = Math.max(0, currentPrincipal);
      }
      // Note: 'payment', 'return', and 'interest' types don't affect principal
    }
    
    // Create interest payment if there's interest to charge
    if (monthInterest.totalInterest > 0) {
      const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const interestPayment: Payment = {
        id: `interest-${currentDate.getFullYear()}-${currentDate.getMonth() + 1}`,
        amount: monthInterest.totalInterest,
        type: 'interest',
        date: lastDayOfMonth,
        month: currentDate.getFullYear() * 12 + currentDate.getMonth(),
        description: monthInterest.description
      };
      
      newInterestPayments.push(interestPayment);
      
      // DO NOT add interest to principal - treat interest as an expense/outflow
      // Interest should not capitalize into the debt principal
    }
    
    // Move to next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    currentDate.setDate(1);
  }

  // Combine original payments with new interest payments
  const allPaymentsWithInterest = [...sortedPayments, ...newInterestPayments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : monthToDate(a.month);
    const dateB = b.date ? new Date(b.date) : monthToDate(b.month);
    return dateA.getTime() - dateB.getTime();
  });

  const totalInterest = newInterestPayments.reduce((sum, payment) => sum + payment.amount, 0);

  return {
    newInterestPayments,
    allPaymentsWithInterest,
    totalInterest
  };
};

// Helper function to convert month number to date
const monthToDate = (month: number): Date => {
  const year = Math.floor(month / 12);
  const monthIndex = month % 12;
  return new Date(year, monthIndex, 1);
};

// Helper function to create detailed interest description
const createInterestDescription = (startPrincipal: number, payments: Payment[], daysInMonth: number): string => {
  if (payments.length === 0) {
    return `Monthly Interest @ 12% on principal of ₹${formatIndianCurrency(startPrincipal)}`;
  }
  
  // For simplicity, show the main principal amount
  const mainPrincipal = Math.max(startPrincipal, ...payments.map(p => 
    p.type === 'payment' ? Math.abs(p.amount) : 0
  ));
  
  return `Monthly Interest @ 12% on principal of ₹${formatIndianCurrency(mainPrincipal)}`;
};

/**
 * Calculate prorated interest for a month based on actual days outstanding
 * @param monthStartDate First day of the month
 * @param startingPrincipal Principal at the start of the month
 * @param monthPayments Payments occurring in this month
 * @param monthlyRate Monthly interest rate (decimal)
 * @returns Object with total interest and description
 */
function calculateProRatedMonthlyInterest(
  monthStartDate: Date,
  startingPrincipal: number,
  monthPayments: Payment[],
  monthlyRate: number
): { totalInterest: number; description: string } {
  // Filter payments that affect principal
  const principalAffectingPayments = monthPayments.filter(p => 
    p.type === 'drawdown' || p.type === 'repayment'
  );
  
  // If no payments affect principal, use simple monthly calculation
  if (principalAffectingPayments.length === 0) {
    const totalInterest = startingPrincipal * monthlyRate;
    const description = `Monthly Interest @ ${(monthlyRate * 12 * 100).toFixed(1)}% on principal of ₹${formatIndianCurrency(startingPrincipal)}`;
    return { totalInterest, description };
  }
  
  // Get the last day of the month
  const monthEndDate = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth() + 1, 0);
  const daysInMonth = monthEndDate.getDate();
  
  // Daily interest rate (monthly rate divided by actual days in month)
  const dailyRate = monthlyRate / daysInMonth;
  
  // Sort payments by date within the month
  const sortedMonthPayments = [...principalAffectingPayments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date) : new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), 15);
    const dateB = b.date ? new Date(b.date) : new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), 15);
    return dateA.getTime() - dateB.getTime();
  });
  
  let currentPrincipal = startingPrincipal;
  let totalInterest = 0;
  let lastCalculatedDate = new Date(monthStartDate);
  
  // Process each payment in the month
  for (const payment of sortedMonthPayments) {
    const paymentDate = payment.date ? new Date(payment.date) : new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), 15);
    
    // Calculate interest from last calculated date to payment date
    const daysElapsed = Math.max(0, Math.ceil((paymentDate.getTime() - lastCalculatedDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    if (daysElapsed > 0 && currentPrincipal > 0) {
      const periodInterest = currentPrincipal * dailyRate * daysElapsed;
      totalInterest += periodInterest;
    }
    
    // Update principal based on payment type
    if (payment.type === 'drawdown') {
      currentPrincipal += Math.abs(payment.amount);
    } else if (payment.type === 'repayment') {
      currentPrincipal -= Math.abs(payment.amount);
      currentPrincipal = Math.max(0, currentPrincipal);
    }
    
    lastCalculatedDate = new Date(paymentDate);
  }
  
  // Calculate interest for remaining days in the month
  const remainingDays = Math.max(0, Math.ceil((monthEndDate.getTime() - lastCalculatedDate.getTime()) / (1000 * 60 * 60 * 24)));
  if (remainingDays > 0 && currentPrincipal > 0) {
    const periodInterest = currentPrincipal * dailyRate * remainingDays;
    totalInterest += periodInterest;
  }
  
  // Create description based on the calculation
  let description = '';
  const monthName = monthStartDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  // Find the payment that paid off the loan (if any)
  const payoffPayment = sortedMonthPayments.find(p => 
    p.type === 'repayment' && Math.abs(p.amount) >= startingPrincipal
  );
  
  if (payoffPayment && startingPrincipal > 0) {
    const payoffDate = payoffPayment.date ? new Date(payoffPayment.date) : new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), 15);
    const daysOutstanding = Math.ceil((payoffDate.getTime() - monthStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1; // Include the payoff day
    description = `Prorated Interest @ ${(monthlyRate * 12 * 100).toFixed(1)}% on ₹${formatIndianCurrency(startingPrincipal)} for ${daysOutstanding} days in ${monthName}`;
  } else {
    description = `Prorated Interest @ ${(monthlyRate * 12 * 100).toFixed(1)}% for ${monthName} (calculated daily)`;
  }
  
  return { totalInterest, description };
}

// Helper function to format currency in Indian format
const formatIndianCurrency = (amount: number): string => {
  return Math.abs(amount).toLocaleString('en-IN', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}; 