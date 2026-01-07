import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Mail, X, UserPlus, Loader2, Clock, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { searchUsersByEmail, getUsersByIds } from '@/services/userService';
import { updateProjectSharingWithInvites, fetchProjectSharing } from '@/services/firestoreService';
import { sendProjectInviteEmailBatch } from '@/services/emailService';
import { AppUser } from '@/types/user';

interface ShareProjectDialogProps {
  open: boolean;
  onClose: () => void;
  project: {
    id: string;
    name: string;
    ownerId: string;
    sharedWith: string[];
  };
  onSharingUpdated: () => void;
}

// Simple email validation
const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const ShareProjectDialog = ({
  open,
  onClose,
  project,
  onSharingUpdated,
}: ShareProjectDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [emailInput, setEmailInput] = useState('');
  const [searchResults, setSearchResults] = useState<AppUser[]>([]);
  const [sharedUsers, setSharedUsers] = useState<AppUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [pendingInvites, setPendingInvites] = useState<string[]>([]);
  const [originalPendingInvites, setOriginalPendingInvites] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load current shared users and pending invites
  useEffect(() => {
    const loadSharingData = async () => {
      try {
        setLoading(true);

        // Fetch project sharing info including pending invites
        const sharingInfo = await fetchProjectSharing(project.id);
        const currentSharedWith = sharingInfo?.sharedWith || [];
        const currentPendingInvites = sharingInfo?.pendingInvites || [];

        // Load shared users
        if (currentSharedWith.length > 0) {
          const users = await getUsersByIds(currentSharedWith);
          setSharedUsers(users);
        } else {
          setSharedUsers([]);
        }

        setSelectedUserIds(currentSharedWith);
        setPendingInvites(currentPendingInvites);
        setOriginalPendingInvites(currentPendingInvites);
      } catch (error) {
        console.error('Error loading sharing data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (open) {
      loadSharingData();
      setEmailInput('');
      setSearchResults([]);
    }
  }, [open, project.id]);

  // Search users as they type
  useEffect(() => {
    const search = async () => {
      if (emailInput.length < 2) {
        setSearchResults([]);
        return;
      }

      try {
        setSearching(true);
        const results = await searchUsersByEmail(emailInput);
        // Filter out owner, self, and already shared users
        const filtered = results.filter(
          (u) =>
            u.uid !== project.ownerId &&
            u.uid !== user?.uid &&
            !selectedUserIds.includes(u.uid)
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearching(false);
      }
    };

    const debounce = setTimeout(search, 300);
    return () => clearTimeout(debounce);
  }, [emailInput, project.ownerId, user?.uid, selectedUserIds]);

  const handleAddUser = (userToAdd: AppUser) => {
    if (!selectedUserIds.includes(userToAdd.uid)) {
      setSelectedUserIds((prev) => [...prev, userToAdd.uid]);
      setSharedUsers((prev) => [...prev, userToAdd]);
    }
    setEmailInput('');
    setSearchResults([]);
  };

  const handleInviteByEmail = () => {
    const email = emailInput.trim().toLowerCase();

    if (!isValidEmail(email)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid email address',
        variant: 'destructive',
      });
      return;
    }

    // Check if already invited
    if (pendingInvites.includes(email)) {
      toast({
        title: 'Already invited',
        description: 'This email has already been invited',
        variant: 'destructive',
      });
      return;
    }

    // Check if user is already shared (by email)
    const alreadyShared = sharedUsers.find(
      (u) => u.email.toLowerCase() === email
    );
    if (alreadyShared) {
      toast({
        title: 'Already shared',
        description: 'This user already has access',
        variant: 'destructive',
      });
      return;
    }

    // Check if it's the owner's email
    if (user?.email?.toLowerCase() === email) {
      toast({
        title: 'Cannot invite yourself',
        description: 'You already own this project',
        variant: 'destructive',
      });
      return;
    }

    // Add to pending invites
    setPendingInvites((prev) => [...prev, email]);
    setEmailInput('');
    setSearchResults([]);

    toast({
      title: 'Invitation added',
      description: `${email} will get access when they sign up`,
    });
  };

  const handleRemoveUser = (uid: string) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== uid));
    setSharedUsers((prev) => prev.filter((u) => u.uid !== uid));
  };

  const handleRemoveInvite = (email: string) => {
    setPendingInvites((prev) => prev.filter((e) => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // If there are search results and input matches one, add that user
      if (searchResults.length > 0) {
        handleAddUser(searchResults[0]);
      } else if (isValidEmail(emailInput)) {
        // Otherwise invite by email
        handleInviteByEmail();
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Find newly added invites (not in original list)
      const newInvites = pendingInvites.filter(
        (email) => !originalPendingInvites.includes(email)
      );

      // Update sharing in Firestore
      await updateProjectSharingWithInvites(project.id, selectedUserIds, pendingInvites);

      // Send email notifications to new invites (non-blocking)
      if (newInvites.length > 0) {
        sendProjectInviteEmailBatch(newInvites, project.name, project.id)
          .then((result) => {
            if (result.success && result.results.sent.length > 0) {
              console.log(`Sent invitation emails to: ${result.results.sent.join(', ')}`);
            }
            if (result.results.failed.length > 0) {
              console.warn('Failed to send some emails:', result.results.failed);
            }
          })
          .catch((err) => {
            console.error('Error sending invite emails:', err);
          });
      }

      toast({
        title: 'Success',
        description: newInvites.length > 0
          ? `Project sharing updated. Invitations sent to ${newInvites.length} email(s).`
          : 'Project sharing updated',
      });
      onSharingUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating sharing:', error);
      toast({
        title: 'Error',
        description: 'Failed to update sharing',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
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

  // Check if there are changes
  const originalSharedWith = project.sharedWith || [];
  const hasChanges =
    JSON.stringify([...selectedUserIds].sort()) !==
      JSON.stringify([...originalSharedWith].sort()) ||
    pendingInvites.length > 0;

  const totalShared = sharedUsers.length + pendingInvites.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share Project</DialogTitle>
          <DialogDescription>
            Share "{project.name}" with other users. Enter their email to invite them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email input */}
          <div className="space-y-2">
            <Label htmlFor="email">Invite by email</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter email address..."
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                )}
              </div>
              <Button
                onClick={handleInviteByEmail}
                disabled={!isValidEmail(emailInput)}
                size="sm"
              >
                <UserPlus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Press Enter or click + to invite. They'll get access when they sign up.
            </p>
          </div>

          {/* Search results - existing users */}
          {searchResults.length > 0 && (
            <div className="border rounded-md">
              <div className="px-3 py-2 bg-gray-50 border-b">
                <span className="text-xs font-medium text-gray-600">
                  Existing users found:
                </span>
              </div>
              <ScrollArea className="max-h-32">
                {searchResults.map((searchUser) => (
                  <div
                    key={searchUser.uid}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 cursor-pointer"
                    onClick={() => handleAddUser(searchUser)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={searchUser.photoURL} />
                        <AvatarFallback>
                          {getInitials(searchUser.displayName, searchUser.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">
                          {searchUser.displayName}
                        </div>
                        <div className="text-xs text-gray-500">{searchUser.email}</div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <UserPlus className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </ScrollArea>
            </div>
          )}

          <Separator />

          {/* Currently shared users and pending invites */}
          <div className="space-y-2">
            <Label>Shared with ({totalShared})</Label>
            {loading ? (
              <div className="text-center py-4">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
              </div>
            ) : totalShared > 0 ? (
              <ScrollArea className="max-h-48">
                <div className="space-y-2">
                  {/* Active shared users */}
                  {sharedUsers.map((sharedUser) => (
                    <div
                      key={sharedUser.uid}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={sharedUser.photoURL} />
                          <AvatarFallback>
                            {getInitials(sharedUser.displayName, sharedUser.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {sharedUser.displayName}
                            </span>
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              <UserCheck className="h-3 w-3 mr-1" />
                              Active
                            </Badge>
                          </div>
                          <div className="text-xs text-gray-500">{sharedUser.email}</div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveUser(sharedUser.uid)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  {/* Pending invites */}
                  {pendingInvites.map((email) => (
                    <div
                      key={email}
                      className="flex items-center justify-between p-2 bg-yellow-50 rounded-md border border-yellow-200"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 bg-yellow-100">
                          <AvatarFallback className="bg-yellow-100 text-yellow-700">
                            {email.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{email}</span>
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 py-0 border-yellow-400 text-yellow-700"
                            >
                              <Clock className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          </div>
                          <div className="text-xs text-yellow-600">
                            Will get access when they sign up
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveInvite(email)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                This project is not shared with anyone yet
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ShareProjectDialog;
