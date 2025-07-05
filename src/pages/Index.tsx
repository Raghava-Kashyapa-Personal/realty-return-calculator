import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import PaymentsCashFlow from '@/components/PaymentsCashFlow';
import { FinancialMetrics } from '@/components/FinancialMetrics';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { ProjectData, Payment } from '@/types/project';
import { TrendingUp, BarChart3 } from 'lucide-react';
import { fetchProject, createNewProject, deleteProject } from '@/services/firestoreService';
import { ProjectNameDialog } from '@/components/ProjectNameDialog';
import { useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';

const Index = () => {
  // ...existing state

  // Handle project deletion
  const handleDeleteProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      await deleteProject(projectId);
      toast({ title: 'Project Deleted', description: `Project ${projectId} deleted.` });
      // If deleted project is current, clear selection
      if (currentProjectId === projectId) {
        setCurrentProjectId('');
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
        window.dispatchEvent(new CustomEvent('refresh-projects', { detail: 'refresh-projects' }));
      }, 300);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete project', variant: 'destructive' });
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

  // Project management states
  const { currentProjectId, setCurrentProjectId } = useProject();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sidebarVisible, setSidebarVisible] = useState<boolean>(true);
  const { toast } = useToast();

  // Load project data when currentProjectId changes
  useEffect(() => {
    const loadProject = async () => {
      if (!currentProjectId) return;

      setIsLoading(true);
      try {
        const { entries, projectId } = await fetchProject(currentProjectId);
        if (entries && entries.length > 0) {
          updatePayments(entries);

          toast({
            title: 'Project Loaded',
            description: `Loaded ${entries.length} entries from project`,
          });
        } else {
          toast({
            title: 'Empty Project',
            description: 'This project has no entries',
          });
        }
      } catch (error) {
        console.error('Error loading project:', error);
        toast({
          title: 'Error',
          description: 'Failed to load project data',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [currentProjectId, toast]);

  // Handle project selection from sidebar
  const handleSelectProject = (projectId: string) => {
    console.log(`Selecting project: ${projectId}`);
    
    // IMPORTANT: First set the current project ID to update the UI
    setCurrentProjectId(projectId);
    
    // Then try to load cached data immediately to prevent flashing
    const cachedData = localStorage.getItem(`project-data-${projectId}`);
    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);
        console.log(`Using cached data for project ${projectId}: ${parsedData.length} entries`);
        
        // Update project data with cached payments
        setProjectData(prev => ({
          ...prev,
          payments: parsedData
        }));
      } catch (e) {
        console.error('Error parsing cached project data:', e);
      }
    } else {
      // If no cached data, ensure we start with an empty state
      // This prevents stale data from previous projects
      setProjectData(prev => ({
        ...prev,
        payments: []
      }));
    }
    
    // Then force a refresh to fetch latest data
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refresh-projects', { detail: projectId }));
    }, 100);
  };

  // State for project name dialog
  const [isProjectDialogOpen, setIsProjectDialogOpen] = useState(false);
  const [pendingProjectName, setPendingProjectName] = useState('');

  // Handle new project button click
  const handleNewProjectClick = () => {
    setPendingProjectName('');
    setIsProjectDialogOpen(true);
  };

  // Create a new project with the given name
  const handleCreateProject = async (projectName: string) => {
    setIsLoading(true);
    setIsProjectDialogOpen(false);
    
    try {
      const { projectId, name } = await createNewProject(projectName);
      
      // Mark this as a new project in localStorage
      localStorage.setItem(`project-${projectId}-is-new`, 'true');
      localStorage.setItem(`project-${projectId}-initialized`, 'true');
      
      // Reset project data for new project
      const newProjectData = {
        projectName: name, // Use the project name as the default project name
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
      localStorage.setItem(`project-data-${projectId}`, JSON.stringify([]));
      
      // Set the current project ID immediately
      setCurrentProjectId(projectId);
      
      // Force refresh the ProjectSidebar component by fetching projects
      const refreshProjects = async () => {
        // Wait a moment for the new project to be created in the database
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Dispatch multiple events to ensure all components are refreshed
        window.dispatchEvent(new CustomEvent('refresh-projects', { detail: 'force-refresh' }));
        
        // Some components might only listen to this specific event
        const refreshEvent = new CustomEvent('refresh-projects', { 
          detail: { projectId, action: 'new-project' } 
        });
        window.dispatchEvent(refreshEvent);
        
        // Try to refresh the project list in the sidebar specifically
        const sidebarEvent = new CustomEvent('sidebar-refresh', { 
          detail: { projectId } 
        });
        window.dispatchEvent(sidebarEvent);
      };
      
      // Execute the refresh function
      await refreshProjects();
      
      toast({
        title: 'New Project Created',
        description: `Created new project: ${name}`,
      });
      
      // Don't navigate, just update the current project ID which will trigger a refresh
      // The project data will be loaded through the existing useEffect hook
      setCurrentProjectId(projectId);
    } catch (error) {
      console.error('Error creating new project:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new project',
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
      {/* Project Sidebar */}
      <ProjectSidebar 
        onSelectProject={handleSelectProject} 
        onNewProject={handleNewProjectClick} 
        currentProjectId={currentProjectId}
        onDeleteProject={handleDeleteProject}
      />
      
      <ProjectNameDialog
        open={isProjectDialogOpen}
        onOpenChange={setIsProjectDialogOpen}
        onSave={handleCreateProject}
        defaultName={pendingProjectName}
      />
      
      {/* Main Content */}
      <div className="flex-1 px-4 py-8 overflow-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-3">
            <TrendingUp className="text-blue-600" />
            Project Finance Calculator
          </h1>
          <p className="text-lg text-gray-600">
            Comprehensive cash flow analysis for all types of projects
          </p>
        </div>

        <Tabs defaultValue="cashflow" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="cashflow" className="flex items-center justify-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>Cash Flow</span>
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center justify-center gap-2">
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
                  projectId={currentProjectId}
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
                    projectId={currentProjectId}
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
