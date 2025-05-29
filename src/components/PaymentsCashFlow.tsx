import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Payment, IncomeItem, ProjectData } from '@/types/project';
import { useToast } from '@/hooks/use-toast';
import { CashFlowAnalysis } from '@/components/CashFlowAnalysis';
import { PaymentsTable } from '@/components/payments/PaymentsTable';
import { Plus, ArrowUpDown, X, Upload, Copy, Percent, Calculator, Save, Database, Download } from 'lucide-react';
import { exportToCsv } from '@/utils/csvExport';
import { format, endOfMonth } from 'date-fns'; 
import { 
  formatCurrency, 
  formatNumber, 
  parseCurrencyAmount, 
  parseDate, 
  monthToDate, 
  dateToMonth 
} from '@/components/payments/utils';
import { calculateMonthlyInterestLogic, CalculatedInterestResult } from '@/utils/interestCalculator'; 
import { calculateDerivedProjectEndDate } from '@/utils/projectDateUtils'; 
import { savePayments, saveSinglePayment, saveProjectData, fetchAllEntries, fetchTodayEntries, fetchProjectEntries } from '@/services/firestoreService';

interface PaymentsCashFlowProps {
  projectData: ProjectData;
  updateProjectData: (updates: Partial<ProjectData>) => void;
  updatePayments: (payments: Payment[]) => void;
  showOnlyCashFlow?: boolean;
  showOnlyAnalysis?: boolean;
}

const PaymentsCashFlow: React.FC<PaymentsCashFlowProps> = ({ 
  projectData, 
  updateProjectData, 
  updatePayments,
  showOnlyCashFlow = false,
  showOnlyAnalysis = false
}): JSX.Element => {
  const [csvData, setCsvData] = useState('');
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [interestRate, setInterestRate] = useState<number>(projectData.annualInterestRate || 12); 
  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
    month: dateToMonth(new Date()),
    amount: 0,
    description: '',
    date: new Date(), 
    type: 'payment',
  });
  const { toast } = useToast();

  const [currentInterestDetails, setCurrentInterestDetails] = useState<CalculatedInterestResult | null>(null);

  // Only clear interest details when core payment data changes, NOT when switching tabs
  useEffect(() => {
    setCurrentInterestDetails(null);
  }, [projectData.payments, projectData.rentalIncome, interestRate]);
  
  // Button to manually fetch data
  const [isFetching, setIsFetching] = useState(false);

  // Function to manually fetch data from Firestore
  const fetchDataFromFirestoreManual = async () => {
    setIsFetching(true);
    try {
      // Try to fetch all entries first for simplicity
      console.log('Manually fetching all database entries');
      const { entries } = await fetchAllEntries(100); // Get more entries
      
      if (entries.length > 0) {
        console.log('Found entries in database:', entries.length);
        
        // Generate IDs for any entries that don't have them
        const entriesWithIds = entries.map(entry => ({
          ...entry,
          id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        }));
        
        // Merge with existing payments, avoid duplicates by ID
        const existingIds = projectData.payments.map(p => p.id);
        const newPayments = entriesWithIds.filter(p => p.id && !existingIds.includes(p.id));
        
        if (newPayments.length > 0) {
          console.log('Adding entries from database:', newPayments.length);
          
          // Create a new array with both existing and new payments
          const combinedPayments = [...projectData.payments, ...newPayments];
          
          // Update state with the combined payments
          updatePayments(combinedPayments);
          
          toast({
            title: 'Data Loaded',
            description: `Loaded ${newPayments.length} entries from database`
          });
        } else {
          toast({
            title: 'No New Data',
            description: 'No new entries found in the database'
          });
        }
      } else {
        toast({
          title: 'No Data',
          description: 'No entries found in the database'
        });
      }
    } catch (error) {
      console.error('Error fetching data from Firestore:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch data from database'
      });
    } finally {
      setIsFetching(false);
    }
  };

  // Fetch data from Firestore when the component loads
  useEffect(() => {
    // Define async function inside the effect
    const fetchDataFromFirestore = async () => {
      try {
        console.log('Auto-fetching database entries on component load');
        const { entries } = await fetchAllEntries(50); // Get up to 50 entries
        
        if (entries.length > 0) {
          console.log('Found entries in database:', entries.length);
          
          // Generate IDs for any entries that don't have them
          const entriesWithIds = entries.map(entry => ({
            ...entry,
            id: entry.id || `entry-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          }));
          
          // No need to check for duplicates on initial load
          console.log('Setting initial payments from database');
          
          // Update the project data with the fetched payments
          updatePayments(entriesWithIds);
          
          toast({
            title: 'Data Loaded',
            description: `Loaded ${entries.length} entries from database`
          });
        } else {
          console.log('No entries found in database');
        }
      } catch (error) {
        console.error('Error fetching data from Firestore:', error);
        // Don't show error toast to user for this automatic operation
      }
    };
    
    // Only run if there are no payments already loaded
    if (projectData.payments.length === 0) {
      fetchDataFromFirestore();
    }
  }, []); // Empty dependency array - only run once on mount

  const projectEndDate = useMemo(() => {
    const allNonInterestEntries = [
      ...projectData.payments.map(p => ({ ...p, date: p.date ? new Date(p.date) : monthToDate(p.month) })),
      ...projectData.rentalIncome.map(r => ({ ...r, date: r.date ? new Date(r.date) : monthToDate(r.month) }))
    ];
    return calculateDerivedProjectEndDate(allNonInterestEntries as Payment[]); 
  }, [projectData.payments, projectData.rentalIncome]);

  // Simple interest calculation directly in the component
  const calculateSimpleInterest = () => {
    // Filter out only payment entries (negative amounts) and sort by date
    const paymentEntries = projectData.payments
      .filter(p => p.amount < 0 && p.type !== 'interest')
      .sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date || monthToDate(a.month));
        const dateB = b.date instanceof Date ? b.date : new Date(b.date || monthToDate(b.month));
        return dateA.getTime() - dateB.getTime();
      });
    
    if (paymentEntries.length === 0) {
      toast({
        title: 'No Payments Found',
        description: 'Interest can only be calculated on payment entries (negative amounts)',
      });
      return [];
    }
    
    // Calculate interest for each month after payments
    const monthlyRate = interestRate / 100 / 12;
    let balance = 0;
    let lastDate = new Date();
    const interestPayments: Payment[] = [];
    
    // First pass: update balance and track last date
    for (const payment of paymentEntries) {
      // Convert payment date to Date object
      const paymentDate = payment.date instanceof Date ? payment.date : new Date(payment.date || monthToDate(payment.month));
      
      // Update balance (add absolute value for payments - negative amounts increase debt)
      balance += Math.abs(payment.amount);
      
      // Track the latest date
      if (paymentDate > lastDate) {
        lastDate = paymentDate;
      }
    }
    
    // Generate interest payments for 6 months after the last payment
    let currentDate = new Date(lastDate);
    for (let i = 0; i < 6; i++) {
      // Move to next month
      currentDate = new Date(currentDate);
      currentDate.setMonth(currentDate.getMonth() + 1);
      
      // Calculate interest for this month
      const monthlyInterest = balance * monthlyRate;
      
      // Skip if no interest to pay
      if (monthlyInterest <= 0) continue;
      
      // Add interest to balance (compound)
      balance += monthlyInterest;
      
      // Create interest payment entry
      const interestPayment: Payment = {
        id: `interest_${currentDate.getTime()}`,
        amount: -monthlyInterest, // Negative for payment
        date: new Date(currentDate),
        month: dateToMonth(currentDate),
        description: `Interest @ ${interestRate}% on balance ₹${Math.round(balance - monthlyInterest).toLocaleString('en-IN')}`,
        type: 'interest'
      };
      
      interestPayments.push(interestPayment);
    }
    
    return interestPayments;
  };
  
  const handleCalculateInterest = useCallback(() => {
    try {
      console.log('-------- STARTING INTEREST CALCULATION ---------');
      // Validation check
      if (interestRate <= 0 && projectData.payments.length === 0) {
        toast({
          title: 'No Interest to Calculate',
          description: 'Interest rate is 0 or no payments exist.',
        });
        console.log('No interest to calculate - interest rate:', interestRate, 'payments:', projectData.payments.length);
        return;
      }
      
      console.log('Calculating interest with rate:', interestRate);
      console.log('Number of payments:', projectData.payments.length);
      
      // Use simpler direct calculation method
      const interestPayments = calculateSimpleInterest();
      
      // If no interest payments were generated, stop here
      if (interestPayments.length === 0) {
        return;
      }
      
      console.log('Generated interest payments:', interestPayments);
    
      // Simple approach: Remove ALL existing interest entries
      const nonInterestPayments = projectData.payments.filter(p => p.type !== 'interest');
      
      // Combine regular payments with new interest entries
      const updatedPayments = [...nonInterestPayments, ...interestPayments];
      
      // Update both local state and parent component
      setCurrentInterestDetails({
        newInterestPayments: interestPayments,
        allPaymentsWithInterest: updatedPayments,
        finalBalance: updatedPayments.reduce((sum, p) => sum + p.amount, 0)
      });
    
    // Save to parent component state so it persists between tabs
    updatePayments(updatedPayments);
    
    toast({
      title: 'Interest Calculated',
      description: `${interestPayments.length} interest entries created. All data saved.`,
    });
    console.log('Interest calculation complete with', interestPayments.length, 'new entries');
    console.log('-------- INTEREST CALCULATION FINISHED ---------');
  } catch (error) {
    console.error('Error in handleCalculateInterest:', error);
    toast({
      title: 'Error',
      description: 'An unexpected error occurred during interest calculation.',
    });
  }
  }, [projectData.payments, interestRate, projectEndDate, toast, updatePayments]);
  
  // Get all payments with interest for analysis - simplified to use parent component state
  const allPaymentsWithInterest = useMemo(() => {
    return projectData.payments;
  }, [projectData.payments]);

  const allEntriesForTable: Payment[] = useMemo(() => {
    const principalPaymentsMapped: Payment[] = projectData.payments.map((p: Payment): Payment => ({
      ...p,
      id: p.id || `payment_${p.month}_${p.amount}_${Math.random()}`,
      date: p.date ? (typeof p.date === 'string' ? p.date : new Date(p.date).toISOString()) : monthToDate(p.month).toISOString(),
      type: p.type || 'payment',
    }));

    const interestPaymentsMapped: Payment[] = currentInterestDetails?.newInterestPayments.map((p: Payment): Payment => ({
      ...p,
      date: p.date ? (typeof p.date === 'string' ? p.date : new Date(p.date).toISOString()) : monthToDate(p.month).toISOString(),
    })) || [];

    const returnsMapped: Payment[] = projectData.rentalIncome.map((r: IncomeItem, i: number): Payment => ({
      id: r.id || `return_${i}_${r.month}_${r.amount}`,
      month: r.month,
      amount: r.amount,
      description: r.description || (r.type === 'sale' ? 'Property Sale' : 'Rental Income'),
      date: r.date ? (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString()) : monthToDate(r.month).toISOString(),
      type: 'return',
      debtFunded: undefined,
    }));

    return [...principalPaymentsMapped, ...interestPaymentsMapped, ...returnsMapped].sort((a, b) => {
      const dateA = new Date(a.date as string).getTime();
      const dateB = new Date(b.date as string).getTime();
      if (dateA === dateB) {
        const typeOrder = { payment: 1, interest: 2, return: 3 };
        return (typeOrder[a.type as keyof typeof typeOrder] || 99) - (typeOrder[b.type as keyof typeof typeOrder] || 99);
      }
      return dateA - dateB;
    });
  }, [projectData.payments, projectData.rentalIncome, currentInterestDetails?.newInterestPayments]);

  const allEntriesForCSV: Payment[] = useMemo(() => {
    const paymentsMapped: Payment[] = projectData.payments.map((p: Payment): Payment => ({
      ...p,
      id: p.id || `payment_${p.month}_${p.amount}_${Math.random()}`,
      date: p.date ? (typeof p.date === 'string' ? p.date : new Date(p.date).toISOString()) : monthToDate(p.month).toISOString(),
      type: p.type || 'payment', 
    }));

    const returnsMapped: Payment[] = projectData.rentalIncome.map((r: IncomeItem, i: number): Payment => ({
      id: r.id || `return_${i}_${r.month}_${r.amount}`,
      month: r.month,
      amount: r.amount,
      description: r.description || (r.type === 'sale' ? 'Property Sale' : 'Rental Income'),
      date: r.date ? (typeof r.date === 'string' ? r.date : new Date(r.date).toISOString()) : monthToDate(r.month).toISOString(),
      type: 'return',
      debtFunded: undefined, 
    }));

    return [...paymentsMapped, ...returnsMapped].sort((a, b) => {
      const dateA = new Date(a.date as string).getTime();
      const dateB = new Date(b.date as string).getTime();
      return dateA - dateB;
    });
  }, [projectData.payments, projectData.rentalIncome]);

  const handleCopyCSV = useCallback(async () => {
    try {
      const csvContent = exportToCsv(allEntriesForTable); 
      await navigator.clipboard.writeText(csvContent);
      
      toast({
        title: 'CSV Copied',
        description: 'Cash flow data has been copied to clipboard',
      });
    } catch (error) {
      console.error('Error copying CSV:', error);
      toast({
        title: 'Error',
        description: 'Failed to copy CSV to clipboard',
        variant: 'destructive',
      });
    }
  }, [allEntriesForTable, toast]);

  const startEditPayment = (id: string, payment: Payment) => {
    setEditingPayment(id);
    setEditValues(payment);
  };

  const cancelEdit = () => {
    setEditingPayment(null);
    setEditValues({});
  };
  
  const parseCashFlowData = async (csvText: string) => {
    try {
      if (!csvText.trim()) {
        toast({
          title: "Error",
          description: "No data provided",
          variant: "destructive",
        });
        return;
      }

      // Parse CSV data to array of entries
      const lines = csvText.trim().split('\n');
      const newPayments: Payment[] = [];
      const errors: string[] = [];
      
      // Check if first row is a header (contains 'date' or 'amount')
      const hasHeader = lines.length > 0 && 
        (lines[0].toLowerCase().includes('date') || 
         lines[0].toLowerCase().includes('amount') || 
         lines[0].toLowerCase().includes('description'));

      // Start from index 1 if we have a header row
      for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
        try {
          const line = lines[i].trim();
          if (!line) continue;
          
          // Skip potential header row anywhere in the data
          if (line.toLowerCase().includes('date,amount,description')) {
            console.log(`Skipping header row at line ${i + 1}`);
            continue;
          }

          const parts = line.split(',');
          if (parts.length < 3) {
            errors.push(`Line ${i + 1}: Not enough fields. Expected at least 3 fields.`);
            continue;
          }

          // Process date/month
          const dateStr = parts[0].trim();
          
          // Parse month directly from the date string
          // The parseDate function returns a month number, not a Date object
          const month = parseDate(dateStr);
          if (month <= 0) {
            errors.push(`Line ${i + 1}: Unable to parse date '${dateStr}'. Expected format: MMM-YYYY or similar.`);
            continue;
          }
          
          // Convert the month number to a proper Date object
          const entryDate = monthToDate(month);

          // Process amount with flexible currency parsing
          const amountStr = parts[1].trim();
          const amount = parseCurrencyAmount(amountStr);
          if (isNaN(amount)) {
            errors.push(`Line ${i + 1}: Invalid amount format '${amountStr}'. Expected a number with optional currency symbol.`);
            continue;
          }

          // Get description (3rd column)
          const description = parts[2].trim();

          // Detect payment type from description or 4th column (if present)
          let type: 'payment' | 'return' | 'interest' = 'payment';
          
          // Check 4th column for explicit type if present
          if (parts.length > 3 && parts[3].trim()) {
            const typeStr = parts[3].trim().toLowerCase();
            if (typeStr === 'payment' || typeStr === 'return' || typeStr === 'interest') {
              type = typeStr as 'payment' | 'return' | 'interest';
            }
          } 
          // Otherwise try to infer from description and amount
          else if ((description.toLowerCase().includes('rent') || 
                   description.toLowerCase().includes('income') ||
                   description.toLowerCase().includes('return') ||
                   description.toLowerCase().includes('sale')) || 
                  amount > 0) {
            type = 'return';
          }

          newPayments.push({
            id: `imported-${Date.now()}-${i}`,
            month,
            amount: type === 'payment' ? -Math.abs(amount) : Math.abs(amount),
            description,
            type,
            date: entryDate
          });
        } catch (lineError) {
          errors.push(`Line ${i + 1}: ${lineError instanceof Error ? lineError.message : 'Unknown error'}`);
        }
      }

      if (newPayments.length > 0) {
        // Combine with existing payments, avoiding duplicates
        const existingIds = projectData.payments.map(p => p.id);
        const existingHashes = projectData.payments.map(p => 
          `${p.month}-${p.amount}-${p.description}`
        );
        
        // Filter out any new payments that match existing ones
        const uniqueNewPayments = newPayments.filter(p => {
          const hash = `${p.month}-${p.amount}-${p.description}`;
          return !existingIds.includes(p.id) && !existingHashes.includes(hash);
        });
        
        const combinedPayments = [...projectData.payments, ...uniqueNewPayments];
        updatePayments(combinedPayments);

        // Save to Firestore
        try {
          const docId = await savePayments(newPayments, projectData.projectName);
          console.log('Saved payments to Firestore document:', docId);
          
          toast({
            title: "Success",
            description: `Imported ${newPayments.length} entries and saved to database${errors.length > 0 ? ` (with ${errors.length} errors)` : ''}`,
          });
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          toast({
            title: "Success with Warning",
            description: `Imported ${newPayments.length} entries but failed to save to database: ${firestoreError instanceof Error ? firestoreError.message : 'Unknown error'}`,
          });
        }

        setCsvData('');
      } else {
        toast({
          title: "Error",
          description: "No valid entries found in the imported data",
          variant: "destructive",
        });
      }

      if (errors.length > 0) {
        console.warn('CSV import errors:', errors);
      }
    } catch (error) {
      console.error('Error parsing CSV data:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse data",
        variant: "destructive",
      });
    }
  };

  const saveEdit = async () => {
    if (editingPayment === null) return;

    // Validate edit values
    if (!editValues.description || editValues.amount === undefined || editValues.amount === null) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Process date and month
    let date = editValues.date;
    let month = editValues.month;

    // Make sure we have consistent date and month
    if (date instanceof Date) {
      month = dateToMonth(date);
    } else if (typeof month === 'number') {
      date = monthToDate(month);
    }

    // Prepare updated payment
    const updatedPayment: Payment = {
      id: editingPayment,
      month,
      amount: editValues.type === 'payment' 
        ? -Math.abs(Number(editValues.amount)) 
        : Math.abs(Number(editValues.amount)),
      description: editValues.description,
      date,
      type: editValues.type,
    };

    // Update payments array
    const updatedPayments = projectData.payments.map(p => 
      p.id === editingPayment ? updatedPayment : p
    );
    updatePayments(updatedPayments);

    // Save to Firestore
    try {
      const docId = await saveSinglePayment(updatedPayment, projectData.projectName);
      console.log('Saved updated payment to Firestore document:', docId);
      
      toast({
        description: "Entry updated successfully and saved to database",
      });
    } catch (firestoreError) {
      console.error('Error saving to Firestore:', firestoreError);
      toast({
        description: "Entry updated successfully but failed to save to database",
      });
    }

    // Exit edit mode
    setEditingPayment(null);
    setEditValues({});
  };

  const handleSaveNew = async () => {
    if (!newPayment.description || newPayment.amount === undefined || newPayment.amount === null) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Create payment object
    const date = newPayment.date || new Date();
    const month = newPayment.month !== undefined ? newPayment.month : dateToMonth(date);
    
    const paymentToAdd: Payment = {
      id: `manual-${Date.now()}`,
      month,
      amount: newPayment.type === 'payment' ? -Math.abs(Number(newPayment.amount)) : Math.abs(Number(newPayment.amount)),
      description: newPayment.description,
      date,
      type: newPayment.type as 'payment' | 'return' | 'interest',
    };

    // Add to existing payments
    const updatedPayments = [...projectData.payments, paymentToAdd];
    updatePayments(updatedPayments);

    // Save to Firestore
    try {
      const docId = await saveSinglePayment(paymentToAdd, projectData.projectName);
      console.log('Saved payment to Firestore document:', docId);
      
      toast({
        title: "Success",
        description: "Entry added successfully and saved to database",
      });
    } catch (firestoreError) {
      console.error('Error saving to Firestore:', firestoreError);
      toast({
        description: "Entry added successfully but failed to save to database",
      });
    }

    // Reset form
    setNewPayment({
      month: dateToMonth(new Date()),
      amount: 0,
      description: '',
      date: new Date(),
      type: 'payment',
    });

    // Exit add mode
    setIsAddingNew(false);
  };

  const handleCancelNew = () => {
    setIsAddingNew(false);
    setNewPayment({
      month: dateToMonth(new Date()),
      amount: 0,
      description: '',
      date: new Date(),
      type: 'payment',
    });
  };

  const removePayment = (id: string) => {
    if (id.startsWith('return_')) {
      const returnIndex = parseInt(id.split('_')[1]);
      if (!isNaN(returnIndex) && returnIndex >= 0 && returnIndex < projectData.rentalIncome.length) {
        const updatedReturns = [...projectData.rentalIncome];
        updatedReturns.splice(returnIndex, 1);
        updateProjectData({ rentalIncome: updatedReturns });
      }
    } else {
      updatePayments(projectData.payments.filter(payment => payment.id !== id));
    }
  };

  const handleExportCSV = useCallback(async () => {
    try {
      const entries = allEntriesForTable.map(entry => ({
        ...entry,
        date: entry.date || monthToDate(entry.month).toISOString()
      }));
      
      const csvContent = exportToCsv(entries);
      
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(csvContent);
          toast({
            title: 'CSV Copied',
            description: 'Cash flow data has been copied to clipboard',
          });
          return; 
        } catch (clipboardError) {
          console.warn('Clipboard write failed, falling back to download:', clipboardError);
        }
      }
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', 'cash-flow-export.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: 'CSV Downloaded',
        description: 'Cash flow data has been downloaded as cash-flow-export.csv',
      });
      
    } catch (error) {
      console.error('Error in handleExportCSV:', error);
      toast({
        title: 'Export Error',
        description: 'Failed to export CSV. Please try again or contact support.',
        variant: 'destructive',
      });
    }
  }, [allEntriesForTable, toast]);

  // Save all project data to Firestore
  const saveAllToFirestore = async () => {
    try {
      // Save project metadata
      const projectId = await saveProjectData(projectData);
      console.log('Saved project data to Firestore:', projectId);
      
      // Save all payments
      const paymentsId = await savePayments(projectData.payments, projectId);
      console.log('Saved all payments to Firestore:', paymentsId);
      
      toast({
        title: 'Success',
        description: 'All project data saved to database',
      });
    } catch (error) {
      console.error('Error saving all data to Firestore:', error);
      toast({
        title: 'Error',
        description: 'Failed to save project data to database',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      {(!showOnlyAnalysis || (!showOnlyCashFlow && !showOnlyAnalysis)) && (
        <div className="space-y-3">
          <div className="flex justify-end items-center px-4 py-3">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportCSV}
                variant="outline"
                size="sm"
                className="h-8 gap-1 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
              >
                <Copy className="h-3.5 w-3.5" />
                Export CSV 
              </Button>
              <Button
                onClick={handleCalculateInterest}
                variant="outline"
                size="sm"
                className="h-8 gap-1 bg-purple-50 border-purple-200 hover:bg-purple-100 text-purple-700"
              >
                <Calculator className="h-3.5 w-3.5" />
                Calculate Interest
              </Button>
              <Button
                onClick={() => setIsImportOpen(true)}
                variant="outline"
                size="sm"
                className="h-8 gap-1 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700"
              >
                <Upload className="h-3.5 w-3.5" />
                Import CSV
              </Button>
              <Button
                onClick={saveAllToFirestore}
                variant="outline"
                size="sm"
                className="h-8 gap-1 bg-green-50 border-green-200 hover:bg-green-100 text-green-700"
              >
                <Save className="h-3.5 w-3.5" />
                Save to Database
              </Button>
              <Button
                onClick={fetchDataFromFirestoreManual}
                variant="outline"
                size="sm"
                className="h-8 gap-1 bg-blue-50 border-blue-200 hover:bg-blue-100 text-blue-700 ml-2"
                disabled={isFetching}
              >
                <Download className="h-3.5 w-3.5" />
                {isFetching ? "Loading..." : "Load from Database"}
              </Button>
              <Button
                onClick={() => setIsAddingNew(true)}
                variant="outline"
                size="sm"
                className="h-8 gap-1 ml-auto bg-primary-50 border-primary-200 hover:bg-primary-100 text-primary-700"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Entry
              </Button>
            </div>
          </div>

          <PaymentsTable
            payments={allEntriesForTable} 
            editingPayment={editingPayment}
            editValues={editValues}
            onStartEdit={startEditPayment}
            onSaveEdit={saveEdit}
            onCancelEdit={cancelEdit}
            onRemove={removePayment}
            setEditValues={setEditValues}
            formatCurrency={formatCurrency}
            formatNumber={formatNumber}
            monthToDate={monthToDate}
            dateToMonth={dateToMonth}
            isAddingNew={isAddingNew}
            newPayment={newPayment}
            setNewPayment={setNewPayment}
            onSaveNew={handleSaveNew}
            onCancelNew={handleCancelNew}
          />
        </div>
      )}

      {showOnlyAnalysis && (
        <div className="space-y-3">
          <CashFlowAnalysis 
            projectData={projectData} 
            allPaymentsWithInterest={allPaymentsWithInterest} 
            projectEndDate={projectEndDate}
          />
        </div>
      )}

      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsImportOpen(false)}>
          <div className="relative max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <Card className="border-blue-200 shadow-lg">
              <CardHeader className="pb-1 pt-3 px-4">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                    <ArrowUpDown className="w-4 h-4 text-blue-600" />
                    Import Cash Flow Data
                  </CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 w-7 p-0 rounded-full"
                    onClick={() => setIsImportOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-2">
                <div>
                  <Textarea
                    id="csvData"
                    value={csvData}
                    onChange={(e) => setCsvData(e.target.value)}
                    placeholder="May-2025,-₹1,460,461,On Booking (payment)\nJun-2026,₹25,000,Monthly Rent (return)"
                    rows={4}
                    className="font-mono text-xs mb-1 focus:border-blue-300"
                  />
                  <div className="text-xs text-gray-500 mb-2 flex items-center">
                    <span className="text-blue-500 mr-1">ⓘ</span>
                    <span>Negative amounts = payments, positive = returns</span>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button 
                    onClick={async () => {
                      await parseCashFlowData(csvData);
                      setIsImportOpen(false);
                    }} 
                    disabled={!csvData.trim()}
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 px-3 py-1 h-8 text-white"
                    type="button"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    Import Data
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsCashFlow;
