import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import { emailsApi } from '../api';
import type { Folder } from '../types';

interface MoveFolderDialogProps {
  open: boolean;
  onClose: () => void;
  emailId: string;
  currentFolderId: string;
  accountId: string;
  onSuccess?: () => void;
}

export const MoveFolderDialog: React.FC<MoveFolderDialogProps> = ({
  open,
  onClose,
  emailId,
  currentFolderId,
  accountId,
  onSuccess,
}) => {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  const loadFolders = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await emailsApi.getFolders(accountId);
      // Filter out the current folder
      setFolders(data.filter(f => f.id !== currentFolderId));
    } catch (err) {
      console.error('Failed to load folders:', err);
      setError('Failed to load folders');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && accountId) {
      loadFolders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, accountId]);

  const handleMove = async () => {
    if (!selectedFolder) return;
    
    setIsMoving(true);
    setError('');
    try {
      await emailsApi.moveEmail(emailId, selectedFolder);
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to move email:', err);
      setError('Failed to move email');
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Move to Folder</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : folders.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
            No other folders available
          </Typography>
        ) : (
          <List>
            {folders.map((folder) => (
              <ListItemButton
                key={folder.id}
                selected={selectedFolder === folder.id}
                onClick={() => setSelectedFolder(folder.id)}
              >
                <FolderIcon sx={{ mr: 2, color: 'text.secondary' }} />
                <ListItemText 
                  primary={folder.name}
                  secondary={folder.path}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isMoving}>
          Cancel
        </Button>
        <Button
          onClick={handleMove}
          variant="contained"
          disabled={!selectedFolder || isMoving}
        >
          {isMoving ? <CircularProgress size={20} /> : 'Move'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
