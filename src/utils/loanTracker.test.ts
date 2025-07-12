import { describe, it, expect, vi } from 'vitest';
import { calculateLoanBalance, processPaymentsWithLoanTracking, getIRRCashFlows } from './loanTracker';
import { Payment } from '@/types/project';

describe('calculateLoanBalance', () => {
  it('should calculate outstanding balance with only drawdowns', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'First drawdown',
      },
      {
        id: '2',
        amount: 50000,
        type: 'drawdown',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Second drawdown',
      }
    ];

    const result = calculateLoanBalance(payments);
    
    expect(result.outstanding).toBe(150000);
    expect(result.totalDrawn).toBe(150000);
    expect(result.totalRepaid).toBe(0);
  });

  it('should NOT include regular payments in loan balance', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 50000,
        type: 'payment',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Regular payment (expense)',
      }
    ];

    const result = calculateLoanBalance(payments);
    
    // Regular payments should NOT affect loan balance
    expect(result.outstanding).toBe(100000);
    expect(result.totalDrawn).toBe(100000);
    expect(result.totalRepaid).toBe(0);
  });

  it('should handle repayments reducing loan balance', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 30000,
        type: 'repayment',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Loan repayment',
      }
    ];

    const result = calculateLoanBalance(payments);
    
    expect(result.outstanding).toBe(70000);
    expect(result.totalDrawn).toBe(100000);
    expect(result.totalRepaid).toBe(30000);
  });

  it('should handle loan adjustments in payments and returns', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 50000,
        type: 'payment',
        loanAdjustment: 20000,
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Payment with loan adjustment',
      },
      {
        id: '3',
        amount: 80000,
        type: 'return',
        loanAdjustment: 30000,
        date: new Date('2025-03-01'),
        month: 2,
        description: 'Return with loan adjustment',
      }
    ];

    const result = calculateLoanBalance(payments);
    
    expect(result.outstanding).toBe(50000); // 100000 - 20000 - 30000
    expect(result.totalDrawn).toBe(100000);
    expect(result.totalRepaid).toBe(50000);
  });

  it('should prevent negative outstanding balance', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 50000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Small drawdown',
      },
      {
        id: '2',
        amount: 100000,
        type: 'repayment',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Large repayment',
      }
    ];

    const result = calculateLoanBalance(payments);
    
    expect(result.outstanding).toBe(0); // Should be clamped to 0, not negative
    expect(result.totalDrawn).toBe(50000);
    expect(result.totalRepaid).toBe(100000);
  });
});

describe('processPaymentsWithLoanTracking', () => {
  it('should calculate loan adjustments for returns when auto-apply is enabled', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 80000,
        type: 'return',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Return',
      }
    ];

    const result = processPaymentsWithLoanTracking(payments, true);
    
    // First payment (drawdown) should have no adjustments
    expect(result[0].calculatedLoanAdjustment).toBe(0);
    expect(result[0].calculatedNetReturn).toBe(0);
    
    // Second payment (return) should have loan adjustment
    expect(result[1].calculatedLoanAdjustment).toBe(80000); // All goes to loan
    expect(result[1].calculatedNetReturn).toBe(0); // Nothing left as net return
    expect(result[1].runningLoanBalance).toBe(20000); // 100000 - 80000
  });

  it('should calculate partial loan adjustments for returns', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 150000,
        type: 'return',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Large return',
      }
    ];

    const result = processPaymentsWithLoanTracking(payments, true);
    
    // Return should partially pay loan and have net return
    expect(result[1].calculatedLoanAdjustment).toBe(100000); // Only outstanding amount
    expect(result[1].calculatedNetReturn).toBe(50000); // Remainder as net return
    expect(result[1].runningLoanBalance).toBe(0); // Loan fully paid
  });

  it('should handle repayments correctly', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 120000,
        type: 'repayment',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Repayment',
      }
    ];

    const result = processPaymentsWithLoanTracking(payments, true);
    
    // Repayment should pay loan first, then net return
    expect(result[1].calculatedLoanAdjustment).toBe(100000);
    expect(result[1].calculatedNetReturn).toBe(20000);
    expect(result[1].runningLoanBalance).toBe(0);
  });

  it('should respect manual loan adjustments', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 80000,
        type: 'return',
        loanAdjustment: 30000, // Manual adjustment
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Return with manual adjustment',
      }
    ];

    const result = processPaymentsWithLoanTracking(payments, true);
    
    // Should use manual adjustment instead of auto-calculation
    expect(result[1].calculatedLoanAdjustment).toBe(30000);
    expect(result[1].calculatedNetReturn).toBe(50000); // 80000 - 30000
    expect(result[1].runningLoanBalance).toBe(70000); // 100000 - 30000
  });
});

describe('getIRRCashFlows', () => {
  it('should exclude drawdowns from XIRR calculation', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 50000,
        type: 'payment',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Payment',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    // Should only include the payment, not the drawdown
    expect(cashFlows).toHaveLength(1);
    expect(cashFlows[0].amount).toBe(-50000); // Payment as negative cash flow
  });

  it('should include payments and interest as negative cash flows', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 50000,
        type: 'payment',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Payment',
      },
      {
        id: '2',
        amount: 5000,
        type: 'interest',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Interest',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    expect(cashFlows).toHaveLength(2);
    expect(cashFlows[0].amount).toBe(-50000); // Payment
    expect(cashFlows[1].amount).toBe(-5000); // Interest
  });

  it('should include only net returns as positive cash flows', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 150000,
        type: 'return',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Return',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    // Should only include net return portion, not the loan adjustment
    expect(cashFlows).toHaveLength(1);
    expect(cashFlows[0].amount).toBe(50000); // Net return after loan adjustment
  });

  it('should handle repayments correctly in XIRR', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 120000,
        type: 'repayment',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Repayment',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    // Should only include net return portion from repayment
    expect(cashFlows).toHaveLength(1);
    expect(cashFlows[0].amount).toBe(20000); // Net return after loan repayment
  });

  it('should handle all-cash investment scenario', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'payment',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Property purchase',
      },
      {
        id: '2',
        amount: 25000,
        type: 'return',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Rental income',
      },
      {
        id: '3',
        amount: 120000,
        type: 'return',
        date: new Date('2025-12-01'),
        month: 11,
        description: 'Property sale',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    expect(cashFlows).toHaveLength(3);
    expect(cashFlows[0].amount).toBe(-100000); // Payment
    expect(cashFlows[1].amount).toBe(25000); // Return
    expect(cashFlows[2].amount).toBe(120000); // Return
  });

  it('should handle complex leveraged investment scenario', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Loan drawdown',
      },
      {
        id: '2',
        amount: 50000,
        type: 'payment',
        date: new Date('2025-01-15'),
        month: 0,
        description: 'Legal fees',
      },
      {
        id: '3',
        amount: 10000,
        type: 'interest',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Interest payment',
      },
      {
        id: '4',
        amount: 25000,
        type: 'return',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Rental income',
      },
      {
        id: '5',
        amount: 150000,
        type: 'repayment',
        date: new Date('2025-06-01'),
        month: 5,
        description: 'Property sale',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    // Should include: payment, interest, net return from repayment
    // Should exclude: drawdown, loan adjustment portion of return/repayment
    expect(cashFlows).toHaveLength(3);
    
    // Payment and interest should be negative
    expect(cashFlows.find(cf => cf.amount === -50000)).toBeDefined(); // Payment
    expect(cashFlows.find(cf => cf.amount === -10000)).toBeDefined(); // Interest
    
    // Net return should be positive (150000 - remaining loan balance)
    const netReturnCashFlow = cashFlows.find(cf => cf.amount > 0);
    expect(netReturnCashFlow).toBeDefined();
    expect(netReturnCashFlow!.amount).toBe(75000); // 150000 - 75000 remaining loan balance
  });

  it('should handle returns with zero net return', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'drawdown',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Drawdown',
      },
      {
        id: '2',
        amount: 50000,
        type: 'return',
        date: new Date('2025-02-01'),
        month: 1,
        description: 'Return that all goes to loan',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    // Should have no cash flows since return has zero net return
    expect(cashFlows).toHaveLength(0);
  });

  it('should maintain correct chronological order', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 50000,
        type: 'payment',
        date: new Date('2025-03-01'),
        month: 2,
        description: 'Payment',
      },
      {
        id: '2',
        amount: 25000,
        type: 'return',
        date: new Date('2025-01-01'),
        month: 0,
        description: 'Return',
      }
    ];

    const processedPayments = processPaymentsWithLoanTracking(payments, true);
    const cashFlows = getIRRCashFlows(processedPayments);
    
    expect(cashFlows).toHaveLength(2);
    // Should maintain chronological order
    expect(new Date(cashFlows[0].date).getTime()).toBeLessThan(new Date(cashFlows[1].date).getTime());
  });
}); 