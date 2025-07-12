import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Save, RotateCcw, Clock, AlertCircle, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useProject } from '@/contexts/ProjectContext';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface SaveDiscardActionBarProps {
  className?: string;
  position?: 'bottom' | 'top';
  variant?: 'banner' | 'compact' | 'inline';
  collapsible?: boolean;
}

export const SaveDiscardActionBar: React.FC<SaveDiscardActionBarProps> = ({
  className,
  position = 'bottom',
  variant = 'banner',
  collapsible = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const {
    hasUnsavedChanges,
    lastSavedAt,
    saveToFirebase,
    discardChanges,
    isSaving,
    currentProjectId
  } = useProject();

  // Don't render if no unsaved changes or no project selected
  if (!hasUnsavedChanges || !currentProjectId) {
    return null;
  }

  const handleSave = async () => {
    await saveToFirebase();
  };

  const handleDiscard = () => {
    if (window.confirm('Are you sure you want to discard all unsaved changes? This action cannot be undone.')) {
      discardChanges();
    }
  };

  const getLastSavedText = () => {
    if (!lastSavedAt) return 'Never saved';
    
    try {
      return `Last saved ${formatDistanceToNow(lastSavedAt, { addSuffix: true })}`;
    } catch (error) {
      return 'Last saved recently';
    }
  };

  // Compact inline variant for integration into headers
  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="flex items-center gap-1 text-orange-600">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium">Unsaved</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          className="h-7 px-2 text-xs bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
        >
          {isSaving ? (
            <div className="animate-spin h-3 w-3 border border-white border-t-transparent rounded-full"></div>
          ) : (
            <>
              <Save className="h-3 w-3 mr-1" />
              Save
            </>
          )}
        </Button>
      </div>
    );
  }

  // Inline variant for integration into existing action bars
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3 px-3 py-2 bg-orange-50 border border-orange-200 rounded-md', className)}>
        <div className="flex items-center gap-2 text-orange-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm font-medium">Unsaved changes</span>
        </div>
        {lastSavedAt && (
          <div className="flex items-center gap-1 text-gray-600 text-xs">
            <Clock className="h-3 w-3" />
            <span>{getLastSavedText()}</span>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDiscard}
            disabled={isSaving}
            className="h-7 text-xs text-gray-700 hover:text-red-600 hover:border-red-300 bg-white"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Discard
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isSaving ? (
              <>
                <div className="animate-spin h-3 w-3 mr-1 border border-white border-t-transparent rounded-full"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3 w-3 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // Banner variant (default) - full width, non-overlapping
  return (
    <div className={cn('w-full animate-in slide-in-from-top-2', className)}>
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg overflow-hidden">
        {/* Collapsible banner header */}
        {collapsible && (
          <div 
            className="flex items-center justify-between p-2 cursor-pointer hover:bg-orange-100/50 transition-colors"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <div className="flex items-center gap-2 text-orange-700">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Unsaved changes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Click to {isCollapsed ? 'expand' : 'collapse'}</span>
              {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </div>
          </div>
        )}

        {/* Main content */}
        {(!collapsible || !isCollapsed) && (
          <div className="p-3">
            <div className="flex items-center justify-between">
              {/* Left: Unsaved changes indicator with last saved info */}
              <div className="flex items-center gap-3">
                {!collapsible && (
                  <div className="flex items-center gap-2 text-orange-700">
                    <div className="relative">
                      <AlertCircle className="h-4 w-4" />
                      <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
                    </div>
                    <span className="text-sm font-medium">Unsaved changes</span>
                  </div>
                )}

                {/* Last saved indicator */}
                {lastSavedAt && (
                  <div className="flex items-center gap-1 text-gray-600 text-xs">
                    <Clock className="h-3 w-3" />
                    <span>{getLastSavedText()}</span>
                  </div>
                )}
              </div>

              {/* Right: Action buttons */}
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDiscard}
                  disabled={isSaving}
                  className="text-gray-700 hover:text-red-600 hover:border-red-300 bg-white"
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Discard
                </Button>
                
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                >
                  {isSaving ? (
                    <>
                      <div className="animate-spin h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-1" />
                      Save to Firebase
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Optional: Project title component with unsaved indicator
interface ProjectTitleWithIndicatorProps {
  title: string;
  className?: string;
}

export const ProjectTitleWithIndicator: React.FC<ProjectTitleWithIndicatorProps> = ({
  title,
  className
}) => {
  const { hasUnsavedChanges } = useProject();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <h1 className="text-xl font-semibold">{title}</h1>
      {hasUnsavedChanges && (
        <div className="flex items-center gap-1 text-orange-600">
          <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium">Unsaved</span>
        </div>
      )}
    </div>
  );
};

// New: Compact save button for integration into existing toolbars
interface CompactSaveButtonProps {
  className?: string;
  showLabel?: boolean;
}

export const CompactSaveButton: React.FC<CompactSaveButtonProps> = ({
  className,
  showLabel = true
}) => {
  const {
    hasUnsavedChanges,
    saveToFirebase,
    isSaving,
    currentProjectId
  } = useProject();

  if (!hasUnsavedChanges || !currentProjectId) {
    return null;
  }

  const handleSave = async () => {
    await saveToFirebase();
  };

  return (
    <Button
      onClick={handleSave}
      disabled={isSaving}
      size="sm"
      className={cn(
        'relative bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
        className
      )}
    >
      {/* Pulsing indicator */}
      <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
      
      {isSaving ? (
        <>
          <div className="animate-spin h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full"></div>
          {showLabel && 'Saving...'}
        </>
      ) : (
        <>
          <Save className="h-4 w-4 mr-1" />
          {showLabel && 'Save'}
        </>
      )}
    </Button>
  );
}; 