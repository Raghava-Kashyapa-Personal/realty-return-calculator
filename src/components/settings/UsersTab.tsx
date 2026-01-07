import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { RefreshCw, Shield, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getAllUsers, setUserAdminStatus } from '@/services/userService';
import { AppUser } from '@/types/user';
import { format } from 'date-fns';

const UsersTab = () => {
  const { user: currentUser, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersData = await getAllUsers();
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    // Prevent toggling own admin status
    if (userId === currentUser?.uid) {
      toast({
        title: 'Not allowed',
        description: 'You cannot change your own admin status',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUpdatingUserId(userId);
      await setUserAdminStatus(userId, !currentStatus);

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.uid === userId ? { ...u, isAdmin: !currentStatus } : u))
      );

      toast({
        title: 'Success',
        description: `User ${!currentStatus ? 'promoted to' : 'removed from'} admin`,
      });
    } catch (error) {
      console.error('Error updating admin status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update admin status',
        variant: 'destructive',
      });
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getInitials = (name: string, email: string) => {
    if (name) {
      return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>Manage user access and admin privileges</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Users
            </CardTitle>
            <CardDescription>
              Manage user access and admin privileges ({users.length} users)
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchUsers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead className="text-center">Admin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((appUser) => (
              <TableRow key={appUser.uid}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={appUser.photoURL} />
                      <AvatarFallback>
                        {getInitials(appUser.displayName, appUser.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{appUser.displayName}</span>
                      {appUser.uid === currentUser?.uid && (
                        <Badge variant="outline" className="text-xs">
                          You
                        </Badge>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">{appUser.email}</TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {format(appUser.createdAt, 'MMM d, yyyy')}
                </TableCell>
                <TableCell className="text-gray-500 text-sm">
                  {format(appUser.lastLoginAt, 'MMM d, yyyy h:mm a')}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Switch
                      checked={appUser.isAdmin}
                      onCheckedChange={() => handleToggleAdmin(appUser.uid, appUser.isAdmin)}
                      disabled={
                        updatingUserId === appUser.uid || appUser.uid === currentUser?.uid
                      }
                    />
                    {appUser.isAdmin && (
                      <Badge variant="default" className="bg-blue-600">
                        Admin
                      </Badge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {users.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No users found</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UsersTab;
