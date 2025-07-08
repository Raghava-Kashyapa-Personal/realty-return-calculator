import { describe, it, expect, vi } from 'vitest';
import { calculateMonthlyInterestLogic } from './interestCalculator';
import { Payment } from '@/types/project';

// Mock monthToDate from the correct path
vi.mock('@/components/payments/utils.tsx', () => ({
  monthToDate: (month: number): Date => {
    const year = Math.floor(month / 12);
    const monthIndex = month % 12; // 0-indexed month
    return new Date(year, monthIndex, 1); // Day 1 of the month
  },
}));

describe('calculateMonthlyInterestLogic', () => {
  it('should calculate interest on debt drawdown payments only', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'payment',
        debtDrawdown: true, // This flag marks it as affecting principal
        date: new Date('2025-06-01'), 
        month: 5 + 2025 * 12,
        description: 'Debt Drawdown Payment',
      },
      {
        id: '2',
        amount: 50000,
        type: 'payment', // Regular payment - no debt impact
        date: new Date('2025-06-15'), 
        month: 5 + 2025 * 12,
        description: 'Regular Payment (no debt impact)',
      }
    ];
    const interestRate = 12;

    const result = calculateMonthlyInterestLogic({ payments, interestRate });
    const juneInterest = result.newInterestPayments.find(
      (p) => p.date && new Date(p.date).getFullYear() === 2025 && new Date(p.date).getMonth() === 5 
    );

    expect(juneInterest).toBeDefined();
    // Interest should only be calculated on the 100,000 drawdown, not the 50,000 regular payment
    const expectedInterest = 100000 * (0.12 / 12); // Monthly interest on principal only
    expect(juneInterest?.amount).toBeCloseTo(expectedInterest, 2);
  });

  it('should not add interest to principal balance - interest is an expense', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'payment',
        debtDrawdown: true,
        date: new Date('2025-06-01'),
        month: 5 + 2025 * 12,
        description: 'Initial Debt Drawdown',
      }
    ];
    const interestRate = 12;

    // Calculate June interest
    const juneResult = calculateMonthlyInterestLogic({ payments, interestRate });
    const juneInterest = juneResult.newInterestPayments[0];
    
    // Add July debt drawdown
    const paymentsWithJuly: Payment[] = [
      ...payments,
      {
        id: '2',
        amount: 50000,
        type: 'payment',
        debtDrawdown: true,
        date: new Date('2025-07-01'),
        month: 6 + 2025 * 12,
        description: 'July Debt Drawdown',
      }
    ];

    // Calculate July interest - should be on original principal + July drawdown, NOT including June interest
    const julyResult = calculateMonthlyInterestLogic({ payments: paymentsWithJuly, interestRate });
    const julyInterest = julyResult.newInterestPayments.find(
      p => p.date && new Date(p.date).getMonth() === 6 && new Date(p.date).getFullYear() === 2025
    );

    expect(julyInterest).toBeDefined();
    // July interest should be calculated on 150,000 principal (100k + 50k), NOT including June's interest
    const expectedJulyInterest = 150000 * (0.12 / 12);
    expect(julyInterest?.amount).toBeCloseTo(expectedJulyInterest, 2);
  });

  it('should handle returns that reduce principal', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'payment',
        debtDrawdown: true,
        date: new Date('2025-06-01'),
        month: 5 + 2025 * 12,
        description: 'Initial Debt Drawdown',
      },
      {
        id: '2',
        amount: 30000,
        type: 'return',
        applyToDebt: true, // This flag marks it as reducing principal
        date: new Date('2025-06-15'),
        month: 5 + 2025 * 12,
        description: 'Debt Repayment',
      },
      {
        id: '3',
        amount: 20000,
        type: 'return', // Regular return - no debt impact
        date: new Date('2025-06-20'),
        month: 5 + 2025 * 12,
        description: 'Regular Return (no debt impact)',
      }
    ];
    const interestRate = 12;

    const result = calculateMonthlyInterestLogic({ payments, interestRate });
    const juneInterest = result.newInterestPayments.find(
      (p) => p.date && new Date(p.date).getFullYear() === 2025 && new Date(p.date).getMonth() === 5 
    );

    expect(juneInterest).toBeDefined();
    // Interest should be calculated on net principal: 100,000 (drawdown) - 30,000 (repayment) = 70,000
    // The 20,000 regular return should NOT affect principal calculation
    const expectedInterest = 70000 * (0.12 / 12);
    expect(juneInterest?.amount).toBeCloseTo(expectedInterest, 2);
  });

  it('should handle regular payments and returns without affecting principal', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 100000,
        type: 'payment', // Regular payment - no debt impact
        date: new Date('2025-06-01'),
        month: 5 + 2025 * 12,
        description: 'Regular Payment',
      },
      {
        id: '2',
        amount: 50000,
        type: 'return', // Regular return - no debt impact
        date: new Date('2025-06-15'),
        month: 5 + 2025 * 12,
        description: 'Regular Return',
      }
    ];
    const interestRate = 12;

    const result = calculateMonthlyInterestLogic({ payments, interestRate });
    
    // Should have no interest payments since no entries affect principal
    expect(result.newInterestPayments).toHaveLength(0);
    expect(result.totalInterest).toBe(0);
  });

  it('should prevent negative principal balance', () => {
    const payments: Payment[] = [
      {
        id: '1',
        amount: 50000,
        type: 'payment',
        debtDrawdown: true,
        date: new Date('2025-06-01'),
        month: 5 + 2025 * 12,
        description: 'Small Debt Drawdown',
      },
      {
        id: '2',
        amount: 100000,
        type: 'return',
        applyToDebt: true, // Repayment larger than principal
        date: new Date('2025-06-15'),
        month: 5 + 2025 * 12,
        description: 'Large Debt Repayment',
      }
    ];
    const interestRate = 12;

    const result = calculateMonthlyInterestLogic({ payments, interestRate });
    
    // Should have no interest since principal becomes 0 (clamped, not negative)
    expect(result.newInterestPayments).toHaveLength(0);
    expect(result.totalInterest).toBe(0);
  });
});
