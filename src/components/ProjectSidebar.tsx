import React, { useState, useEffect } from 'react';
import { collection, query, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { X, PlusCircle, Calendar, Pencil, Check } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useProject } from '@/contexts/ProjectContext';

// Define the structure of a session
interface Session {
  id: string;
  date: Date;
  entries: number;
  totalAmount: number;
  name?: string;
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
    try {
      setLoading(true);
      const projectsCol = collection(db, PAYMENTS_COLLECTION);
      const q = query(projectsCol, orderBy('createdAt', 'desc'), limit(30));
      const querySnapshot = await getDocs(q);
      const projectsData: Session[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        const entries = data.entries || [];
        // Calculate the total amount of all entries
        const totalAmount = entries.reduce((sum: number, entry: any) => {
          const amount = entry.amount || 0;
          return sum + amount;
        }, 0);
        projectsData.push({
          id: doc.id,
          date: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(doc.id),
          entries: entries.length,
          totalAmount,
          name: data.name || `Project ${projectsData.length + 1}`
        });
      });
      setProjects(projectsData);
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  // Allow refresh via window event (for decoupled triggering)
  useEffect(() => {
    const handler = () => {
      console.log('Received refresh-projects event, refreshing projects...');
      fetchProjects();
    };
    window.addEventListener('refresh-projects', handler);
    return () => window.removeEventListener('refresh-projects', handler);
  }, []);
  
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
  
  return (
    <div className={`transition-all duration-300 ${isOpen ? 'w-64' : 'w-12'} border-r border-gray-200 h-screen flex flex-col`}>
      {/* Toggle button */}
      <button 
        onClick={toggleSidebar} 
        className="absolute left-64 top-4 p-1 bg-white border border-gray-200 rounded-full shadow-sm z-10"
        style={{ transform: isOpen ? 'translateX(50%)' : 'translateX(-50%)'}}
      >
        <X className={`h-4 w-4 transition-transform duration-300 ${isOpen ? 'rotate-0' : 'rotate-180'}`} />
      </button>
      
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
                      {editingProjectId === project.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1 px-2 py-1 text-sm border rounded"
                            autoFocus
                          />
                          <button 
                            onClick={saveEditing}
                            className="p-1 text-green-600 hover:bg-green-100 rounded"
                            disabled={!editingName.trim()}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button 
                            onClick={cancelEditing}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center group">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {project.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {format(project.date, 'MMM d, yyyy h:mm a')}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(project);
                            }}
                            className="opacity-0 group-hover:opacity-100 ml-2 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                            title="Edit project name"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
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
