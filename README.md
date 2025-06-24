# Realty Return Calculator

This project is a web application designed to help users calculate returns on realty investments, manage cash flows, and analyze investment performance. It features interest calculation, XIRR (Extended Internal Rate of Return) calculation, and comprehensive cash flow analysis.

## Project Overview

The Realty Return Calculator provides tools for:
- Inputting and managing payment schedules, returns, and rental income
- Calculating monthly interest on outstanding balances with daily compounding
- Computing XIRR (Extended Internal Rate of Return) for accurate return calculations
- Analyzing cash flows with detailed breakdowns of:
  - Total Investment
  - Total Returns
  - Net Profit (including interest expenses)
  - Total Interest Paid
  - XIRR (time-weighted return)
- Importing/exporting cash flow data via CSV
- Viewing a detailed table of all cash flow entries (payments, returns, interest) with running balances

## Environment Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Google API Key (for Gemini AI features)
- Firebase credentials (if using Firebase)

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

## Features

### Financial Calculations
- **XIRR (Extended Internal Rate of Return)**: Calculates the time-weighted return on investment, accounting for the exact timing of all cash flows
- **Interest Calculation**: Automatically calculates monthly interest with daily compounding, handling partial months accurately
- **Net Profit Calculation**: Computes net profit after accounting for all inflows and outflows, including interest expenses

### Cash Flow Management
- **Multiple Transaction Types**:
  - **Payments**: Initial and additional investments (negative cash flow)
  - **Returns**: Investment proceeds (positive cash flow)
  - **Rental Income**: Regular income from the property (positive cash flow)
  - **Interest**: Calculated interest on outstanding balances (negative cash flow)
- **Running Balances**: Tracks the outstanding principal after each transaction

### Data Management
- **CSV Import/Export**: 
  - Import cash flow data from CSV (format: `Date (YYYY-MM-DD or MMM-YYYY), Amount, Description, Type`)
  - Export complete transaction history to CSV for further analysis
- **Dynamic Table View**: Displays all transactions chronologically with running balances
- **Responsive Design**: Works on all device sizes with a clean, modern interface

### Financial Summary
- **Total Investment**: Sum of all payment outflows
- **Total Returns**: Sum of all returns and rental income
- **Net Profit**: Total returns minus total investment and interest paid
- **Total Interest Paid**: Sum of all interest payments
- **XIRR**: Annualized return percentage, accounting for timing of all cash flows

## Getting Started

To run this project locally, follow these steps:

1.  **Clone the repository:**
    ```sh
    git clone <YOUR_GIT_URL> # Replace with your project's Git URL
    cd realty-return-calculator
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
- React Context could be added for global state if needed

### Type System
- Strong TypeScript types for all data structures
- Interfaces for component props and API responses
- Type guards for runtime type checking

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

1. **Interest Calculation**:
   - Interest is calculated daily and compounded monthly
   - The daily rate is calculated as `(annual_rate / 365)`
   - For partial months, interest is prorated based on the number of days
   - Interest is added to the outstanding principal at the end of each month

2. **XIRR Calculation**:
   - Uses the `xirr` library for accurate time-weighted return calculations
   - Considers the exact date and amount of each cash flow
   - Handles irregular cash flow intervals
   - Properly accounts for both positive (returns, rental income) and negative (payments, interest) cash flows

3. **Running Balance**:
   - Updated after each transaction
   - Used as the basis for interest calculations
   - Reflects the current outstanding principal

## Example Usage

### Basic Investment Scenario

1. **Set Up Project**
   - Enter project name (e.g., "Commercial Property Investment")
   - Set annual interest rate (e.g., 12%)

2. **Add Initial Investment**
   - Click "Add Payment"
   - Enter amount: `-10,00,000` (negative for outflow)
   - Select date: `2025-01-01`
   - Description: "Initial property purchase"
   - Type: `Payment`

3. **Add Rental Income**
   - Click "Add Rental Income"
   - Enter amount: `50,000`
   - Select date: `2025-02-01`
   - Description: "Monthly rental income"
   - Type: `Rental Income`

4. **Add Final Return**
   - Click "Add Return"
   - Enter amount: `12,00,000`
   - Select date: `2025-12-31`
   - Description: "Property sale"
   - Type: `Return`

5. **Calculate Interest**
   - Click "Calculate Interest"
   - The system will automatically calculate interest based on the daily compounding formula
   - Interest entries will be added to the cash flow table

6. **View Analysis**
   - Switch to the "Analysis" tab to see:
     - Total Investment: Sum of all payments
     - Total Returns: Sum of all returns and rental income
     - Net Profit: Returns minus investment and interest
     - Total Interest Paid: Calculated interest on outstanding balance
     - XIRR: Annualized return percentage calculated with the xirr library

### CSV Import/Export

1. **Export Data**
   - Click "Export to CSV" to download current transactions
   - File includes all payment, return, and interest entries

2. **Import Data**
   - Click "Import from CSV"
   - Upload a CSV file with columns: `Date, Amount, Description, Type`
   - Supported types: `payment`, `return`, `rental`, `expense`

### Interest Calculation Details
- Interest is calculated daily and compounded monthly
- The system automatically generates interest entries at the end of each month
- Partial months are prorated based on the number of days
- Interest is calculated on the running balance after each transaction

## Future Enhancements

- Graphical visualization of cash flows over time
- Additional financial metrics (NPV, ROI, etc.)
- Support for multiple currencies
- Scenario analysis and comparison
- Exportable reports in PDF format

---

*This README was last updated on May 25, 2025.*
