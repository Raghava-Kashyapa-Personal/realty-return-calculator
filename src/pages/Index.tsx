
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import PaymentsCashFlow from '@/components/PaymentsCashFlow';
import { FinancialMetrics } from '@/components/FinancialMetrics';

import { SessionSidebar } from '@/components/SessionSidebar';
import { ProjectData, Payment } from '@/types/project';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { fetchSession, createNewSession, deleteSession } from '@/services/firestoreService';
import { SessionNameDialog } from '@/components/SessionNameDialog';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  // ...existing state

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    setIsLoading(true);
    try {
      await deleteSession(sessionId);
      toast({ title: 'Session Deleted', description: `Session ${sessionId} deleted.` });
      // If deleted session is current, clear selection
      if (currentSessionId === sessionId) {
        setCurrentSessionId('');
        setProjectData({
          projectName: 'New Project',
          annualInterestRate: 12,
          purchasePrice: 0,
          closingCosts: 0,
          repairs: 0,
          afterRepairValue: 0,
          otherInitialCosts: 0,
          payments: [],
          rentalIncome: [],
        });
      }
      // Refresh sidebar
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refresh-sessions', { detail: 'refresh-sessions' }));
      }, 300);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete session', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const [projectData, setProjectData] = useState<ProjectData>({
    projectName: 'New Project',
    annualInterestRate: 12, // 12% annual interest rate
    purchasePrice: 0,
    closingCosts: 0,
    repairs: 0,
    afterRepairValue: 0,
    otherInitialCosts: 0,
    payments: [],
    rentalIncome: [],
  });

  // Session management states
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
  const { toast } = useToast();

  // Load session data when currentSessionId changes
  useEffect(() => {
    const loadSession = async () => {
      if (!currentSessionId) return;

      setIsLoading(true);
      try {
        const { entries, projectId } = await fetchSession(currentSessionId);
        if (entries && entries.length > 0) {
          updatePayments(entries);

          toast({
            title: 'Session Loaded',
            description: `Loaded ${entries.length} entries from session`,
          });
        } else {
          toast({
            title: 'Empty Session',
            description: 'This session has no entries',
          });
        }
      } catch (error) {
        console.error('Error loading session:', error);
        toast({
          title: 'Error',
          description: 'Failed to load session data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSession();
  }, [currentSessionId, toast]);

  // Handle session selection from sidebar
  const handleSelectSession = (sessionId: string) => {
    console.log(`Selecting session: ${sessionId}`);
    
    // IMPORTANT: First set the current session ID to update the UI
    setCurrentSessionId(sessionId);
    
    // Then try to load cached data immediately to prevent flashing
    const cachedData = localStorage.getItem(`session-data-${sessionId}`);
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        console.log(`Using cached data for session ${sessionId}: ${parsedData.length} entries`);
        
        // Update project data with cached payments
        setProjectData(prev => ({
          ...prev,
          payments: parsedData
        }));
      } catch (e) {
        console.error('Error parsing cached session data:', e);
      }
    } else {
      // If no cached data, ensure we start with an empty state
      // This prevents stale data from previous sessions
      setProjectData(prev => ({
        ...prev,
        payments: []
      }));
    }
    
    // Then force a refresh to fetch latest data
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refresh-sessions', { detail: sessionId }));
    }, 100);
  };

  // State for session name dialog
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [pendingSessionName, setPendingSessionName] = useState('');

  // Handle new session button click
  const handleNewSessionClick = () => {
    setPendingSessionName('');
    setIsSessionDialogOpen(true);
  };

  // Create a new session with the given name
  const handleCreateSession = async (sessionName: string) => {
    setIsLoading(true);
    setIsSessionDialogOpen(false);
    
    try {
      const { sessionId, name } = await createNewSession(sessionName);
      
      // Mark this as a new session in localStorage
      localStorage.setItem(`session-${sessionId}-is-new`, 'true');
      localStorage.setItem(`session-${sessionId}-initialized`, 'true');
      
      // Reset project data for new session
      const newProjectData = {
        projectName: name, // Use the session name as the default project name
        annualInterestRate: 12,
        purchasePrice: 0,
        closingCosts: 0,
        repairs: 0,
        afterRepairValue: 0,
        otherInitialCosts: 0,
        payments: [],
        rentalIncome: [],
      };
      
      // Update the project data state
      setProjectData(newProjectData);
      
      // Store initial empty state in localStorage
      localStorage.setItem(`session-data-${sessionId}`, JSON.stringify([]));
      
      // Set the current session ID immediately
      setCurrentSessionId(sessionId);
      
      // Force refresh the SessionSidebar component by fetching sessions
      const refreshSessions = async () => {
        // Wait a moment for the new session to be created in the database
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Dispatch multiple events to ensure all components are refreshed
        window.dispatchEvent(new CustomEvent('refresh-sessions', { detail: 'force-refresh' }));
        
        // Some components might only listen to this specific event
        const refreshEvent = new CustomEvent('refresh-sessions', { 
          detail: { sessionId, action: 'new-session' } 
        });
        window.dispatchEvent(refreshEvent);
        
        // Try to refresh the session list in the sidebar specifically
        const sidebarEvent = new CustomEvent('sidebar-refresh', { 
          detail: { sessionId } 
        });
        window.dispatchEvent(sidebarEvent);
      };
      
      // Execute the refresh function
      await refreshSessions();
      
      toast({
        title: 'New Session Created',
        description: `Created new session: ${name}`,
      });
      
      // Navigate to the new session
      navigate(`/session/${sessionId}`);
    } catch (error) {
      console.error('Error creating new session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new session',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateProjectData = (updates: Partial<ProjectData>) => {
    setProjectData(prev => ({ ...prev, ...updates }));
  };

  const updatePayments = (payments: Payment[]) => {
    setProjectData(prev => ({ ...prev, payments }));
  };

  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-blue-50 to-green-50">
      {/* Session Sidebar */}
      <SessionSidebar 
        onSelectSession={handleSelectSession} 
        onNewSession={handleNewSessionClick} 
        currentSessionId={currentSessionId}
        onDeleteSession={handleDeleteSession}
      />
      
      <SessionNameDialog
        open={isSessionDialogOpen}
        onOpenChange={setIsSessionDialogOpen}
        onSave={handleCreateSession}
        defaultName={pendingSessionName}
      />
      
      {/* Main Content */}
      <div className="flex-1 px-4 py-8 overflow-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <TrendingUp className="text-blue-600" />
            Real Estate Investment Analyzer
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive cash flow analysis for Indian real estate projects
          </p>
        </div>

        <Tabs defaultValue="cashflow" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="cashflow" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Cash Flow</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              <span>Analysis & Setup</span>
            </TabsTrigger>

          </TabsList>

          <TabsContent value="cashflow">
            <Card className="shadow-sm border-gray-200">
              <CardContent className="p-0">
                <PaymentsCashFlow 
                  projectData={projectData}
                  updateProjectData={updateProjectData}
                  updatePayments={updatePayments}
                  showOnlyCashFlow={true}
                  sessionId={currentSessionId}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analysis">
            <div className="space-y-6">
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="pb-2 px-4 pt-3">
                  <CardTitle className="flex items-center text-base font-medium text-gray-700 gap-1.5">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    Cash Flow Analysis
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <PaymentsCashFlow 
                    projectData={projectData}
                    updateProjectData={updateProjectData}
                    updatePayments={updatePayments}
                    showOnlyAnalysis={true}
                    sessionId={currentSessionId}
                  />
                </CardContent>
              </Card>
              
              <FinancialMetrics 
                projectData={projectData} 
                updateProjectData={updateProjectData}
              />
            </div>
          </TabsContent>
          

        </Tabs>
      </div>
    </div>
  );
};

export default Index;
