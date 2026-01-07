import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, FolderOpen, Users, Share2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjects, fetchProjectSharing } from '@/services/firestoreService';
import { getUsersByIds } from '@/services/userService';
import { AppUser } from '@/types/user';
import { format } from 'date-fns';
import ShareProjectDialog from './ShareProjectDialog';

interface ProjectWithSharing {
  id: string;
  name: string;
  date: Date;
  ownerId: string;
  ownerEmail?: string;
  sharedWith: string[];
  sharedUsers?: AppUser[];
  isOwner: boolean;
}

const ProjectSharingTab = () => {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectWithSharing[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<ProjectWithSharing | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProjectsWithSharing = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch projects (admins see all, users see their own)
      const projectsData = await fetchProjects(isAdmin ? '' : user.uid);

      // Get sharing info for each project
      const projectsWithSharing: ProjectWithSharing[] = await Promise.all(
        projectsData.map(async (project) => {
          const sharingInfo = await fetchProjectSharing(project.id);
          const sharedWith = sharingInfo?.sharedWith || [];

          // Fetch user details for shared users
          let sharedUsers: AppUser[] = [];
          if (sharedWith.length > 0) {
            sharedUsers = await getUsersByIds(sharedWith);
          }

          return {
            id: project.id,
            name: project.name || `Project ${project.id}`,
            date: project.date,
            ownerId: sharingInfo?.ownerId || '',
            ownerEmail: project.ownerEmail,
            sharedWith,
            sharedUsers,
            isOwner: sharingInfo?.ownerId === user.uid,
          };
        })
      );

      // Filter: show only projects the user owns (for sharing management)
      // Admins can see all
      const filteredProjects = isAdmin
        ? projectsWithSharing
        : projectsWithSharing.filter((p) => p.isOwner);

      setProjects(filteredProjects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      toast({
        title: 'Error',
        description: 'Failed to load projects',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectsWithSharing();
  }, [user, isAdmin]);

  const handleShareClick = (project: ProjectWithSharing) => {
    setSelectedProject(project);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedProject(null);
  };

  const handleSharingUpdated = () => {
    fetchProjectsWithSharing();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Projects</CardTitle>
          <CardDescription>Manage project sharing and access</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                {isAdmin ? 'All Projects' : 'My Projects'}
              </CardTitle>
              <CardDescription>
                Manage project sharing and access ({projects.length} projects)
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchProjectsWithSharing}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead>Owner</TableHead>}
                <TableHead>Shared With</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projects.map((project) => (
                <TableRow key={project.id}>
                  <TableCell>
                    <div className="font-medium">{project.name}</div>
                  </TableCell>
                  <TableCell className="text-gray-500 text-sm">
                    {format(project.date, 'MMM d, yyyy')}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-gray-600 text-sm">
                      {project.ownerEmail || 'Unknown'}
                    </TableCell>
                  )}
                  <TableCell>
                    {project.sharedWith.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {project.sharedWith.length} user
                          {project.sharedWith.length !== 1 ? 's' : ''}
                        </span>
                        {project.sharedUsers && project.sharedUsers.length > 0 && (
                          <div className="flex -space-x-2">
                            {project.sharedUsers.slice(0, 3).map((sharedUser) => (
                              <Badge
                                key={sharedUser.uid}
                                variant="secondary"
                                className="text-xs"
                                title={sharedUser.email}
                              >
                                {sharedUser.displayName.split(' ')[0]}
                              </Badge>
                            ))}
                            {project.sharedUsers.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{project.sharedUsers.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Not shared</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleShareClick(project)}
                      disabled={!project.isOwner && !isAdmin}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Share
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {projects.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No projects found</p>
              <p className="text-sm mt-1">Create a project to start sharing</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedProject && (
        <ShareProjectDialog
          open={dialogOpen}
          onClose={handleDialogClose}
          project={selectedProject}
          onSharingUpdated={handleSharingUpdated}
        />
      )}
    </>
  );
};

export default ProjectSharingTab;
