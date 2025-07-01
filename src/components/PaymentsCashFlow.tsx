import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Payment, IncomeItem, ProjectData } from '@/types/project';
import { useToast } from '@/hooks/use-toast';
import { CashFlowAnalysis } from '@/components/CashFlowAnalysis';
import { PaymentsTable } from '@/components/payments/PaymentsTable';
import { Plus, ArrowUpDown, X, Upload, Copy, Calculator, Save, Database, Download, Wand2, Loader2 } from 'lucide-react';
import { exportToCsv } from '@/utils/csvExport';
import {
  formatCurrency,
  formatNumber,
  parseCurrencyAmount,
  parseDate,
  monthToDate,
  dateToMonth
} from '@/components/payments/utils';
import { calculateDerivedProjectEndDate } from '@/utils/projectDateUtils';
import { savePayments, saveSinglePayment, saveProjectData, fetchAllEntries, fetchSession, sanitizePaymentData } from '@/services/firestoreService';
import { db } from '@/firebaseConfig';
import { doc, setDoc } from 'firebase/firestore';
import { AITextImporter } from '@/components/AITextImporter';

// Collection name for payments
const PAYMENTS_COLLECTION = 'test'; // Using 'test' as specified in firestoreService.ts

interface PaymentsCashFlowProps {
  projectData: ProjectData;
  updateProjectData: (updates: Partial<ProjectData>) => void;
  updatePayments: (payments: Payment[]) => void;
  showOnlyCashFlow?: boolean;
  showOnlyAnalysis?: boolean;
  sessionId?: string;
}

const PaymentsCashFlow: React.FC<PaymentsCashFlowProps> = ({
  projectData,
  updateProjectData,
  updatePayments,
  showOnlyCashFlow = false,
  showOnlyAnalysis = false,
  sessionId
}) => {
  const [csvData, setCsvData] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingPayment, setEditingPayment] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAIImportOpen, setIsAIImportOpen] = useState(false);
  const [interestRate, setInterestRate] = useState<number>(projectData.annualInterestRate || 12);
  const [newPayment, setNewPayment] = useState<Partial<Payment>>({
    month: dateToMonth(new Date()),
    amount: 0,
    description: '',
    date: new Date(),
    type: 'payment',
  });
  const { toast } = useToast();

  const [currentInterestDetails, setCurrentInterestDetails] = useState<{ newInterestPayments: Payment[] } | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Reset interest details when core data changes
  useEffect(() => {
    setCurrentInterestDetails(null);
  }, [projectData.payments, projectData.rentalIncome, interestRate]);

  // Manual fetch function (used by Load from DB button)
  const fetchDataFromFirestoreManual = async () => {
    setIsFetching(true);
    try {
      console.log('Manually fetching all database entries');
      // If sessionId is provided, fetch only for that session
      const { entries } = await fetchAllEntries(100, sessionId);

      if (entries && entries.length > 0) {
        // Create a set of existing IDs to avoid duplicates
        const existingIds = new Set(projectData.payments.map(p => p.id));
        
        // Also create a set of content hashes to avoid duplicate content
        const existingContentHashes = new Set(projectData.payments.map(p => 
          `${p.month}-${p.amount}-${p.description || ''}`
        ));

        // Process entries with stable IDs and filter out duplicates
        const newPayments = entries
          .filter(entry => {
            const contentHash = `${entry.month}-${entry.amount}-${entry.description || ''}`;
            return (!entry.id || !existingIds.has(entry.id)) && !existingContentHashes.has(contentHash);
          })
          .map(entry => ({
            ...entry,
            id: entry.id || generateStableId(entry)
          }));

        if (newPayments.length > 0) {
          console.log('Adding entries from database:', newPayments.length);
          const combinedPayments = [...projectData.payments, ...newPayments];
          updatePayments(combinedPayments);
          toast({
            title: 'Data Loaded',
            description: `Loaded ${newPayments.length} new entries from the database.`
          });
        } else {
          toast({ title: 'No New Data', description: 'No new entries found in the database.' });
        }
      } else {
        toast({ title: 'No Data', description: 'No entries found in the database.' });
      }
    } catch (error) {
      console.error('Error fetching data from Firestore:', error);
      toast({ title: 'Error', description: 'Failed to fetch data from the database.', variant: 'destructive' });
    } finally {
      setIsFetching(false);
    }
  };

  // Track if we've already loaded data for this session to prevent infinite loops
  const [loadedSessions, setLoadedSessions] = useState<Set<string>>(new Set());

  // Generate a stable ID for a payment entry
  const generateStableId = (entry: Payment) => {
    const descriptionPart = entry.description ? entry.description.substring(0, 10) : 'no-desc';
    return `entry-${entry.month}-${entry.amount}-${descriptionPart}`.replace(/\s+/g, '-');
  };
  
  // Helper function to read a file as text
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file'));
        }
      };
      reader.onerror = (e) => {
        reject(new Error('File reading error'));
      };
      reader.readAsText(file);
    });
  };
  
  // Only fetch data for existing sessions
  const fetchDataFromFirestore = async () => {
    if (!sessionId) return;
    
    try {
      console.log(`Auto-fetching database entries for session: ${sessionId}`);
      const { entries } = await fetchAllEntries(50, sessionId);

      if (entries && entries.length > 0) {
        // Create a set of existing IDs to avoid duplicates
        const existingIds = new Set(projectData.payments.map(p => p.id));
        
        // Also create a set of content hashes to avoid duplicate content
        const existingContentHashes = new Set(projectData.payments.map(p => 
          `${p.month}-${p.amount}-${p.description || ''}`
        ));

        // Only add entries that don't already exist (by ID or content)
        const entriesWithIds = entries
          .filter(entry => {
            const contentHash = `${entry.month}-${entry.amount}-${entry.description || ''}`;
            return (!entry.id || !existingIds.has(entry.id)) && !existingContentHashes.has(contentHash);
          })
          .map(entry => ({
            ...entry,
            // Use a stable ID generation that doesn't rely on current timestamp
            id: entry.id || generateStableId(entry)
          }));

        if (entriesWithIds.length > 0) {
          // Combine with existing payments, avoiding duplicates
          updatePayments([...projectData.payments, ...entriesWithIds]);
          console.log(`Loaded ${entriesWithIds.length} new entries for session ${sessionId}`);
        } else {
          console.log('No new entries to add (all already exist)');
        }
      } else {
        console.log(`No entries found for session ${sessionId}`);
        // Don't clear existing payments if no entries are found
        // Only clear if this is the first load
        if (projectData.payments.length === 0) {
          updatePayments([]);
        }
      }
    } catch (error) {
      console.error('Error auto-fetching data from Firestore:', error);
      // On error, don't clear existing data
    }
  };

  // Auto-load data when sessionId changes, but only once per session
  useEffect(() => {
    if (!sessionId) return;

    // Check if this is a new session that should start empty
    const isNewSession = sessionId.includes('new-') ||
                         sessionStorage.getItem(`session-${sessionId}-is-new`) === 'true' ||
                         sessionId.startsWith('session-') && sessionId.includes('new');

    if (isNewSession) {
      console.log('New session detected, starting with empty payments');
      // Clear any existing payments for new sessions
      updatePayments([]);
      sessionStorage.setItem(`session-${sessionId}-is-new`, 'false');
      return;
    }
    
    // Only fetch if we haven't loaded this session yet
    if (!loadedSessions.has(sessionId)) {
      fetchDataFromFirestore();
      // Mark this session as loaded to prevent infinite loops
      setLoadedSessions(prev => new Set([...prev, sessionId]));
    }
  }, [sessionId, projectData.payments, loadedSessions]);

  // Add listener for session refresh events
  useEffect(() => {
    const handleSessionRefresh = () => {
      if (!sessionId) {
        toast({ title: 'No Session', description: 'Please select a session first.', variant: 'destructive' });
        return;
      }
      console.log('Session refresh event received, reloading data');
      
      // Force reload data for current session
      const fetchLatestData = async () => {
        setIsFetching(true);
        try {
          const { entries } = await fetchSession(sessionId);
          
          if (entries && entries.length > 0) {
            // Process entries with stable IDs
            const processedEntries = entries.map(entry => ({
              ...entry,
              // Use our stable ID generation helper
              id: entry.id || generateStableId(entry)
            }));
            
            // Replace all payments with the refreshed data
            updatePayments(processedEntries);
            toast({ title: 'Data Refreshed', description: `Loaded ${entries.length} entries from session ${sessionId}` });
            
            // Update the loaded sessions set to include this session
            setLoadedSessions(prev => new Set([...prev, sessionId]));
          } else {
            toast({ title: 'No Data', description: 'No entries found for this session.' });
            // Clear payments on explicit refresh if no data found
            updatePayments([]);
          }
        } catch (error) {
          console.error('Error refreshing session data:', error);
          toast({ title: 'Error', description: 'Failed to refresh session data.', variant: 'destructive' });
        } finally {
          setIsFetching(false);
        }
      };
      
      fetchLatestData();
    };
    
    window.addEventListener('refresh-sessions', handleSessionRefresh);
    return () => window.removeEventListener('refresh-sessions', handleSessionRefresh);
  }, [sessionId, updatePayments]);

  const projectEndDate = useMemo(() => {
    const allNonInterestEntries = [
      ...projectData.payments.map(p => ({ ...p, date: p.date ? new Date(p.date) : monthToDate(p.month) })),
      ...projectData.rentalIncome.map(r => ({ ...r, date: r.date ? new Date(r.date) : monthToDate(r.month) }))
    ];
    return calculateDerivedProjectEndDate(allNonInterestEntries as Payment[]);
  }, [projectData.payments, projectData.rentalIncome]);

  const calculateSimpleInterest = () => {
    const paymentEntries = projectData.payments
      .filter(p => p.amount < 0 && p.type !== 'interest')
      .sort((a, b) => {
        const dateA = new Date(a.date || monthToDate(a.month));
        const dateB = new Date(b.date || monthToDate(b.month));
        return dateA.getTime() - dateB.getTime();
      });

    if (paymentEntries.length === 0) {
      toast({ title: 'No Payments Found', description: 'Interest can only be calculated on payment entries.' });
      return [];
    }
    
    // Initialize lastDate with the first payment's date to handle past entries correctly
    let lastDate = new Date(paymentEntries[0].date || monthToDate(paymentEntries[0].month));
    let balance = 0;
    const interestPayments: Payment[] = [];

    for (const payment of paymentEntries) {
      const paymentDate = new Date(payment.date || monthToDate(payment.month));
      balance += Math.abs(payment.amount);
      if (paymentDate > lastDate) {
        lastDate = paymentDate;
      }
    }

    const monthlyRate = interestRate / 100 / 12;
    let currentDate = new Date(lastDate);
    for (let i = 0; i < 6; i++) {
      currentDate.setMonth(currentDate.getMonth() + 1);
      const monthlyInterest = balance * monthlyRate;
      if (monthlyInterest <= 0) continue;

      const prevBalance = balance;
      balance += monthlyInterest;

      interestPayments.push({
        id: `interest_${currentDate.getTime()}`,
        amount: -monthlyInterest,
        date: new Date(currentDate),
        month: dateToMonth(currentDate),
        description: `Interest @ ${interestRate}% on balance ₹${Math.round(prevBalance).toLocaleString('en-IN')}`,
        type: 'interest'
      });
    }
    return interestPayments;
  };

  const handleCalculateInterest = useCallback(() => {
    try {
      if (interestRate <= 0) {
        toast({ title: 'No Interest to Calculate', description: 'Please set an interest rate greater than 0.' });
        return;
      }

      const interestPayments = calculateSimpleInterest();
      if (interestPayments.length === 0) return;

      const nonInterestPayments = projectData.payments.filter(p => p.type !== 'interest');
      const updatedPayments = [...nonInterestPayments, ...interestPayments];
    
      setCurrentInterestDetails({ newInterestPayments: interestPayments });
      updatePayments(updatedPayments);

      toast({
        title: 'Interest Calculated',
        description: `${interestPayments.length} interest entries were created or updated.`
      });
    } catch (error) {
      console.error('Error in handleCalculateInterest:', error);
      toast({ title: 'Error', description: 'An unexpected error occurred during interest calculation.', variant: 'destructive' });
    }
  }, [projectData.payments, interestRate, toast, updatePayments]);

  const allPaymentsWithInterest = useMemo(() => projectData.payments, [projectData.payments]);

  const allEntriesForTable: Payment[] = useMemo(() => {
    // `projectData.payments` is the single source of truth and already contains interest payments after calculation
    const principalAndInterestMapped: Payment[] = projectData.payments.map((p): Payment => ({
      ...p,
      id: p.id || `payment_${p.month}_${p.amount}_${Math.random()}`,
      date: p.date ? new Date(p.date).toISOString() : monthToDate(p.month).toISOString(),
      type: p.type || 'payment',
    }));

    const returnsMapped: Payment[] = projectData.rentalIncome.map((r, i): Payment => ({
      id: r.id || `return_${i}_${r.month}_${r.amount}`,
      month: r.month,
      amount: r.amount,
      description: r.description || (r.type === 'sale' ? 'Property Sale' : 'Rental Income'),
      date: r.date ? new Date(r.date).toISOString() : monthToDate(r.month).toISOString(),
      type: 'return',
    }));

    return [...principalAndInterestMapped, ...returnsMapped].sort((a, b) => {
      const dateA = new Date(a.date as string).getTime();
      const dateB = new Date(b.date as string).getTime();
      if (dateA === dateB) {
        const typeOrder = { payment: 1, interest: 2, return: 3 };
        return (typeOrder[a.type as keyof typeof typeOrder] || 99) - (typeOrder[b.type as keyof typeof typeOrder] || 99);
      }
      return dateA - dateB;
    });
  }, [projectData.payments, projectData.rentalIncome]);

  const handleExportCSV = useCallback(async () => {
    try {
      const csvContent = exportToCsv(allEntriesForTable);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(csvContent);
        toast({ title: 'CSV Copied', description: 'Cash flow data copied to clipboard.' });
      } else {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'cash-flow-export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast({ title: 'CSV Downloaded', description: 'Cash flow data has been downloaded.' });
      }
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast({ title: 'Export Error', description: 'Failed to export CSV data.', variant: 'destructive' });
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
    if (!csvText.trim()) {
      toast({ title: "Error", description: "No data provided.", variant: "destructive" });
      return;
    }

    const lines = csvText.trim().split('\n');
    const newPayments: Payment[] = [];
    const errors: string[] = [];
    const headerTest = lines[0]?.toLowerCase() || '';
    const hasHeader = headerTest.includes('date') || headerTest.includes('amount');

    for (let i = hasHeader ? 1 : 0; i < lines.length; i++) {
      try {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Skip potential header row anywhere in the data
        if (line.toLowerCase().includes('date,amount,description')) {
          console.log(`Skipping header row at line ${i + 1}`);
          continue;
        }
        
        // Robustly parse CSV lines where amounts may contain commas
        // Assumes format: Date, [Amount parts...], Description
        const parts = line.split(',');
        if (parts.length < 3) {
          errors.push(`Line ${i + 1}: Malformed line. Expected: Date,Amount,Description`);
          continue;
        }

        const dateStr = parts[0].trim();
        const description = parts[parts.length - 1].trim();
        const amountStr = parts.slice(1, -1).join('').trim();

        const month = parseDate(dateStr);
        if (month <= 0) {
          errors.push(`Line ${i + 1}: Could not parse date '${dateStr}'.`);
          continue;
        }
        const entryDate = monthToDate(month);

        const amount = parseCurrencyAmount(amountStr);
        if (isNaN(amount)) {
          errors.push(`Line ${i + 1}: Invalid amount format '${amountStr}'.`);
          continue;
        }

        let type: 'payment' | 'return' | 'interest' = 'payment';
        if (amount > 0 || ['rent', 'income', 'return', 'sale'].some(term => description.toLowerCase().includes(term))) {
          type = 'return';
        }

        const paymentEntry: Payment = {
          id: '', // Temporary ID, will be replaced
          month,
          amount: type === 'payment' ? -Math.abs(amount) : Math.abs(amount),
          description,
          type,
          date: entryDate
        };
        
        // Use our consistent ID generation helper
        paymentEntry.id = generateStableId(paymentEntry);
        
        newPayments.push({
          ...paymentEntry,
          month,
          amount: type === 'payment' ? -Math.abs(amount) : Math.abs(amount),
          description,
          type,
          date: entryDate
        });
      } catch (lineError) {
        errors.push(`Line ${i + 1}: ${(lineError as Error).message}`);
      }
    }

    if (errors.length > 0) {
      console.warn('CSV import errors:', errors);
      toast({ title: "Import Warning", description: `Encountered ${errors.length} errors during import.`, variant: "destructive" });
    }

    if (newPayments.length > 0) {
      // Create a hash of existing payments to avoid duplicates
      const existingHashes = new Set(projectData.payments.map(p => `${p.month}-${p.amount}-${p.description}`));
      const uniqueNewPayments = newPayments.filter(p => !existingHashes.has(`${p.month}-${p.amount}-${p.description}`));

      if (uniqueNewPayments.length === 0) {
        toast({ title: "No New Data", description: "All entries already exist in the current session." });
        return;
      }

      // Update UI with new payments
      updatePayments([...projectData.payments, ...uniqueNewPayments]);
      
      // Save to Firestore if we have a session ID
      if (sessionId) {
        try {
          await savePayments(uniqueNewPayments, sessionId);
          toast({ title: "Success", description: `Imported ${uniqueNewPayments.length} new entries and saved to the database.` });
          
          // Trigger refresh for other components
          window.dispatchEvent(new CustomEvent('refresh-sessions'));
        } catch (firestoreError) {
          console.error('Error saving to Firestore:', firestoreError);
          toast({ title: "Import Warning", description: "Entries imported but failed to save to the database.", variant: "destructive" });
        }
      } else {
        toast({ title: "Success", description: `Imported ${uniqueNewPayments.length} new entries. No session selected for saving.` });
      }
      
      setCsvData('');
    } else if (errors.length === 0) {
      toast({ title: "No New Data", description: "No new or valid entries were found in the imported data." });
    }
  };

  const saveEdit = async () => {
    if (editingPayment === null) return;
    if (!editValues.description || editValues.amount == null) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const date = editValues.date instanceof Date ? editValues.date : 
                (typeof editValues.date === 'string' ? new Date(editValues.date) : monthToDate(editValues.month));
    
    const updatedPayment: Payment = {
      ...editValues,
      id: editingPayment, // Keep the original ID to ensure we're updating, not creating
      date,
      month: dateToMonth(date),
      amount: editValues.type === 'payment' ? -Math.abs(Number(editValues.amount)) : Math.abs(Number(editValues.amount)),
    };

    // Update the payment in the local state
    const updatedPayments = projectData.payments.map(p => p.id === editingPayment ? updatedPayment : p);
    updatePayments(updatedPayments);

    // Save to Firestore if we have a session ID
    if (sessionId) {
      try {
        // Find today's document and update the specific payment within it
        const { entries } = await fetchSession(sessionId);
        
        // Find and replace the payment with matching ID
        const updatedEntries = entries.map(entry => 
          entry.id === editingPayment ? sanitizePaymentData(updatedPayment) : entry
        );
        
        // Save the updated entries back to Firestore
        await savePayments(updatedEntries, sessionId);
        
        toast({ description: "Entry updated and saved to the database." });
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        toast({ description: "Entry updated but failed to save to the database.", variant: "destructive" });
      }
    } else {
      toast({ description: "Entry updated. No session selected for saving." });
    }

    cancelEdit();
  };

  const handleSaveNew = async () => {
    if (!newPayment.description || newPayment.amount == null) {
      toast({ title: "Missing Information", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    const dateObj = newPayment.date instanceof Date ? newPayment.date : 
                   (typeof newPayment.date === 'string' ? new Date(newPayment.date) : new Date());
    
    const paymentToAdd: Payment = {
      id: '', // Temporary ID, will be replaced
      month: dateToMonth(dateObj),
      amount: newPayment.type === 'payment' ? -Math.abs(Number(newPayment.amount)) : Math.abs(Number(newPayment.amount)),
      description: newPayment.description,
      date: dateObj,
      type: newPayment.type as 'payment' | 'return',
    };
    
    // Use our consistent ID generation helper
    paymentToAdd.id = generateStableId(paymentToAdd);

    // Update UI with new payment
    updatePayments([...projectData.payments, paymentToAdd]);

    // Save to Firestore if we have a session ID
    if (sessionId) {
      try {
        await saveSinglePayment(paymentToAdd, sessionId);
        toast({ title: "Success", description: "Entry added and saved to the database." });
        
        // Trigger refresh for other components
        window.dispatchEvent(new CustomEvent('refresh-sessions'));
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        toast({ title: "Warning", description: "Entry added but failed to save to the database.", variant: "destructive" });
      }
    } else {
      toast({ title: "Success", description: "Entry added. No session selected for saving." });
    }

    // Reset form and close
    handleCancelNew();
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

  const removePayment = async (id: string) => {
    if (id.startsWith('return_')) {
      const returnIndex = parseInt(id.split('_')[1], 10);
      if (!isNaN(returnIndex)) {
        const updatedReturns = projectData.rentalIncome.filter((_, index) => index !== returnIndex);
        updateProjectData({ rentalIncome: updatedReturns });
      }
    } else {
      // Update local state by removing the payment
      updatePayments(projectData.payments.filter(payment => payment.id !== id));
      
      // Remove from Firestore if we have a session ID
      if (sessionId) {
        try {
          // Fetch the current entries
          const { entries } = await fetchSession(sessionId);
          
          // Filter out the payment with the matching ID
          const updatedEntries = entries.filter(entry => entry.id !== id);
          
          // Process entries to ensure they all have stable IDs before saving
          const processedEntries = updatedEntries.map(entry => ({
            ...entry,
            id: entry.id || generateStableId(entry)
          }));
          
          // Save the updated entries back to Firestore, replacing the entire document
          // This prevents the duplication issue
          await setDoc(doc(db, PAYMENTS_COLLECTION, sessionId), {
            entries: processedEntries,
            updatedAt: new Date(),
            count: processedEntries.length,
            sessionId: sessionId
          });
          
          toast({ description: "Entry deleted from database." });
        } catch (error) {
          console.error(`Error removing payment ${id} from Firestore:`, error);
          toast({ 
            title: "Error", 
            description: "Failed to delete entry from database. It was removed locally only.", 
            variant: "destructive" 
          });
        }
      }
    }
  };

  const saveAllToFirestore = async () => {
    if (!sessionId) {
      toast({ title: 'No Session Selected', description: 'Please select or create a session first.', variant: 'destructive' });
      return;
    }
    
    try {
      await saveProjectData(projectData, sessionId);
      await savePayments(projectData.payments, sessionId);
      toast({ title: 'Data Saved', description: `All project data saved to session: ${sessionId}` });
      
      // Trigger refresh for other components
      window.dispatchEvent(new CustomEvent('refresh-sessions'));
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      toast({ title: 'Error', description: 'Failed to save data to the database.', variant: 'destructive' });
    }
  };

  // Return the JSX for the component
  return (
    <div className="space-y-4">
      {!showOnlyAnalysis && (
        <div className="space-y-3">
          <div className="flex flex-wrap justify-end items-center gap-2 px-4 py-3">
            <Button onClick={handleExportCSV} variant="outline" size="sm" className="h-8 gap-1">
              <Copy className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button onClick={handleCalculateInterest} variant="outline" size="sm" className="h-8 gap-1">
              <Calculator className="h-3.5 w-3.5" /> Calculate Interest
            </Button>
            <Button onClick={() => setIsImportOpen(true)} variant="outline" size="sm" className="h-8 gap-1">
              <Upload className="h-3.5 w-3.5" /> Import CSV
            </Button>
            <Button onClick={() => setIsAIImportOpen(true)} variant="outline" size="sm" className="h-8 gap-1">
              <Wand2 className="h-3.5 w-3.5" /> AI Import
            </Button>
            <Button onClick={saveAllToFirestore} variant="outline" size="sm" className="h-8 gap-1">
              <Save className="h-3.5 w-3.5" /> Save All
            </Button>
            <Button onClick={fetchDataFromFirestoreManual} variant="outline" size="sm" className="h-8 gap-1" disabled={isFetching}>
              <Database className="h-3.5 w-3.5" /> {isFetching ? "Loading..." : "Load from DB"}
            </Button>
            <Button onClick={() => setIsAddingNew(true)} size="sm" className="h-8 gap-1">
              <Plus className="h-3.5 w-3.5" /> Add Entry
            </Button>
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
        <CashFlowAnalysis
          projectData={projectData}
          allPaymentsWithInterest={allPaymentsWithInterest}
          projectEndDate={projectEndDate}
        />
      )}
      {isImportOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setIsImportOpen(false)}>
          <div className="relative max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="w-5 h-5" /> Import Cash Flow Data
                  </CardTitle>
                  <Button variant="ghost" size="sm" className="p-0 h-7 w-7" onClick={() => setIsImportOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="csv-file">Select a CSV file</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setCsvFile(file);
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Format: Date,Amount,Description<br/>
                    Example: May-2025,-146000,Booking Payment<br/>
                    Example: Jun-2026,25000,Monthly Rent
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={async () => {
                      if (csvFile) {
                        setIsUploading(true);
                        try {
                          const text = await readFileAsText(csvFile);
                          await parseCashFlowData(text);
                          setIsImportOpen(false);
                          setCsvFile(null);
                        } catch (error) {
                          console.error('Error reading CSV file:', error);
                          toast({ 
                            title: "Error", 
                            description: "Failed to read CSV file. Please check the file format.", 
                            variant: "destructive" 
                          });
                        } finally {
                          setIsUploading(false);
                        }
                      }
                    }}
                    disabled={!csvFile || isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" /> Import Data
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
      
      {isAIImportOpen && (
        <AITextImporter 
          onImport={async (csvData) => {
            await parseCashFlowData(csvData);
            setIsAIImportOpen(false);
          }}
          onClose={() => setIsAIImportOpen(false)}
        />
      )}
    </div>
  );
};

export default PaymentsCashFlow;
