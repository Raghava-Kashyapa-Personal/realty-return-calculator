import { Payment } from '@/types/project';

export interface LoanBalance {
  outstanding: number;
  totalDrawn: number;
  totalRepaid: number;
}

export interface ProcessedPayment extends Payment {
  calculatedLoanAdjustment: number;
  calculatedNetReturn: number;
  runningLoanBalance: number;
}

/**
 * Calculates the outstanding loan balance at any point in time
 * @param payments Array of payments sorted by date
 * @param upToIndex Calculate balance up to this payment index (exclusive)
 * @returns LoanBalance object with outstanding, totalDrawn, and totalRepaid
 */
export function calculateLoanBalance(payments: Payment[], upToIndex?: number): LoanBalance {
  const endIndex = upToIndex ?? payments.length;
  let totalDrawn = 0;
  let totalRepaid = 0;

  for (let i = 0; i < endIndex; i++) {
    const payment = payments[i];
    
    switch (payment.type) {
      case 'drawdown':
        totalDrawn += Math.abs(payment.amount);
        break;
      case 'repayment':
        totalRepaid += Math.abs(payment.amount);
        break;
      case 'payment':
        // Regular payments are expenses and don't affect loan balance
        // Only explicit loan adjustments affect the balance
        if (payment.loanAdjustment) {
          totalRepaid += Math.abs(payment.loanAdjustment);
        }
        // Note: Regular payments without loanAdjustment don't affect loan balance
        break;
      case 'return':
        // Returns can partially pay down the loan
        if (payment.loanAdjustment) {
          totalRepaid += Math.abs(payment.loanAdjustment);
        }
        break;
      // Interest doesn't affect principal balance
    }
  }

  const outstanding = Math.max(0, totalDrawn - totalRepaid);
  
  return {
    outstanding,
    totalDrawn,
    totalRepaid
  };
}

/**
 * Processes payments to calculate loan adjustments and net returns
 * @param payments Array of payments
 * @param autoApplyReturnsToLoan Whether to automatically apply returns to outstanding loan
 * @returns Array of processed payments with calculated loan adjustments
 */
export function processPaymentsWithLoanTracking(
  payments: Payment[], 
  autoApplyReturnsToLoan: boolean = true
): ProcessedPayment[] {
  // Sort payments by date
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : new Date(2024, 0, 1).getTime() + (a.month * 30 * 24 * 60 * 60 * 1000);
    const dateB = b.date ? new Date(b.date).getTime() : new Date(2024, 0, 1).getTime() + (b.month * 30 * 24 * 60 * 60 * 1000);
    return dateA - dateB;
  });

  const processedPayments: ProcessedPayment[] = [];
  let runningBalance = 0;
  
  sortedPayments.forEach((payment, index) => {
    let calculatedLoanAdjustment = 0;
    let calculatedNetReturn = 0;
    
    switch (payment.type) {
      case 'drawdown':
        // Drawdowns increase the balance
        runningBalance += Math.abs(payment.amount);
        break;
        
      case 'repayment':
        // Full repayment amount goes to loan first
        calculatedLoanAdjustment = Math.min(Math.abs(payment.amount), runningBalance);
        calculatedNetReturn = Math.max(0, Math.abs(payment.amount) - runningBalance);
        runningBalance = Math.max(0, runningBalance - Math.abs(payment.amount));
        break;
        
      case 'return':
        if (autoApplyReturnsToLoan && runningBalance > 0) {
          // Use explicit loanAdjustment if provided, otherwise auto-calculate
          if (payment.loanAdjustment !== undefined) {
            calculatedLoanAdjustment = Math.min(payment.loanAdjustment, runningBalance);
          } else {
            calculatedLoanAdjustment = Math.min(Math.abs(payment.amount), runningBalance);
          }
          calculatedNetReturn = Math.abs(payment.amount) - calculatedLoanAdjustment;
          runningBalance = Math.max(0, runningBalance - calculatedLoanAdjustment);
        } else {
          // If no auto-apply or no outstanding loan, use explicit values or treat as full return
          calculatedLoanAdjustment = payment.loanAdjustment || 0;
          calculatedNetReturn = payment.netReturn ?? (Math.abs(payment.amount) - calculatedLoanAdjustment);
          runningBalance = Math.max(0, runningBalance - calculatedLoanAdjustment);
        }
        break;
        
      case 'payment':
        // Regular payments can have explicit loan adjustments
        calculatedLoanAdjustment = payment.loanAdjustment || 0;
        calculatedNetReturn = 0; // Payments don't generate returns
        runningBalance = Math.max(0, runningBalance - calculatedLoanAdjustment);
        break;
        
      case 'interest':
        // Interest doesn't affect loan balance or generate returns
        break;
        
      default:
        // Handle unknown payment types conservatively
        calculatedLoanAdjustment = payment.loanAdjustment || 0;
        calculatedNetReturn = payment.netReturn || 0;
        runningBalance = Math.max(0, runningBalance - calculatedLoanAdjustment);
    }
    
    processedPayments.push({
      ...payment,
      calculatedLoanAdjustment,
      calculatedNetReturn,
      runningLoanBalance: runningBalance
    });
  });
  
  return processedPayments;
}

/**
 * Calculates payments that should be included in IRR calculation
 * @param processedPayments Array of processed payments
 * @returns Array of cash flows for IRR calculation (excluding loan movements)
 */
export function getIRRCashFlows(processedPayments: ProcessedPayment[]): Array<{date: Date, amount: number}> {
  const cashFlows: Array<{date: Date, amount: number}> = [];
  
  processedPayments.forEach(payment => {
    const paymentDate = payment.date ? new Date(payment.date) : new Date(2024, 0, 1 + payment.month * 30);
    
    switch (payment.type) {
      case 'payment':
        // Regular payments are negative cash flows (money going out)
        cashFlows.push({
          date: paymentDate,
          amount: -Math.abs(payment.amount)
        });
        break;
        
      case 'drawdown':
        // Drawdowns are NOT included in XIRR calculation
        // They represent borrowed money, not investor cash flows
        break;
        
      case 'return':
        // Returns: only the net return portion (after loan adjustment) counts as positive cash flow
        if (payment.calculatedNetReturn > 0) {
          cashFlows.push({
            date: paymentDate,
            amount: payment.calculatedNetReturn
          });
        }
        break;
        
      case 'repayment':
        // Repayments: only the net return portion (after loan adjustment) counts as positive cash flow
        if (payment.calculatedNetReturn > 0) {
          cashFlows.push({
            date: paymentDate,
            amount: payment.calculatedNetReturn
          });
        }
        break;
        
      case 'interest':
        // Interest payments are negative cash flows (money going out)
        cashFlows.push({
          date: paymentDate,
          amount: -Math.abs(payment.amount)
        });
        break;
        
      // Note: We don't include loan adjustments as separate cash flows because:
      // - They represent internal money movements between loan and return
      // - Only the net return portion represents actual cash flow to/from the investor
    }
  });
  
  return cashFlows;
}

/**
 * Creates a partial payment entry that shows breakdown of loan vs return
 * @param totalAmount Total amount of the payment/return
 * @param loanAdjustment Amount going to loan repayment
 * @param originalPayment Original payment object
 * @returns Enhanced payment with breakdown information
 */
export function createPartialPaymentEntry(
  totalAmount: number,
  loanAdjustment: number,
  originalPayment: Payment
): Payment {
  const netReturn = totalAmount - loanAdjustment;
  
  return {
    ...originalPayment,
    amount: totalAmount,
    loanAdjustment,
    netReturn,
    isPartialLoanPayment: loanAdjustment > 0 && loanAdjustment < totalAmount,
    description: loanAdjustment > 0 ? 
      `${originalPayment.description} (₹${loanAdjustment.toLocaleString()} to loan, ₹${netReturn.toLocaleString()} net return)` :
      originalPayment.description
  };
}

/**
 * Validates and fixes payment data to ensure consistency
 * @param payment Payment to validate
 * @returns Validated and corrected payment
 */
export function validatePayment(payment: Payment): Payment {
  const validated = { ...payment };
  
  // Ensure amounts are consistent
  if (validated.loanAdjustment !== undefined && validated.netReturn !== undefined) {
    const calculatedTotal = validated.loanAdjustment + validated.netReturn;
    if (Math.abs(calculatedTotal - Math.abs(validated.amount)) > 0.01) {
      console.warn('Payment amount inconsistency detected, adjusting:', {
        id: validated.id,
        amount: validated.amount,
        loanAdjustment: validated.loanAdjustment,
        netReturn: validated.netReturn,
        calculatedTotal
      });
      validated.amount = calculatedTotal;
    }
  }
  
  // Set partial payment flag
  validated.isPartialLoanPayment = 
    (validated.loanAdjustment || 0) > 0 && 
    (validated.loanAdjustment || 0) < Math.abs(validated.amount);
  
  return validated;
} 