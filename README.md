# Project Finance Calculator

_Last Updated: January 2025_

This project is a web application designed to help users calculate returns on project-based investments, manage cash flows, and analyze investment performance. It features sophisticated balance tracking, interest calculation, XIRR (Extended Internal Rate of Return) calculation, and comprehensive cash flow analysis.

## Project Overview

The Project Finance Calculator provides tools for:
- Inputting and managing payment schedules, returns, and rental income for projects
- **Smart Balance Tracking**: Only flagged transactions affect the outstanding debt principal
- Calculating monthly interest on outstanding balances (interest is treated as an expense, not added to principal)
- Computing XIRR (Extended Internal Rate of Return) for accurate return calculations
- Analyzing cash flows with detailed breakdowns of:
  - Total Investment
  - Total Returns
  - Net Profit (including interest expenses)
  - Total Interest Paid
  - XIRR (time-weighted return)
- Importing/exporting cash flow data via CSV
- Viewing a detailed table of all cash flow entries (payments, returns, interest) with running balances
- Saving and loading project data to/from Firestore (Firebase)

## Balance Calculation Logic

### Understanding Outstanding Principal

The application uses a simple type-based balance tracking system where **payment types directly determine their effect on outstanding debt principal**:

#### Transactions That Increase Principal (Debt Drawdowns):
- **`drawdown` type entries**: Represent actual borrowing/debt increases

#### Transactions That Decrease Principal (Debt Repayments):
- **`repayment` type entries**: Represent debt payments that reduce the outstanding balance

#### Transactions That Do NOT Affect Principal:
- **`payment` type entries**: Operating expenses, fees, construction costs, etc.
- **`return` type entries**: Income, dividends, rental income, sale proceeds, etc.
- **`interest` type entries**: Always treated as expenses/outflows, never added to principal

### Interest Calculation Behavior

- **Interest is an expense**: Interest payments are cash outflows that reduce your net return
- **Interest is NOT capitalized**: Interest is never added to the outstanding principal balance
- **Monthly calculation**: Interest is calculated monthly on the current outstanding principal
- **Simple interest**: Uses the monthly rate (annual rate ÷ 12) applied to the principal balance

### Example Scenarios

#### Scenario 1: Property Investment with Loan
```
1. Property purchase (drawdown): -₹10,00,000
   → Outstanding Principal: ₹10,00,000
   
2. Legal fees (payment): -₹50,000
   → Outstanding Principal: ₹10,00,000 (unchanged)
   
3. Monthly interest (auto-calculated): -₹10,000
   → Outstanding Principal: ₹10,00,000 (unchanged, interest is expense)
   
4. Rental income (return): +₹25,000
   → Outstanding Principal: ₹10,00,000 (unchanged, just income)
   
5. Loan repayment (repayment): +₹2,00,000
   → Outstanding Principal: ₹8,00,000 (debt reduced)
```

#### Scenario 2: All-Cash Investment
```
1. Property purchase (payment): -₹10,00,000
   → Outstanding Principal: ₹0 (no debt taken)
   
2. Rental income (return): +₹25,000
   → Outstanding Principal: ₹0 (just income, no debt)
   
3. Property sale (return): +₹12,00,000
   → Outstanding Principal: ₹0 (sale proceeds, no debt)
   
→ No interest calculated since principal is always ₹0
```

## Environment Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google API Key (for Gemini AI features)
- Firebase credentials (Firestore enabled)

### Configuration

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Update the `.env` file with your actual API keys:
   ```
   VITE_GOOGLE_API_KEY=your_google_api_key_here
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   # ... other environment variables
   ```

### Firestore Setup
- Ensure Firestore is enabled in your Firebase project (see Firebase Console > Firestore Database)
- For development, you may use permissive security rules:
  ```
  service cloud.firestore {
    match /databases/{database}/documents {
      match /{document=**} {
        allow read, write: if true;
      }
    }
  }
  ```
  **Warning:** These rules allow public access. Use only for development.

### Security Best Practices

- **Never commit your `.env` file** - It's already in `.gitignore`
- Use different API keys for development and production
- Restrict API key usage in Google Cloud Console
- Rotate your API keys periodically
- Use environment variables for all sensitive data

## Technologies Used

This project is built with:

- **Vite**: For fast frontend build tooling.
- **React**: For building the user interface.
- **TypeScript**: For static typing and improved code quality.
- **shadcn-ui**: For UI components.
- **Tailwind CSS**: For utility-first CSS styling.
- **Lucide React**: For icons.
- **date-fns**: For date utility functions.
- **Firebase/Firestore**: For project data storage and sync.

## Features

### Financial Calculations
- **XIRR (Extended Internal Rate of Return)**: Calculates the time-weighted return on investment, accounting for the exact timing of all cash flows
- **Interest Calculation**: Automatically calculates monthly interest on outstanding debt principal only
- **Net Profit Calculation**: Computes net profit after accounting for all inflows and outflows, including interest expenses

### Cash Flow Management
- **Multiple Transaction Types**:
  - **Payments**: Expenses, investments, or debt drawdowns (negative cash flow)
  - **Returns**: Income, proceeds, or debt repayments (positive cash flow)
  - **Rental Income**: Regular income from the project (positive cash flow)
  - **Interest**: Calculated interest on outstanding debt (negative cash flow/expense)
- **Smart Balance Tracking**: Only flagged transactions affect outstanding debt principal
- **Toggle Buttons**: Easily mark payments as debt drawdowns or returns as debt repayments

### Data Management
- **CSV Import/Export**: 
  - Import cash flow data from CSV (format: `Date (YYYY-MM-DD or MMM-YYYY), Amount, Description, Type`)
  - Export complete transaction history to CSV for further analysis
- **Dynamic Table View**: Displays all transactions chronologically with running balances
- **Responsive Design**: Works on all device sizes with a clean, modern interface
- **Firestore Integration**: Save and load project data to/from Firestore (Firebase)

### Financial Summary
- **Total Investment**: Sum of all payment outflows
- **Total Returns**: Sum of all returns and rental income
- **Net Profit**: Total returns minus total investment and interest paid
- **Total Interest Paid**: Sum of all interest payments (expense)
- **XIRR**: Annualized return percentage, accounting for timing of all cash flows

## Getting Started

To run this project locally, follow these steps:

1.  **Clone the repository:**
    ```sh
    git clone <YOUR_GIT_URL> # Replace with your project's Git URL
    cd realty-return-calculator-1
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```
    Or if you prefer yarn:
    ```sh
    yarn install
    ```

3.  **Run the development server:**
    ```sh
    npm run dev
    ```
    Or with yarn:
    ```sh
    yarn dev
    ```
    This will start the Vite development server, typically on `http://localhost:5173`.

## Architecture Overview

The application follows a modular architecture with clear separation of concerns. Here's a breakdown of the key components and their interactions:

### Core Data Model
- **`ProjectData` (in `src/types/project.ts`):** The central data structure that holds all project information including:
  - Project name and metadata
  - List of payments, returns, and rental income
  - Financial parameters (interest rate, etc.)

### Main Components

#### 1. Application Entry Point
- **`src/main.tsx`:** Initializes the React application
- **`src/App.tsx`:** Sets up routing and global providers

#### 2. Page Components
- **`src/pages/Index.tsx`:** Main application page that orchestrates:
  - State management for project data
  - Integration of all major components
  - Data flow between components

#### 3. Core Feature Components
- **`PaymentManager` (`src/components/PaymentManager.tsx`):**
  - Manages payment entries (add/edit/delete)
  - Handles CSV import/export
  - Coordinates with interest calculation

- **`CashFlowAnalysis` (`src/components/CashFlowAnalysis.tsx`):**
  - Displays financial metrics (XIRR, net profit, etc.)
  - Processes and analyzes cash flow data
  - Visualizes investment performance

- **`FinancialMetrics` (`src/components/FinancialMetrics.tsx`):**
  - Manages interest rate settings
  - Displays key financial indicators

- **`ProjectSetup` (`src/components/ProjectSetup.tsx`):**
  - Handles project configuration
  - Manages basic project information

- **`ProjectSidebar` (`src/components/ProjectSidebar.tsx`):**
  - Sidebar for switching between projects
  - Project management UI

### Business Logic
- **`useInterestCalculator` (`src/hooks/useInterestCalculator.ts`):**
  - Central hook for interest-related calculations
  - Manages the state of interest calculations
  - Provides methods to calculate and update interest

- **`interestCalculator` (`src/utils/interestCalculator.ts`):**
  - Core logic for interest calculations
  - Handles daily compounding and partial months
  - Processes payment schedules to generate interest entries

### Data Processing
- **`csvExport` (`src/utils/csvExport.ts`):**
  - Handles import/export of transaction data
  - Converts between CSV and internal data structures

### UI Components
- **`PaymentsTable` (`src/components/payments/PaymentsTable.tsx`):**
  - Displays transaction history
  - Handles inline editing
  - Shows running balances

- **`ReturnsTable` (`src/components/payments/ReturnsTable.tsx`):**
  - Manages return entries
  - Similar functionality to PaymentsTable but for returns

### Data Flow
1. User interactions in UI components trigger state updates
2. State changes flow down through props
3. Business logic in hooks processes the data
4. Results are displayed in the UI
5. Changes are persisted in the parent component's state

### State Management
- Local component state for UI-specific state
- Lifted state for shared data (managed in parent components)
- React Context for global project state
- Firestore for persistent project storage

### Type System
- Strong TypeScript types for all data structures

## Recent Changes

- Renamed the app from "Realty Return Calculator" to "Project Finance Calculator"
- Changed all references from "sessions" to "projects" (UI, code, Firestore, etc.)
- Enabled Firestore and set up development security rules
- Removed console logs that exposed API keys
- Updated all import paths and component names to use "project" terminology
- Ensured saving and loading project data with Firestore works as expected

## Project Structure (Key Directories)

- `src/components/`: React components
  - `payments/`: Payment-related components
  - `ui/`: Reusable UI components (buttons, inputs, etc.)
- `src/utils/`: Utility functions
  - `interestCalculator.ts`: Core interest calculation logic
  - `csvExport.ts`: CSV import/export functionality
- `src/types/`: TypeScript type definitions
  - `project.ts`: Core data types
- `src/hooks/`: Custom React hooks
  - `useInterestCalculator.ts`: Interest calculation logic
- `src/pages/`: Page components
- `public/`: Static assets

## Contributing

[Details on how to contribute, if applicable, e.g., coding standards, pull request process.]

## How It Works

1. **Balance Tracking**:
   - Outstanding principal is tracked separately from cash flows
   - Only transactions with `debtDrawdown` or `applyToDebt` flags affect the principal
   - This allows accurate modeling of leveraged vs. all-cash investments

2. **Interest Calculation**:
   - Interest is calculated monthly on the outstanding debt principal only
   - Interest rate is applied as: `principal × (annual_rate ÷ 12)`
   - Interest is treated as an expense (cash outflow), not added to principal
   - No interest is calculated when outstanding principal is zero

3. **XIRR Calculation**:
   - Uses the `xirr` library for accurate time-weighted return calculations
   - Considers the exact date and amount of each cash flow
   - Handles irregular cash flow intervals
   - Properly accounts for both positive (returns, rental income) and negative (payments, interest) cash flows

4. **Transaction Types**:
   - **Payment types**: `payment` (expenses) and `drawdown` (debt increases)
   - **Return types**: `return` (income) and `repayment` (debt reductions)
   - **Toggle buttons**: UI provides easy toggle buttons to convert between related types
   - **Visual indicators**: Different types show distinct visual styling

## Example Usage

### Leveraged Investment Scenario

1. **Set Up Project**
   - Enter project name (e.g., "Leveraged Property Investment")
   - Set annual interest rate (e.g., 12%)

2. **Add Debt Drawdown (affects principal)**
   - Click "Add Payment"
   - Enter amount: `10,00,000`
   - Select date: `2025-01-01`
   - Description: "Property purchase loan"
   - **Toggle the debt drawdown button (💳)** to convert from `payment` to `drawdown` type
   - Outstanding Principal: ₹10,00,000

3. **Add Operating Expense (doesn't affect principal)**
   - Click "Add Payment"
   - Enter amount: `50,000`
   - Select date: `2025-01-15`
   - Description: "Legal and registration fees"
   - **Leave as `payment` type** (don't toggle the button)
   - Outstanding Principal: ₹10,00,000 (unchanged)

4. **Add Rental Income (doesn't affect principal)**
   - Click "Add Return"
   - Enter amount: `25,000`
   - Select date: `2025-02-01`
   - Description: "Monthly rental income"
   - **Leave as `return` type** (don't toggle the button)
   - Outstanding Principal: ₹10,00,000 (unchanged)

5. **Add Debt Repayment (reduces principal)**
   - Click "Add Return"
   - Enter amount: `2,00,000`
   - Select date: `2025-06-01`
   - Description: "Partial loan repayment"
   - **Toggle the apply to debt button (💰)** to convert from `return` to `repayment` type
   - Outstanding Principal: ₹8,00,000

6. **Calculate Interest**
   - Click "Calculate Interest"
   - Interest will be calculated on the varying principal balance
   - January: ₹10,00,000 × (12% ÷ 12) = ₹10,000
   - February-May: ₹10,00,000 × (12% ÷ 12) = ₹10,000 each month
   - June onwards: ₹8,00,000 × (12% ÷ 12) = ₹8,000 each month

### All-Cash Investment Scenario

1. **Set Up Project**
   - Enter project name (e.g., "All-Cash Property Investment")
   - Set annual interest rate (e.g., 12%) - won't be used since no debt

2. **Add Cash Investment (doesn't affect principal)**
   - Click "Add Payment"
   - Enter amount: `10,00,000`
   - Description: "Property purchase - cash"
   - **Leave as `payment` type** (this is key - don't toggle to drawdown!)
   - Outstanding Principal: ₹0

3. **Add All Other Transactions**
   - Rental income, expenses, sale proceeds
   - **Keep as base types** (`payment` for expenses, `return` for income)
   - Outstanding Principal: Always ₹0

4. **Calculate Interest**
   - No interest calculated since outstanding principal is always zero
   - XIRR calculation will show the return on your cash investment

### Understanding the Toggle Buttons

- **💳 Debt Drawdown Button** (on payments): 
  - Converts between `payment` (expense) ↔ `drawdown` (debt increase)
  - Orange when active (drawdown), gray when inactive (payment)

- **💰 Apply to Debt Button** (on returns):
  - Converts between `return` (income) ↔ `repayment` (debt reduction)
  - Blue when active (repayment), gray when inactive (return)

## XIRR Calculation Logic

### What is XIRR?
XIRR (Extended Internal Rate of Return) measures the **actual annualized return to the investor** based on the exact timing and amounts of cash flows. It answers the question: "What interest rate would I need to get from a bank to achieve the same returns as this investment?"

### Key Principle: Investor's Perspective
XIRR should **only include cash flows that actually impact the investor's wallet**. 

**What counts as investor cash flow:**
- Money the investor pays out of their pocket (expenses, fees, interest)
- Money the investor receives in their pocket (net returns, rental income)

**What does NOT count as investor cash flow:**
- Borrowed money (drawdowns) - this is the lender's money, not the investor's
- Loan repayments - this money goes to the lender, not the investor's pocket
- Internal loan movements and debt refinancing

### Transaction Types and XIRR Treatment

#### 1. **Payments** (`payment` type)
- **Represents**: Money the investor pays out (construction costs, fees, etc.)
- **XIRR Treatment**: **Negative cash flow** (money out of investor's pocket)
- **Example**: ₹50,000 legal fees → -₹50,000 in XIRR

#### 2. **Drawdowns** (`drawdown` type)
- **Represents**: Money the investor borrows/draws from loan to fund project
- **XIRR Treatment**: **NOT INCLUDED** (this is borrowed money, not investor's cash)
- **Example**: ₹10,00,000 loan drawdown for property purchase → **₹0 in XIRR**

#### 3. **Returns** (`return` type)
- **Represents**: Money the investor receives back
- **XIRR Treatment**: **Positive cash flow** (money into investor's pocket)
- **Example**: ₹25,000 rental income → +₹25,000 in XIRR

#### 4. **Repayments** (`repayment` type) - **COMPLEX CASE**
- **Represents**: Money received that partially pays down loan and partially returns to investor
- **XIRR Treatment**: **Only the net return portion** is positive cash flow
- **Example**: ₹10,00,000 repayment with ₹6,00,000 to loan + ₹4,00,000 net return → +₹4,00,000 in XIRR
- **Note**: The ₹6,00,000 loan repayment is NOT investor cash flow (it goes to lender)

#### 5. **Interest** (`interest` type)
- **Represents**: Interest expense paid by investor
- **XIRR Treatment**: **Negative cash flow** (money out of investor's pocket)
- **Example**: ₹10,000 monthly interest → -₹10,000 in XIRR

#### 6. **Rental Income** (separate from payments)
- **Represents**: Regular income from the project
- **XIRR Treatment**: **Positive cash flow** (money into investor's pocket)
- **Example**: ₹25,000 monthly rent → +₹25,000 in XIRR

### Loan Adjustment Logic for XIRR

When processing **returns** and **repayments**, the system must determine how much goes to:
1. **Loan Principal Reduction**: Does NOT count as investor cash flow
2. **Net Return to Investor**: DOES count as positive cash flow for XIRR

#### Automatic Loan Adjustment Rules:
1. **If outstanding loan exists**: Returns automatically apply to loan first, remainder goes to investor
2. **If no outstanding loan**: Full amount goes to investor as net return
3. **Manual override**: Users can manually adjust the loan vs return split

### XIRR Calculation Examples

#### Example 1: Simple All-Cash Investment
```
Date        | Transaction Type | Amount      | XIRR Cash Flow
2025-01-01  | Payment         | -₹10,00,000 | -₹10,00,000
2025-02-01  | Return          | +₹25,000    | +₹25,000
2025-03-01  | Return          | +₹25,000    | +₹25,000
2025-12-01  | Return (Sale)   | +₹12,00,000 | +₹12,00,000

XIRR Input: [
  {date: '2025-01-01', amount: -1000000},
  {date: '2025-02-01', amount: 25000},
  {date: '2025-03-01', amount: 25000},
  {date: '2025-12-01', amount: 1200000}
]
```

#### Example 2: Leveraged Investment with Loan Tracking
```
Date        | Transaction Type | Amount      | Loan Balance | XIRR Cash Flow | Notes
2025-01-01  | Drawdown        | -₹10,00,000 | ₹10,00,000   | ₹0             | Borrowed money, not investor cash
2025-01-15  | Payment         | -₹50,000    | ₹10,00,000   | -₹50,000       | Investor pays fees
2025-02-01  | Interest        | -₹10,000    | ₹10,00,000   | -₹10,000       | Investor pays interest
2025-02-01  | Return          | +₹25,000    | ₹9,75,000    | +₹0            | All goes to loan repayment
2025-06-01  | Repayment       | +₹10,00,000 | ₹0           | +₹25,000       | ₹9,75,000 to loan, ₹25,000 to investor

XIRR Input: [
  {date: '2025-01-15', amount: -50000},
  {date: '2025-02-01', amount: -10000},
  {date: '2025-06-01', amount: 25000}
]
```

#### Example 3: Mixed Investment with Manual Loan Adjustments
```
Date        | Transaction Type | Amount      | Loan Adj | Net Return | XIRR Cash Flow
2025-01-01  | Drawdown        | -₹10,00,000 | -        | -          | ₹0 (borrowed money)
2025-06-01  | Repayment       | +₹10,00,000 | ₹6,00,000| ₹4,00,000  | +₹4,00,000
2025-12-01  | Return          | +₹2,00,000  | -        | ₹2,00,000  | +₹2,00,000

XIRR Input: [
  {date: '2025-06-01', amount: 400000},
  {date: '2025-12-01', amount: 200000}
]
```

### Implementation Requirements

#### 1. **Process Payments with Loan Tracking**
```typescript
// First, process all payments to calculate loan adjustments
const processedPayments = processPaymentsWithLoanTracking(payments, autoApplyToLoan);

// Then extract IRR cash flows
const irrCashFlows = getIRRCashFlows(processedPayments);
```

#### 2. **Cash Flow Extraction Rules**
- **Payments**: Full amount as negative cash flow (investor's expense)
- **Drawdowns**: NOT INCLUDED (borrowed money, not investor's cash)
- **Returns**: Only `calculatedNetReturn` as positive cash flow (investor's income)
- **Repayments**: Only `calculatedNetReturn` as positive cash flow (investor's income)
- **Interest**: Full amount as negative cash flow (investor's expense)

#### 3. **Validation**
- Must have both positive and negative cash flows
- At least 2 cash flows required
- All cash flows must have valid dates
- Amounts must be non-zero

#### 4. **Error Handling**
- "All transactions negative" → Check if returns are properly calculating net returns
- "All transactions positive" → Check if payments/drawdowns are included
- "Insufficient cash flows" → Need at least 2 transactions

### Common Issues and Solutions

#### Issue: "Transactions must not all be negative"
**Cause**: Returns/repayments are not generating positive cash flows, or drawdowns are incorrectly included as negative cash flows
**Solution**: 
- Verify that `calculatedNetReturn` is > 0 for returns/repayments
- Ensure drawdowns are NOT included in XIRR calculation (they're borrowed money)

#### Issue: XIRR showing 0% despite positive returns
**Cause**: Loan adjustments consuming all returns, or no positive cash flows reaching investor
**Solution**: Check loan balance calculations and manual adjustments

#### Issue: XIRR too high/low
**Cause**: Including borrowed money or loan movements as cash flows
**Solution**: 
- Exclude drawdowns entirely (borrowed money is not investor cash flow)
- Ensure only net returns (after loan adjustments) are included

#### Issue: No cash flows for XIRR calculation
**Cause**: All transactions are drawdowns or loan movements
**Solution**: Ensure you have actual investor expenses (payments, interest) and investor income (net returns)

## Future Enhancements

- Graphical visualization of cash flows over time
- Additional financial metrics (NPV, ROI, etc.)
- Support for multiple currencies
- Scenario analysis and comparison
- Exportable reports in PDF format
- Advanced interest calculation options (daily compounding, variable rates)


