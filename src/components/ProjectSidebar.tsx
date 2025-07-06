import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { X, PlusCircle, Calendar, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjects as fetchProjectsService } from '@/services/firestoreService';

// Define the structure of a session
interface Session {
  id: string;
  date: Date;
  entries: number;
  totalAmount: number;
  name?: string;
  ownerEmail?: string;
  ownerName?: string;
}

interface ProjectSidebarProps {
  onSelectProject: (projectId: string) => void;
  onNewProject: () => void;
  currentProjectId?: string; // Keeping this for backward compatibility
  onDeleteProject?: (projectId: string) => void;
}

const PAYMENTS_COLLECTION = 'projects';

export const ProjectSidebar: React.FC<ProjectSidebarProps> = ({
  onSelectProject,
  onNewProject,
  currentProjectId: propCurrentProjectId,
  onDeleteProject
}) => {
  const { currentProjectId: contextProjectId, setCurrentProjectId } = useProject();
  const currentProjectId = contextProjectId || propCurrentProjectId;
  const [projects, setProjects] = useState<Session[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const { toast } = useToast();
  const { user, loading: authLoading, isAdmin } = useAuth();

  // Handle updating a project name
  const handleUpdateProjectName = async (projectId: string, newName: string) => {
    if (!newName.trim()) return;
    
    try {
      setLoading(true);
      // Update in Firestore
      await updateDoc(doc(db, PAYMENTS_COLLECTION, projectId), {
        name: newName.trim(),
        updatedAt: new Date()
      });
      
      // Update local state
      setProjects(projects.map(project => 
        project.id === projectId 
          ? { ...project, name: newName.trim() } 
          : project
      ));
      
      toast({
        title: 'Project updated',
        description: 'Project name has been updated',
      });
      
      return true;
    } catch (error) {
      console.error('Error updating project name:', error);
      toast({
        title: 'Error',
        description: 'Failed to update project name',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
      setEditingProjectId(null);
    }
  };

  // Handle project selection
  const handleProjectClick = (projectId: string) => {
    setCurrentProjectId(projectId);
    onSelectProject(projectId);
    setIsOpen(false);
  };

  const startEditing = (project: Session) => {
    setEditingProjectId(project.id);
    setEditingName(project.name || '');
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingProjectId(null);
    setEditingName('');
  };

  // Save the edited name
  const saveEditing = async () => {
    if (editingProjectId && editingName.trim()) {
      await handleUpdateProjectName(editingProjectId, editingName);
    }
  };

  // Handle key down for input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveEditing();
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  // Expose fetchProjects for parent/other triggers
  const fetchProjects = async () => {
    if (!user) return;
    try {
      setLoading(true);
      let projectsData = [];
      if (isAdmin) {
        // Fetch all projects for admin (pass empty string to fetch all)
        projectsData = await fetchProjectsService('');
      } else {
        projectsData = await fetchProjectsService(user.uid);
      }
      setProjects(projectsData.map(data => ({
        id: data.id,
        date: data.date,
        entries: data.entryCount,
        totalAmount: 0,
        name: data.name || `Project ${data.id}`,
        ownerEmail: data.ownerEmail || '',
        ownerName: data.ownerName || ''
      })));
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchProjects();
  }, [user, isAdmin]);

  useEffect(() => {
    const handler = () => {
      if (user) fetchProjects();
    };
    window.addEventListener('refresh-projects', handler);
    return () => window.removeEventListener('refresh-projects', handler);
  }, [user, isAdmin]);
  
  // Toggle sidebar
  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };
  
  // Format amount for display
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  if (authLoading) {
    return <div className="w-64 p-4">Loading projects...</div>;
  }
  if (!user) {
    return <div className="w-64 p-4 text-gray-500">Please sign in to view your projects.</div>;
  }

  return (
    <div className={`transition-all duration-300 ${isOpen ? 'w-64' : 'w-12'} border-r border-gray-200 h-screen flex flex-col`}>
      {/* Remove user info and admin badge from here. Only show project list below. */}
      {isOpen && (
        <>
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold mb-2">Previous Projects</h2>
            <Button 
              variant="outline" 
              className="w-full justify-start" 
              onClick={onNewProject}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex flex-col space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2">
                {projects.length > 0 ? projects.map(project => (
                  <div
                    key={project.id}
                    className={`p-3 mb-2 rounded-md flex items-center justify-between transition-colors
                      ${currentProjectId === project.id 
                        ? 'bg-blue-100 border-l-4 border-blue-500' 
                        : 'hover:bg-gray-100'}`}
                  >
                    <div
                      className="flex items-center cursor-pointer flex-1"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      <div className="flex flex-col flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {project.name}
                        </div>
                        {/* Show owner name and email for admin users, single line, compact */}
                        {isAdmin && (project.ownerName || project.ownerEmail) && (
                          <>
                            {project.ownerName && (
                              <div className="text-xs font-semibold text-gray-700">{project.ownerName}</div>
                            )}
                            {project.ownerEmail && (
                              <div className="text-xs text-gray-500 break-all">{project.ownerEmail}</div>
                            )}
                          </>
                        )}
                        <div className="text-xs text-gray-500">
                          {format(project.date, 'MMM d, yyyy h:mm a')}
                        </div>
                      </div>
                    </div>
                    {onDeleteProject && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="ml-2 text-red-500 hover:bg-red-100"
                        title="Delete project"
                        onClick={e => {
                          e.stopPropagation();
                          onDeleteProject(project.id);
                        }}
                        disabled={loading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )) : (
                  <div className="text-center text-gray-500 py-8">
                    No previous projects found
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
