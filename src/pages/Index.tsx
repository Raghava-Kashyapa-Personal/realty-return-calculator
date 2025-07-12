import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import PaymentsCashFlow from '@/components/PaymentsCashFlow';
import { ProjectSidebar } from '@/components/ProjectSidebar';
import { SaveDiscardActionBar, ProjectTitleWithIndicator } from '@/components/SaveDiscardActionBar';
import { TrendingUp } from 'lucide-react';
import { createNewProject, deleteProject } from '@/services/firestoreService';
import { ProjectNameDialog } from '@/components/ProjectNameDialog';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigationGuard, useProjectSwitchGuard } from '@/hooks/useNavigationGuard';

const Index = () => {
  // Authentication state
  const { user, loading, isAdmin, signInWithGoogle, signUpWithEmail, signInWithEmail, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authError, setAuthError] = useState<string | null>(null);

  // Project context and navigation guards
  const { currentProjectId, setCurrentProjectId, projectData, resetProject } = useProject();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Navigation guards for unsaved changes
  useNavigationGuard();
  const { confirmProjectSwitch } = useProjectSwitchGuard();

  // Handle project deletion
  const handleDeleteProject = async (projectId: string) => {
    setIsLoading(true);
    try {
      await deleteProject(projectId);
      toast({ title: 'Project Deleted', description: `Project ${projectId} deleted.` });
      
      // If deleted project is current, clear selection
      if (currentProjectId === projectId) {
        setCurrentProjectId('');
        resetProject();
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

  // Handle project selection from sidebar with navigation guard
  const handleSelectProject = async (projectId: string) => {
    console.log(`Attempting to select project: ${projectId}`);
    
    // Use navigation guard to check for unsaved changes
    await confirmProjectSwitch(projectId, setCurrentProjectId);
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
      const { projectId, name } = await createNewProject(
        projectName,
        user?.uid,
        user?.email,
        user?.displayName || user?.email || ''
      );
      
      // Reset project data for new project
      resetProject({ projectName: name });
      
      // Set the current project ID
      setCurrentProjectId(projectId);
      
      // Refresh the sidebar
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('refresh-projects', { detail: 'force-refresh' }));
      }, 200);
      
      toast({
        title: 'New Project Created',
        description: `Created new project: ${name}`,
      });
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



  // Authentication UI
  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading authentication...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Card className="w-full max-w-md p-6">
          <CardHeader>
            <CardTitle>Sign In to Project Finance Calculator</CardTitle>
          </CardHeader>
          <CardContent>
            <button
              className="w-full bg-blue-600 text-white py-2 rounded mb-4 hover:bg-blue-700 transition"
              onClick={async () => {
                setAuthError(null);
                try {
                  await signInWithGoogle();
                } catch (err: any) {
                  setAuthError(err.message || 'Google sign-in failed');
                }
              }}
            >
              Sign in with Google
            </button>
            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 py-1 rounded ${authMode === 'login' ? 'bg-gray-200' : 'bg-white'}`}
                onClick={() => setAuthMode('login')}
              >
                Login
              </button>
              <button
                className={`flex-1 py-1 rounded ${authMode === 'signup' ? 'bg-gray-200' : 'bg-white'}`}
                onClick={() => setAuthMode('signup')}
              >
                Sign Up
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError(null);
                try {
                  if (authMode === 'login') {
                    await signInWithEmail(email, password);
                  } else {
                    await signUpWithEmail(email, password);
                  }
                } catch (err: any) {
                  setAuthError(err.message || 'Authentication failed');
                }
              }}
              className="flex flex-col gap-3"
            >
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="border rounded px-3 py-2"
                required
              />
              <button
                type="submit"
                className="w-full bg-primary text-white py-2 rounded hover:bg-primary/90 transition"
              >
                {authMode === 'login' ? 'Login' : 'Sign Up'}
              </button>
            </form>
            {authError && <div className="text-red-600 mt-2 text-sm">{authError}</div>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // If user is logged in, show user info and the main app
  return (
    <div>
      {/* Main top bar with user info, title, and logout */}
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <div className="flex items-center gap-4">
          {user.photoURL && (
            <img src={user.photoURL} alt="avatar" className="w-8 h-8 rounded-full" />
          )}
          <span className="font-medium">{user.displayName || user.email}</span>
          {isAdmin && <span className="ml-2 px-2 py-0.5 bg-yellow-200 text-yellow-800 text-xs rounded">Admin</span>}
          {/* App Title and Subtitle */}
          <div className="ml-8 flex flex-col">
            <span className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="text-blue-600" />
              Project Finance Calculator
            </span>
            <span className="text-sm text-gray-600">Comprehensive cash flow analysis for all types of projects</span>
          </div>
        </div>
        <button
          className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
          onClick={logout}
        >
          Logout
        </button>
      </div>
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
          <div className="space-y-6">
            {/* Project Title with Unsaved Changes Indicator */}
            {currentProjectId && (
              <div className="flex items-center justify-between">
                <ProjectTitleWithIndicator 
                  title={projectData.projectName} 
                  className="text-2xl font-bold text-gray-900"
                />
              </div>
            )}
            
            {/* Integrated Cash Flow and Analysis */}
            <Card className="shadow-sm border-gray-200">
              <CardContent className="p-0">
                <PaymentsCashFlow />
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Note: Save/Discard actions now integrated into PaymentsCashFlow component */}
      </div>
    </div>
  );
};

export default Index;
