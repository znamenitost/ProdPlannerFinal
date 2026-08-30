import { useCallback } from 'react';
import { openTaskFile, openTaskFolder } from '../utils/taskFileOpen';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { formatUserActionError } from '../utils/actionError';

export default function useTaskFileOpen() {
  const { showError } = useUiFeedback();

  const handleOpenFile = useCallback((row) => {
    void openTaskFile(row).catch((err) => {
      showError(formatUserActionError(err, 'Не удалось открыть файл'));
    });
  }, [showError]);

  const handleOpenFolder = useCallback((row) => {
    void openTaskFolder(row).catch((err) => {
      showError(formatUserActionError(err, 'Не удалось открыть папку'));
    });
  }, [showError]);

  return { handleOpenFile, handleOpenFolder };
}
