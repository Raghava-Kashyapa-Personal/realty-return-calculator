# Project Task List & Code Review Notes

*Last Updated: July 4, 2024*

## New Pending Tasks

1. **Add Authentication**
   - Implement user authentication (e.g., with Firebase Auth) to secure project data.
2. **Deploy to clipfusion.com domain**
   - Deploy the app to the clipfusion.com domain using Vercel or another hosting provider.
3. **Modify XIRR calculation for cash/debt investment**
   - Add option to treat investments as cash or debt. Allow converting payments into loans, and handle interest/repayment in cash flow and XIRR accordingly.
4. **UI: Show analysis and cash flow in same tab**
   - Redesign UI so that analysis and cash flow are visible together in a single tab for better usability.

This document outlines pending tasks, potential improvements, and notes from code reviews for the Realty Return Calculator project.

## High-Level Pending Tasks

1.  **Refine `PaymentsCashFlow.tsx` Modularity**:
    *   **CSV Import Logic**: Consider extracting the CSV parsing and import modal into a separate component/utility to reduce the size of `PaymentsCashFlow.tsx`.
    *   **State Management**: Evaluate if the local state for add/edit/import modals within `PaymentsCashFlow.tsx` becomes too complex; could benefit from more structured state management if features expand.

2.  **Enhance CSV Import Robustness**:
    *   Improve error handling for malformed CSV lines during import (e.g., provide more specific feedback to the user about which lines failed and why).
    *   Allow users to map CSV columns if they don't strictly follow the expected format.

3.  **Verify Parent Component's `updatePayments` Prop**:
    *   **Critical**: Ensure the `updatePayments` function passed as a prop to `PaymentsCashFlow.tsx` from its parent component correctly handles `Payment[]` where `Payment.type` can be `'payment'`, `'return'`, or `'interest'`. If it only expects `'payment' | 'return'`, calculated interest will not be saved correctly in the application's main state. This is a key integration point.

4.  **Cash Flow Analysis Implementation**:
    *   The `CashFlowAnalysis.tsx` component exists but its full implementation and integration for displaying meaningful analysis needs to be completed.
    *   Define and implement key metrics to display (e.g., total investment, total returns, net profit, simple ROI).

5.  **Testing Strategy**:
    *   **Unit Tests**: Add unit tests for utility functions, especially `interestCalculator.ts` and `csvExport.ts`.
    *   **Component Tests**: Implement tests for key components like `PaymentsCashFlow.tsx` and `PaymentsTable.tsx` to verify UI interactions and logic.
    *   **End-to-End Tests**: Consider E2E tests for critical user flows like adding a payment, calculating interest, and CSV import/export.

## Code Review Notes & Potential Improvements

*   **`PaymentsCashFlow.tsx`**:
    *   `parseCashFlowData` function is quite long; could be a candidate for refactoring into smaller, more focused functions or a utility.
*   **`interestCalculator.ts`**:
    *   The 3-month future interest calculation is hardcoded. Consider if this should be configurable.
*   **`csvExport.ts`**:
    *   The dependency on `monthToDate` from `@/components/payments/utils` is implicit. If `csvExport.ts` were to be a more standalone utility, this dependency would need to be managed more explicitly (e.g., passed as an argument or imported directly with clear project structure assumptions).
*   **`PaymentsTable.tsx`**:
    *   Minor display inconsistency: Save/Cancel buttons are shown for 'interest' type rows if `editingPayment === payment.id`. This state should ideally not be reachable for interest rows as they are not directly editable. Low priority as `onStartEdit` likely prevents this.
*   **General**:
    *   **Error Handling**: Enhance user feedback for errors across the application (e.g., during CSV import, API calls if any were added).
    *   **Accessibility (A11y)**: Perform an accessibility review to ensure UI components are usable by everyone (e.g., keyboard navigation, ARIA attributes).
    *   **Code Comments**: Add more comments where logic is complex or non-obvious.

## Completed Tasks (Recent)

- Refactored interest calculation logic from `PaymentsCashFlow.tsx` into `src/utils/interestCalculator.ts`.
- Harmonized `Payment` and `CashFlowEntry` type definitions across `src/types/project.ts`, `src/utils/csvExport.ts`, and `PaymentsCashFlow.tsx`.
- Ensured edit/delete buttons in `PaymentsTable.tsx` are grouped as per user preference.
- Updated README.md with project-specific information.

## Intern Tasks (new)
- Integrate the import  with AI instead  of a strict CSV
- Save each project in a FireBase backend
- 
