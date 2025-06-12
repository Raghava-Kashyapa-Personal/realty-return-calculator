# Realty Return Calculator

This project is a web application designed to help users calculate returns on realty investments, manage cash flows, and analyze investment performance. It features interest calculation, XIRR (Extended Internal Rate of Return) calculation, comprehensive cash flow analysis, and cloud-based data persistence.

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
- AI-powered text import using Google's Gemini AI
- Cloud storage with Firebase Firestore
- Session-based data management
- Viewing a detailed table of all cash flow entries (payments, returns, interest) with running balances

## Technologies Used

This project is built with:

- **Vite**: For fast frontend build tooling
- **React**: For building the user interface
- **TypeScript**: For static typing and improved code quality
- **shadcn-ui**: For UI components
- **Tailwind CSS**: For utility-first CSS styling
- **Lucide React**: For icons
- **date-fns**: For date utility functions
- **Firebase**: For cloud storage and real-time data synchronization
- **Google Generative AI (Gemini)**: For AI-powered text parsing
- **xirr**: For XIRR calculations
- **PapaParse**: For CSV parsing
- **pdf-parse & pdfjs-dist**: For PDF text extraction
- **mammoth**: For Word document text extraction
- **React Query**: For data fetching and caching
- **React Router**: For client-side routing

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
- **Session Management**: Organize cash flows by project sessions

### Data Management
- **CSV Import/Export**: 
  - Import cash flow data from CSV (format: `Date (YYYY-MM-DD or MMM-YYYY), Amount, Description, Type`)
  - Export complete transaction history to CSV for further analysis
- **AI-Powered Text Import**:
  - Extract payment data from unstructured text using Google's Gemini AI
  - Support for PDF, Word (.doc, .docx), RTF, and plain text files
  - Intelligent parsing of dates, amounts, and descriptions
- **Firebase Cloud Storage**:
  - Automatic saving of all transactions to Firebase Firestore
  - Session-based data organization
  - Real-time synchronization across devices
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
    Or with bun:
    ```sh
    bun install
    ```

3.  **Set up environment variables:**
    Create a `.env` file in the root directory and add:
    ```
    VITE_GOOGLE_API_KEY=your_google_api_key_here
    ```
    (Optional: The app includes a default API key for testing, but you should use your own for production)

4.  **Run the development server:**
    ```sh
    npm run dev
    ```
    Or with yarn:
    ```sh
    yarn dev
    ```
    Or with bun:
    ```sh
    bun dev
    ```
    This will start the Vite development server, typically on `http://localhost:5173`.

## Architecture Overview

The application follows a modular architecture with clear separation of concerns. Here's a breakdown of the key components and their interactions:

### Core Data Model
- **`ProjectData` (in `src/types/project.ts`):** The central data structure that holds all project information including:
  - Project name and metadata
  - List of payments, returns, and rental income
  - Financial parameters (interest rate, etc.)
  - Session management

### Main Components

#### 1. Application Entry Point
- **`src/main.tsx`:** Initializes the React application
- **`src/App.tsx`:** Sets up routing, providers (React Query, Tooltip, Toast)

#### 2. Page Components
- **`src/pages/Index.tsx`:** Main application page that orchestrates:
  - State management for project data
  - Integration of all major components
  - Data flow between components
  - Session management

#### 3. Core Feature Components
- **`PaymentsCashFlow` (`src/components/PaymentsCashFlow.tsx`):**
  - Central component for cash flow management
  - Handles payment entries (add/edit/delete)
  - CSV import/export functionality
  - AI text import integration
  - Firebase data synchronization
  - Interest calculation trigger

- **`CashFlowAnalysis` (`src/components/CashFlowAnalysis.tsx`):**
  - Displays financial metrics (XIRR, net profit, etc.)
  - Processes and analyzes cash flow data
  - Visualizes investment performance

- **`AITextImporter` (`src/components/AITextImporter.tsx`):**
  - AI-powered text parsing interface
  - Supports multiple file formats (PDF, Word, RTF, TXT)
  - Uses Google's Gemini AI for intelligent data extraction
  - Fallback rule-based parser

- **`SessionSidebar` (`src/components/SessionSidebar.tsx`):**
  - Manages project sessions
  - Allows switching between different projects
  - Session creation and deletion

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

- **`firestoreService` (`src/services/firestoreService.ts`):**
  - Firebase Firestore integration
  - Handles CRUD operations for payments and sessions
  - Manages data synchronization

### UI Components
- **`PaymentsTable` (`src/components/payments/PaymentsTable.tsx`):**
  - Displays transaction history
  - Handles inline editing
  - Shows running balances

### Data Flow
1. User interactions in UI components trigger state updates
2. State changes flow down through props
3. Business logic in hooks processes the data
4. Results are displayed in the UI
5. Changes are persisted to Firebase Firestore
6. Session management allows switching between projects

### State Management
- Local component state for UI-specific state
- Lifted state for shared data (managed in parent components)
- Firebase Firestore for persistent storage
- React Query for caching and synchronization

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
  - `projectDateUtils.ts`: Date manipulation utilities
- `src/types/`: TypeScript type definitions
  - `project.ts`: Core data types
- `src/hooks/`: Custom React hooks
  - `useInterestCalculator.ts`: Interest calculation logic
  - `use-toast.ts`: Toast notification system
- `src/services/`: External service integrations
  - `firestoreService.ts`: Firebase Firestore operations
- `src/pages/`: Page components
- `public/`: Static assets
- `docs/`: Project documentation
  - `TASKLIST.md`: Development roadmap and tasks

## How It Works

1. **Interest Calculation**:
   - Interest is calculated daily and compounded monthly
   - The daily rate is calculated as `(annual_rate / 365)`
   - For partial months, interest is prorated based on the number of days
   - Interest is added to the outstanding principal at the end of each month
   - The calculation includes previously accrued interest in the principal (compound interest)

2. **XIRR Calculation**:
   - Uses the `xirr` library for accurate time-weighted return calculations
   - Considers the exact date and amount of each cash flow
   - Handles irregular cash flow intervals
   - Properly accounts for both positive (returns, rental income) and negative (payments, interest) cash flows

3. **Running Balance**:
   - Updated after each transaction
   - Used as the basis for interest calculations
   - Reflects the current outstanding principal

4. **AI Text Import**:
   - Extracts text from uploaded files (PDF, Word, RTF, TXT)
   - Uses Google's Gemini AI to parse unstructured text
   - Identifies dates, amounts, and descriptions automatically
   - Falls back to rule-based parsing if AI is unavailable

5. **Firebase Integration**:
   - Automatically saves all transactions to Firestore
   - Organizes data by sessions for project management
   - Enables real-time synchronization across devices
   - Provides data persistence and backup

## Example Usage

### Basic Investment Scenario

1. **Set Up Project**
   - Enter project name (e.g., "Commercial Property Investment")
   - Set annual interest rate (e.g., 12%)
   - Create or select a session

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

### AI Text Import

1. **Upload Document**
   - Click "AI Import" button
   - Select a file (PDF, Word, RTF, or TXT)
   - The AI will extract and parse payment information

2. **Paste Text**
   - Alternatively, paste unstructured text directly
   - Click "Convert to CSV" to parse with AI
   - Review and import the parsed data

### Interest Calculation Details
- Interest is calculated daily and compounded monthly
- The system automatically generates interest entries at the end of each month
- Partial months are prorated based on the number of days
- Interest is calculated on the running balance after each transaction
- Compound interest is applied (interest on previously accrued interest)

## Testing

The project includes:
- Unit tests for utility functions (in progress)
- Test setup with Vitest
- Run tests with: `npm run test`

## Future Enhancements

- Graphical visualization of cash flows over time
- Additional financial metrics (NPV, ROI, etc.)
- Support for multiple currencies
- Scenario analysis and comparison
- Exportable reports in PDF format
- Enhanced mobile experience
- Offline support with sync capabilities
- Multi-user collaboration features
- Advanced filtering and search capabilities
- Integration with external financial APIs

## Contributing

Contributions are welcome! Please follow these guidelines:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[Specify your license here]

---

*This README was last updated on January 2025.*
