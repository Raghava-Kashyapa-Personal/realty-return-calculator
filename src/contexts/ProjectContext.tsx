import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { ProjectData, Payment } from '@/types/project';
import { saveBatch, fetchProject, fetchProjectData, saveProjectData, savePayments } from '@/services/firestoreService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from './AuthContext';

interface ProjectContextType {
  // Project identification
  currentProjectId: string;
  setCurrentProjectId: (id: string) => void;
  
  // Project data (in-memory)
  projectData: ProjectData;
  originalProjectData: ProjectData | null;
  
  // Unsaved changes tracking
  hasUnsavedChanges: boolean;
  lastSavedAt: Date | null;
  
  // Data modification functions
  updateProjectData: (updates: Partial<ProjectData>) => void;
  updatePayments: (payments: Payment[]) => void;
  addPayment: (payment: Payment) => void;
  updatePayment: (paymentId: string, updates: Partial<Payment>) => void;
  deletePayment: (paymentId: string) => void;
  
  // Save/discard functions
  saveToFirebase: () => Promise<boolean>;
  discardChanges: () => void;
  loadProject: (projectId: string) => Promise<void>;
  
  // Reset function for new projects
  resetProject: (newProjectData?: Partial<ProjectData>) => void;
  
  // Loading state
  isLoading: boolean;
  isSaving: boolean;
}

const defaultProjectData: ProjectData = {
  projectName: 'New Project',
  annualInterestRate: 12,
  projectEndDate: (() => {
    const defaultDate = new Date();
    defaultDate.setFullYear(defaultDate.getFullYear() + 1);
    return defaultDate;
  })(),
  purchasePrice: 0,
  closingCosts: 0,
  repairs: 0,
  afterRepairValue: 0,
  otherInitialCosts: 0,
  payments: [],
  rentalIncome: [],
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [projectData, setProjectData] = useState<ProjectData>(defaultProjectData);
  const [originalProjectData, setOriginalProjectData] = useState<ProjectData | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const changeTrackingRef = useRef<boolean>(false);

  // Update project data with change tracking
  const updateProjectData = useCallback((updates: Partial<ProjectData>) => {
    setProjectData(prev => {
      const newData = { ...prev, ...updates };
      
      // Track changes only if we have original data to compare against
      if (changeTrackingRef.current && originalProjectData) {
        const hasChanges = JSON.stringify(newData) !== JSON.stringify(originalProjectData);
        setHasUnsavedChanges(hasChanges);
      }
      
      return newData;
    });
  }, [originalProjectData]);

  // Update payments specifically
  const updatePayments = useCallback((payments: Payment[]) => {
    updateProjectData({ payments });
  }, [updateProjectData]);

  // Add a single payment
  const addPayment = useCallback((payment: Payment) => {
    setProjectData(prev => {
      const newPayments = [...prev.payments, payment];
      const newData = { ...prev, payments: newPayments };
      
      if (changeTrackingRef.current && originalProjectData) {
        setHasUnsavedChanges(true);
      }
      
      return newData;
    });
  }, [originalProjectData]);

  // Update a specific payment
  const updatePayment = useCallback((paymentId: string, updates: Partial<Payment>) => {
    setProjectData(prev => {
      const newPayments = prev.payments.map(p => 
        p.id === paymentId ? { ...p, ...updates } : p
      );
      const newData = { ...prev, payments: newPayments };
      
      if (changeTrackingRef.current && originalProjectData) {
        setHasUnsavedChanges(true);
      }
      
      return newData;
    });
  }, [originalProjectData]);

  // Delete a payment
  const deletePayment = useCallback((paymentId: string) => {
    setProjectData(prev => {
      const newPayments = prev.payments.filter(p => p.id !== paymentId);
      const newData = { ...prev, payments: newPayments };
      
      if (changeTrackingRef.current && originalProjectData) {
        setHasUnsavedChanges(true);
      }
      
      return newData;
    });
  }, [originalProjectData]);

  // Save to Firebase
  const saveToFirebase = useCallback(async (): Promise<boolean> => {
    // Check authentication first
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to save your project.',
        variant: 'destructive',
      });
      return false;
    }

    if (!currentProjectId) {
      toast({
        title: 'No Project Selected',
        description: 'Please select a project before saving.',
        variant: 'destructive',
      });
      return false;
    }

    setIsSaving(true);
    try {
      // Save project data (metadata) with user info
      const projectDataWithOwner = {
        ...projectData,
        ownerId: user.uid,
        ownerEmail: user.email,
        ownerName: user.displayName,
      };
      
      await saveProjectData(projectDataWithOwner, currentProjectId);
      
      // Save payments (entries)
      await savePayments(projectData.payments, currentProjectId);
      
      // Update tracking state
      setOriginalProjectData({ ...projectData });
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      
      toast({
        title: 'Project Saved',
        description: 'All changes have been saved to Firebase.',
      });
      
      // Notify other components that project was saved
      window.dispatchEvent(new CustomEvent('project-saved', { 
        detail: { projectId: currentProjectId } 
      }));
      
      return true;
    } catch (error) {
      console.error('Error saving project:', error);
      toast({
        title: 'Save Failed',
        description: 'Failed to save changes to Firebase. Please check your internet connection and try again.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [currentProjectId, projectData, user, toast]);

  // Discard changes
  const discardChanges = useCallback(() => {
    if (originalProjectData) {
      setProjectData({ ...originalProjectData });
      setHasUnsavedChanges(false);
      
      toast({
        title: 'Changes Discarded',
        description: 'All unsaved changes have been reverted.',
      });
    }
  }, [originalProjectData, toast]);

  // Load project from Firebase
  const loadProject = useCallback(async (projectId: string) => {
    if (!projectId) return;

    // Check authentication first
    if (!user) {
      toast({
        title: 'Authentication Required',
        description: 'Please sign in to load your project.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    changeTrackingRef.current = false; // Disable change tracking during load
    
    try {
      // First try to load from the payments collection (entries + project name)
      const { entries, projectName: actualProjectName } = await fetchProject(projectId);
      
      // Then try to load project metadata
      let projectMetadata: ProjectData | null = null;
      try {
        projectMetadata = await fetchProjectData(projectId);
        console.log('Loaded project metadata:', projectMetadata);
      } catch (error) {
        console.warn('No project metadata found, using defaults. Error:', error);
        
        // If metadata doesn't exist, create it with current defaults
        try {
          const initialMetadata: ProjectData = {
            ...defaultProjectData,
            projectName: actualProjectName || 'New Project', // Use the actual project name
            payments: [], // Will be overridden
          };
          await saveProjectData(initialMetadata, projectId);
          projectMetadata = initialMetadata;
          console.log('Created initial project metadata for project:', projectId);
        } catch (saveError) {
          console.error('Failed to create initial project metadata:', saveError);
        }
      }
      
      // Combine metadata with entries - ensure project-specific settings are preserved
      const loadedProjectData: ProjectData = {
        ...defaultProjectData,  // Start with defaults
        ...projectMetadata,     // Override with saved project settings
        projectName: actualProjectName || projectMetadata?.projectName || 'New Project', // Use the actual project name from projects collection
        payments: entries || [], // Always use entries from payments collection
      };
      
      // Ensure we have valid dates
      if (loadedProjectData.projectEndDate) {
        try {
          // Handle Firestore Timestamp conversion
          const dateValue = loadedProjectData.projectEndDate as any;
          if (dateValue && typeof dateValue.toDate === 'function') {
            loadedProjectData.projectEndDate = dateValue.toDate();
          } else if (typeof dateValue === 'string') {
            loadedProjectData.projectEndDate = new Date(dateValue);
          } else if (!(dateValue instanceof Date)) {
            // If it's not already a Date, try to convert it
            loadedProjectData.projectEndDate = new Date(dateValue);
          }
          
          // Validate the final date
          if (isNaN(loadedProjectData.projectEndDate.getTime())) {
            throw new Error('Invalid date after conversion');
          }
        } catch (dateError) {
          console.warn('Failed to convert project end date, using default:', dateError);
          loadedProjectData.projectEndDate = (() => {
            const defaultDate = new Date();
            defaultDate.setFullYear(defaultDate.getFullYear() + 1);
            return defaultDate;
          })();
        }
      }
      
      setProjectData(loadedProjectData);
      setOriginalProjectData({ ...loadedProjectData });
      setHasUnsavedChanges(false);
      setLastSavedAt(new Date());
      
      toast({
        title: 'Project Loaded',
        description: `Loaded project with ${entries?.length || 0} entries.`,
      });
      
    } catch (error) {
      console.error('Error loading project:', error);
      toast({
        title: 'Load Failed',
        description: 'Failed to load project from Firebase. Please check your internet connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      // Re-enable change tracking after a short delay
      setTimeout(() => {
        changeTrackingRef.current = true;
      }, 100);
    }
  }, [user, toast]);

  // Reset project for new projects
  const resetProject = useCallback((newProjectData?: Partial<ProjectData>) => {
    changeTrackingRef.current = false; // Disable change tracking during reset
    
    const resetData = {
      ...defaultProjectData,
      ...newProjectData,
    };
    
    setProjectData(resetData);
    setOriginalProjectData({ ...resetData });
    setHasUnsavedChanges(false);
    setLastSavedAt(null);
    
    // Re-enable change tracking after a short delay
    setTimeout(() => {
      changeTrackingRef.current = true;
    }, 100);
  }, []);

  // Auto-load project when currentProjectId changes (but only if authenticated)
  useEffect(() => {
    // Don't auto-load if still checking authentication
    if (authLoading) return;
    
    if (currentProjectId && user) {
      loadProject(currentProjectId);
    } else {
      resetProject();
    }
  }, [currentProjectId, user, authLoading, loadProject, resetProject]);

  const value: ProjectContextType = {
    currentProjectId,
    setCurrentProjectId,
    projectData,
    originalProjectData,
    hasUnsavedChanges,
    lastSavedAt,
    updateProjectData,
    updatePayments,
    addPayment,
    updatePayment,
    deletePayment,
    saveToFirebase,
    discardChanges,
    loadProject,
    resetProject,
    isLoading,
    isSaving,
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = (): ProjectContextType => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
