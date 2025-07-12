import { useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/ProjectContext';

interface NavigationGuardOptions {
  message?: string;
  when?: boolean;
  onBeforeLeave?: () => Promise<boolean>;
}

export const useNavigationGuard = (options: NavigationGuardOptions = {}) => {
  const { hasUnsavedChanges, saveToFirebase, discardChanges } = useProject();
  
  const {
    message = 'You have unsaved changes. Do you want to save them before leaving?',
    when = hasUnsavedChanges,
    onBeforeLeave
  } = options;

  const handleBeforeUnload = useCallback((event: BeforeUnloadEvent) => {
    if (when) {
      event.preventDefault();
      event.returnValue = message;
      return message;
    }
  }, [when, message]);

  const showSaveDialog = useCallback(async (): Promise<boolean> => {
    if (!when) return true;

    // Custom confirmation dialog with save/discard/cancel options
    const choice = await new Promise<'save' | 'discard' | 'cancel'>((resolve) => {
      const dialog = document.createElement('div');
      dialog.innerHTML = `
        <div style="
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        ">
          <div style="
            background: white;
            padding: 24px;
            border-radius: 8px;
            max-width: 400px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          ">
            <h3 style="font-size: 18px; font-weight: 600; margin-bottom: 12px;">Unsaved Changes</h3>
            <p style="color: #6b7280; margin-bottom: 20px;">You have unsaved changes. What would you like to do?</p>
            <div style="display: flex; gap: 8px; justify-content: flex-end;">
              <button id="cancel-btn" style="
                padding: 8px 16px;
                border: 1px solid #d1d5db;
                background: white;
                border-radius: 6px;
                cursor: pointer;
              ">Cancel</button>
              <button id="discard-btn" style="
                padding: 8px 16px;
                border: 1px solid #ef4444;
                background: white;
                color: #ef4444;
                border-radius: 6px;
                cursor: pointer;
              ">Discard</button>
              <button id="save-btn" style="
                padding: 8px 16px;
                border: none;
                background: #3b82f6;
                color: white;
                border-radius: 6px;
                cursor: pointer;
              ">Save & Continue</button>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      const handleChoice = (choice: 'save' | 'discard' | 'cancel') => {
        document.body.removeChild(dialog);
        resolve(choice);
      };

      dialog.querySelector('#save-btn')?.addEventListener('click', () => handleChoice('save'));
      dialog.querySelector('#discard-btn')?.addEventListener('click', () => handleChoice('discard'));
      dialog.querySelector('#cancel-btn')?.addEventListener('click', () => handleChoice('cancel'));
    });

    switch (choice) {
      case 'save':
        const saved = await saveToFirebase();
        return saved;
      case 'discard':
        discardChanges();
        return true;
      case 'cancel':
      default:
        return false;
    }
  }, [when, saveToFirebase, discardChanges]);

  // Browser navigation guard (page refresh, close, etc.)
  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [handleBeforeUnload]);

  return {
    hasUnsavedChanges: when,
    showSaveDialog,
    canNavigate: !when
  };
};

// Hook for project switching with confirmation
export const useProjectSwitchGuard = () => {
  const { showSaveDialog } = useNavigationGuard();

  const confirmProjectSwitch = useCallback(async (newProjectId: string, switchFn: (id: string) => void) => {
    const canSwitch = await showSaveDialog();
    if (canSwitch) {
      switchFn(newProjectId);
    }
    return canSwitch;
  }, [showSaveDialog]);

  return { confirmProjectSwitch };
}; 