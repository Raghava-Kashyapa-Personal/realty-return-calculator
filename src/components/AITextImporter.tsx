import React, { useState } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AITextImporterProps {
  onImport: (csvData: string) => void;
  onClose: () => void;
}

// Initialize the Google Generative AI with your API key
// You can add your API key here for testing, but make sure to move it to .env before committing
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || 'AIzaSyCMnwnm5V9wBbNqTj5Vs8PePx2ddsSqHpI';
const genAI = new GoogleGenerativeAI(API_KEY);

export const AITextImporter: React.FC<AITextImporterProps> = ({ onImport, onClose }) => {
  const [rawText, setRawText] = useState('');
  const [csvResult, setCsvResult] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Function to convert text to CSV format using Google's Generative AI (Gemini)
  const convertToCSV = async () => {
    if (!rawText.trim()) {
      toast({ title: "Error", description: "Please enter some text to convert.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      // Create a prompt for the Gemini model
      const prompt = `
        Convert the following text into a CSV format with three columns: date, amount, description.
        
        Rules:
        1. The first line should be the header: date,amount,description
        2. Dates should be in the format Month-Year (e.g., May-2025) or keep the original format if it's already a date
        3. Amounts should be numbers only (no currency symbols or commas)
        4. For payments/expenses, make the amount negative (add a minus sign)
        5. For income/returns, keep the amount positive
        6. The description should be a brief explanation of the payment or income
        
        Here's the text to convert:
        ${rawText}
        
        Return ONLY the CSV data, nothing else. No explanations or additional text.
      `;
      
      try {
        console.log('Using API Key:', API_KEY ? 'API key is set' : 'No API key');
        // Call the Gemini API
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log('Model created successfully');
        const result = await model.generateContent(prompt);
        console.log('Content generated successfully');
        const response = result.response;
        const text = response.text();
        
        // Check if the response starts with the header
        if (text.trim().startsWith('date,amount,description')) {
          setCsvResult(text.trim());
        } else {
          // If the model didn't format it correctly, add the header
          setCsvResult('date,amount,description\n' + text.trim());
        }
        
        toast({ title: "Success", description: "Text converted to CSV format using AI." });
      } catch (aiError) {
        console.error('Error calling Gemini API:', aiError);
        
        // Fallback to rule-based parsing if API call fails
        toast({ 
          title: "AI Service Unavailable", 
          description: "Using fallback parser instead. Check your API key configuration.",
          variant: "destructive"
        });
        
        // Rule-based fallback parser
        const lines = rawText.split('\n').filter(line => line.trim());
        const csvLines = ['date,amount,description'];
        
        for (const line of lines) {
          // Try to extract date patterns (Month-Year or MM/DD/YYYY)
          const datePattern = /(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[-\s]20\d{2}\b)|(?:\d{1,2}\/\d{1,2}\/\d{2,4})/i;
          const dateMatch = line.match(datePattern);
          
          // Try to extract amount patterns (numbers with optional commas, decimal points, and currency symbols)
          const amountPattern = /(?:[-+]?\s*(?:Rs\.?|INR|\$)?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)|(?:[-+]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:Rs\.?|INR|\$)?)/;
          const amountMatch = line.match(amountPattern);
          
          // If we found both a date and an amount, extract the description as everything else
          if (dateMatch && amountMatch) {
            const date = dateMatch[0].trim();
            let amount = amountMatch[0].trim();
            
            // Clean up the amount (remove currency symbols, commas)
            amount = amount.replace(/[Rs\.INR\$,\s]/g, '');
            
            // Make payment amounts negative if they don't already have a sign
            if (!amount.startsWith('+') && !amount.startsWith('-')) {
              // Check if this looks like a payment (keywords)
              if (line.toLowerCase().includes('payment') || 
                  line.toLowerCase().includes('booking') || 
                  line.toLowerCase().includes('installment') ||
                  line.toLowerCase().includes('completion')) {
                amount = '-' + amount;
              }
            }
            
            // Extract description (everything that's not the date or amount)
            let description = line
              .replace(dateMatch[0], '')
              .replace(amountMatch[0], '')
              .replace(/[,\s]+/g, ' ')
              .trim();
            
            // If description is empty, use a default
            if (!description) {
              description = 'Payment';
            }
            
            csvLines.push(`${date},${amount},${description}`);
          }
        }
        
        const result = csvLines.join('\n');
        setCsvResult(result);
        toast({ title: "Success", description: "Text converted to CSV format using fallback parser." });
      }
    } catch (error) {
      console.error('Error converting text to CSV:', error);
      toast({ title: "Error", description: "Failed to convert text to CSV format.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="relative max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <Wand2 className="w-5 h-5" /> AI Text to CSV Converter
              </CardTitle>
              <Button variant="ghost" size="sm" className="p-0 h-7 w-7" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Paste any text containing payment information, and Google's Gemini AI will convert it to CSV format.
              </p>
              <Textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste your text here... Example:&#10;May 2025 - Booking payment of Rs. 1,46,000&#10;June 2025 - Foundation work payment Rs. 2,92,000"
                rows={6}
                className="font-mono text-xs"
              />
            </div>
            
            <div className="flex justify-center">
              <Button 
                onClick={convertToCSV} 
                disabled={isProcessing || !rawText.trim()}
                className="gap-2"
              >
                <Wand2 className="w-4 h-4" /> 
                {isProcessing ? "Converting..." : "Convert to CSV"}
              </Button>
            </div>
            
            {csvResult && (
              <div>
                <p className="text-sm font-medium mb-2">CSV Result:</p>
                <Textarea
                  value={csvResult}
                  readOnly
                  rows={6}
                  className="font-mono text-xs bg-muted"
                />
                <div className="flex justify-end mt-4">
                  <Button
                    onClick={() => onImport(csvResult)}
                    className="gap-2"
                  >
                    <Upload className="w-4 h-4" /> Use This Data
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AITextImporter;
