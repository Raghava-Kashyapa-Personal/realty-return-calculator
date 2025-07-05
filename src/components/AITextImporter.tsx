import React, { useState, useMemo } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Wand2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface AITextImporterProps {
  onImport: (csvData: string) => void;
  onClose: () => void;
}

const AITextImporter: React.FC<AITextImporterProps> = ({ onImport, onClose }) => {
  const [rawText, setRawText] = useState<string>('');
  const [csvResult, setCsvResult] = useState<string>('');
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const { toast } = useToast();

  const genAI = useMemo(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) {
      console.error('VITE_GOOGLE_API_KEY is not set in environment variables.');
      return null;
    }
    return new GoogleGenerativeAI(apiKey);
  }, []);

  const convertToCSV = async (): Promise<void> => {
    if (!rawText.trim()) {
      setError('Please enter some text to convert.');
      return;
    }

    if (!genAI) {
      const errorMsg = 'Google API key is not configured. Please set VITE_GOOGLE_API_KEY in your .env file and restart the server.';
      setError(errorMsg);
      toast({
        title: "Configuration Error",
        description: "Could not connect to the AI service.",
        variant: "destructive",
        duration: 5000,
      });
      return;
    }

    setIsConverting(true);
    setError('');
    
    try {
      // Use the confirmed working model
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      
      const prompt = `Convert the following financial transaction text to CSV format with exactly these headers: date,amount,description\n\nIMPORTANT RULES:\n1. Format all dates as YYYY-MM-DD (ISO 8601).\n2. All payment amounts MUST be NEGATIVE numbers (e.g., -250000 for a payment of 250,000).\n3. All income/return amounts must be POSITIVE numbers.\n4. Remove all currency symbols (like Rs.) and commas from amounts.\n5. The description should be clear and concise.\n6. If a date is ambiguous (e.g., 'May 2025'), use the first day of the month (e.g., '2025-05-01').\n7. ONLY return the raw CSV data, starting with the header row. Do not include any other text or explanations.\n\nText to convert:\n${rawText}`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const csvData = response.text().trim();
      
      const lines = csvData.split('\n').filter(line => line.trim());
      if (lines.length < 2 || !lines[0].toLowerCase().includes('date,amount,description')) {
        throw new Error('AI did not return a valid CSV with the required headers (date,amount,description).');
      }
      
      setCsvResult(csvData);
      toast({
        title: "Success!",
        description: `Converted text to CSV with ${lines.length - 1} transaction(s).`,
        duration: 3000,
      });
      
    } catch (err) {
      console.error('Error converting text to CSV:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to convert text: ${errorMessage}`);
      toast({
        title: "Conversion Failed",
        description: "The AI could not process the text. Please check the format and try again.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsConverting(false);
    }
  };

  const handleImport = (): void => {
    if (csvResult) {
      onImport(csvResult);
      toast({
        title: "Data Imported",
        description: "CSV data has been sent for import.",
        duration: 3000,
      });
      onClose();
    }
  };

  const clearAll = (): void => {
    setRawText('');
    setCsvResult('');
    setError('');
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="relative max-w-2xl w-full mx-4 bg-background rounded-lg shadow-xl" onClick={(e) => e.stopPropagation()}>
        <Card className="border-0">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" /> AI Text Importer
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground pt-2">
              Paste financial text below. The AI will convert it into a structured CSV format for easy import.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Example:\n- Paid Rs. 2,50,000 on May 15, 2024 for booking fees\n- Second installment of 1,50,000 rupees on July 2025\n- Received interest 25,000 on June 15, 2024"
              rows={8}
              className="font-mono text-sm"
            />
            
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Conversion Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={clearAll} disabled={isConverting}>
                Clear
              </Button>
              <Button 
                onClick={convertToCSV} 
                disabled={isConverting || !rawText.trim()}
                className="gap-2 w-40"
              >
                {isConverting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Converting...</span>
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    <span>Convert to CSV</span>
                  </>
                )}
              </Button>
            </div>
            
            {csvResult && (
              <div className="space-y-3 pt-4 border-t">
                 <h3 className="text-md font-semibold">Conversion Result</h3>
                <Textarea
                  value={csvResult}
                  readOnly
                  rows={8}
                  className="font-mono text-sm bg-muted"
                />
                <Button onClick={handleImport} className="w-full gap-2">
                  <Upload className="w-4 h-4" />
                  Use This Data & Import
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AITextImporter;
