import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Payment } from '@/types/project';

interface FirestoreCSVImporterProps {
  collectionName?: string;
  onImportSuccess?: (docId: string) => void;
}

interface CSVEntry {
  date: string;
  amount: number;
  description: string;
  type?: string;
  month?: number;
}

const FirestoreCSVImporter: React.FC<FirestoreCSVImporterProps> = ({ 
  collectionName = 'test',
  onImportSuccess
}) => {
  const [csvData, setCsvData] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [todayDocData, setTodayDocData] = useState<any>(null);
  const [todayDocId, setTodayDocId] = useState<string>('');
  const { toast } = useToast();

  // Get today's document ID in YYYY-MM-DD format
  const getTodayDocId = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  };

  // Check if there's an existing document for today
  useEffect(() => {
    const fetchTodayDocument = async () => {
      try {
        const today = getTodayDocId();
        setTodayDocId(today);
        
        const docRef = doc(db, collectionName, today);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setTodayDocData(docSnap.data());
          toast({
            title: 'Document Found',
            description: `Found existing data for today (${today}) with ${docSnap.data().count} entries`,
          });
        } else {
          setTodayDocData(null);
        }
      } catch (error) {
        console.error('Error checking today\'s document:', error);
      }
    };

    fetchTodayDocument();
  }, [collectionName, toast]);

  const parseCsvAndStore = async () => {
    if (!csvData.trim()) {
      toast({
        title: 'Empty Input',
        description: 'Please enter CSV data to import',
        variant: 'destructive',
      });
      return;
    }
    
    // Check for internet connectivity first
    if (!navigator.onLine) {
      toast({
        title: 'Network Error',
        description: 'You appear to be offline. Please check your internet connection and try again.',
        variant: 'destructive',
      });
      return;
    }

    setIsProcessing(true);
    const lines = csvData.trim().split('\n');
    const entries: CSVEntry[] = [];
    const errors: string[] = [];

    try {
      // Parse CSV lines
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length < 3) {
          errors.push(`Line ${i + 1}: Not enough columns. Expected at least 3 columns.`);
          continue;
        }

        // Extract data from CSV line
        let dateStr = parts[0].trim();
        let amountStr = parts[1].trim();
        let description = parts[2].trim();
        let type = parts.length > 3 ? parts[3].trim() : 'payment';

        // Parse amount: Handle formats like -₹1,460,461 or ₹25,000
        let amount = 0;
        try {
          // Remove currency symbol and commas
          amountStr = amountStr.replace(/[₹,]/g, '');
          amount = parseFloat(amountStr);

          // If the amount string had a negative sign, keep it negative
          if (amountStr.includes('-')) {
            amount = -Math.abs(amount);
          }
        } catch (err) {
          errors.push(`Line ${i + 1}: Invalid amount format '${parts[1]}'`);
          continue;
        }

        // Attempt to parse date in various formats
        let month: number | undefined = undefined;
        try {
          // If format is like "May-2025"
          if (/[A-Za-z]+-\d{4}/.test(dateStr)) {
            const [monthStr, yearStr] = dateStr.split('-');
            const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
            const monthIndex = monthNames.findIndex(m => 
              monthStr.toLowerCase().startsWith(m.toLowerCase())
            );
            
            if (monthIndex !== -1) {
              const year = parseInt(yearStr);
              // Calculate months since project start (assuming Jan 2023 as month 0)
              const baseYear = 2023;
              month = (year - baseYear) * 12 + monthIndex;
            }
          }
          // For other date formats, we'll keep the string representation
        } catch (err) {
          // If date parsing fails, just keep the string representation
          console.warn(`Warning: Could not parse month from date ${dateStr}`);
        }

        entries.push({
          date: dateStr,
          amount,
          description,
          type,
          month
        });
      }

      // Store valid entries in Firestore
      if (entries.length > 0) {
        // Use today's document ID
        const documentId = todayDocId || getTodayDocId();
        const currentDate = new Date();
        
        // Reference to the document
        const entriesCollectionRef = collection(db, collectionName);
        const docRef = doc(entriesCollectionRef, documentId);
        
        // Sanitize entries to remove any undefined values (Firestore doesn't accept undefined)
        const sanitizedEntries = entries.map(entry => {
          // Create a new object with only defined values
          const sanitized: any = {};
          
          // Only add properties that are not undefined
          if (entry.date !== undefined) sanitized.date = entry.date;
          if (entry.amount !== undefined) sanitized.amount = entry.amount;
          if (entry.description !== undefined) sanitized.description = entry.description;
          if (entry.type !== undefined) sanitized.type = entry.type;
          if (entry.month !== undefined) sanitized.month = entry.month;
          
          return sanitized;
        });
        
        // Prepare the data to store
        let newDocData: any = {};
        
        if (todayDocData) {
          // If document exists, merge the new entries with existing ones
          const existingEntries = todayDocData.entries || [];
          // Sanitize existing entries too, just in case
          const sanitizedExistingEntries = existingEntries.map((entry: any) => {
            const sanitized: any = {};
            Object.keys(entry).forEach(key => {
              if (entry[key] !== undefined) sanitized[key] = entry[key];
            });
            return sanitized;
          });
          
          newDocData = {
            entries: [...sanitizedExistingEntries, ...sanitizedEntries],
            importedAt: Timestamp.fromDate(currentDate),
            lastUpdatedAt: Timestamp.fromDate(currentDate),
            count: (sanitizedExistingEntries.length + sanitizedEntries.length),
            hasErrors: errors.length > 0
          };
          
          // Only add errors if there are any
          if (errors.length > 0) {
            newDocData.errors = errors;
          }
        } else {
          // If document doesn't exist, create a new one
          newDocData = {
            entries: sanitizedEntries,
            importedAt: Timestamp.fromDate(currentDate),
            lastUpdatedAt: Timestamp.fromDate(currentDate),
            count: sanitizedEntries.length,
            hasErrors: errors.length > 0
          };
          
          // Only add errors if there are any
          if (errors.length > 0) {
            newDocData.errors = errors;
          }
        }
        
        // Write to Firestore
        console.log('Saving to Firestore collection:', collectionName, 'with document ID:', documentId);
        console.log('Document data:', newDocData);
        await setDoc(docRef, newDocData);
        console.log('Successfully saved to Firestore');
        
        // Update local state
        setTodayDocData(newDocData);
        
        // Call the success callback if provided
        if (onImportSuccess) {
          onImportSuccess(documentId);
        }

        setCsvData('');
        toast({
          title: 'Import Successful',
          description: todayDocData 
            ? `${entries.length} new entries added to today's document (total: ${newDocData.count})` 
            : `${entries.length} entries imported to Firestore with document ID: ${documentId}`,
        });
      } else if (errors.length > 0) {
        toast({
          title: 'Import Failed',
          description: 'No valid entries found. Please check the format of your CSV data.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error importing to Firestore:', error);
      
      // Handle specific Firestore errors
      let errorMessage = 'An unknown error occurred';
      
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Handle specific network errors
        if (errorMessage.includes('network') || 
            errorMessage.includes('internet') || 
            errorMessage.includes('disconnected') ||
            errorMessage.includes('offline')) {
          errorMessage = 'Network connection error. Please check your internet connection and try again.';
        }
        
        // Handle specific Firestore errors
        if (errorMessage.includes('invalid data') || errorMessage.includes('Unsupported field value')) {
          errorMessage = 'Invalid data format. Please check your CSV data and try again. Firestore does not accept undefined values.';
        }
      }
      
      toast({
        title: 'Import Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border-green-200 shadow-sm">
      <CardHeader className="pb-1 pt-3 px-4">
        <CardTitle className="text-sm font-medium flex items-center gap-1.5">
          <Save className="w-4 h-4 text-green-600" />
          Import to Firestore
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        <div>
          <Textarea
            id="firestoreCsvData"
            value={csvData}
            onChange={(e) => setCsvData(e.target.value)}
            placeholder="May-2025,-₹1,460,461,On Booking (payment)
Jun-2026,₹25,000,Monthly Rent (return)"
            rows={5}
            className="font-mono text-xs mb-1 focus:border-green-300"
          />
          <div className="text-xs text-gray-500 mb-2 flex items-center">
            <span className="text-green-500 mr-1">ⓘ</span> 
            <span>Format: Date,Amount,Description,Type(optional)</span>
          </div>
          {todayDocData && (
            <div className="text-xs bg-green-50 p-2 rounded border border-green-200 mt-1 mb-2">
              <span className="font-medium text-green-700">Today's document found:</span> {todayDocId} 
              <span className="ml-1 text-gray-600">
                ({todayDocData.count} existing entries)
              </span>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <Button 
            onClick={parseCsvAndStore} 
            disabled={!csvData.trim() || isProcessing}
            size="sm"
            className="bg-green-600 hover:bg-green-700 px-3 py-1 h-8"
            type="button"
          >
            {isProcessing ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </span>
            ) : (
              <>
                <Upload className="w-3.5 h-3.5 mr-1.5" />
                Save to Firestore
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FirestoreCSVImporter;
