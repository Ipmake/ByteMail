import React, { useState, useEffect } from 'react';
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Badge,
  Box,
  Typography,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Alert,
} from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';
import SendIcon from '@mui/icons-material/Send';
import DraftsIcon from '@mui/icons-material/Drafts';
import DeleteIcon from '@mui/icons-material/Delete';
import StarIcon from '@mui/icons-material/Star';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { emailsApi } from '../api';
import type { Folder } from '../types';

interface FolderListProps {
  accountName: string;
  accountId: string;
  folders: Folder[];
  selectedFolder: string | null;
  onSelectFolder: (folderId: string) => void;
  onFoldersChanged: () => void;
}

const getFolderIcon = (specialUse?: string | null, folderName?: string, folderPath?: string) => {
  // Check specialUse first
  const upperSpecialUse = specialUse?.toUpperCase();
  
  switch (upperSpecialUse) {
    case 'INBOX':
    case '\\INBOX':
      return <InboxIcon fontSize="small" />;
    case 'SENT':
    case '\\SENT':
      return <SendIcon fontSize="small" />;
    case 'DRAFTS':
    case '\\DRAFTS':
      return <DraftsIcon fontSize="small" />;
    case 'TRASH':
    case '\\TRASH':
      return <DeleteIcon fontSize="small" />;
    case 'JUNK':
    case '\\JUNK':
    case 'SPAM':
      return <StarIcon fontSize="small" />;
  }
  
  // Fallback: check folder name/path if specialUse not set
  const upperName = folderName?.toUpperCase() || '';
  const upperPath = folderPath?.toUpperCase() || '';
  
  if (upperName === 'INBOX' || upperPath === 'INBOX') {
    return <InboxIcon fontSize="small" />;
  } else if (upperName === 'SENT' || upperName === 'SENT ITEMS' || upperPath.includes('SENT')) {
    return <SendIcon fontSize="small" />;
  } else if (upperName === 'DRAFTS' || upperPath.includes('DRAFT')) {
    return <DraftsIcon fontSize="small" />;
  } else if (upperName === 'TRASH' || upperName === 'DELETED' || upperPath.includes('TRASH')) {
    return <DeleteIcon fontSize="small" />;
  } else if (upperName === 'JUNK' || upperName === 'SPAM' || upperPath.includes('JUNK') || upperPath.includes('SPAM')) {
    return <StarIcon fontSize="small" />;
  }
  
  return <FolderIcon fontSize="small" />;
};

export const FolderList: React.FC<FolderListProps> = ({
  accountName,
  accountId,
  folders,
  selectedFolder,
  onSelectFolder,
  onFoldersChanged,
}) => {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(`folder-expand-${accountId}`);
    return saved === null ? true : saved === 'true';
  });
  
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [folderMenuAnchor, setFolderMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedMenuFolder, setSelectedMenuFolder] = useState<Folder | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [error, setError] = useState('');
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    localStorage.setItem(`folder-expand-${accountId}`, isExpanded.toString());
  }, [isExpanded, accountId]);
  
  const specialFolders = folders.filter((f) => f.specialUse);
  const regularFolders = folders.filter((f) => !f.specialUse);

  if (folders.length === 0) return null;

  const handleAccountMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleFolderMenuClick = (event: React.MouseEvent<HTMLElement>, folder: Folder) => {
    event.stopPropagation();
    setSelectedMenuFolder(folder);
    setFolderMenuAnchor(event.currentTarget);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    setIsWorking(true);
    setError('');
    try {
      await emailsApi.createFolder(accountId, newFolderName);
      setCreateDialogOpen(false);
      setNewFolderName('');
      onFoldersChanged();
    } catch (err) {
      setError('Failed to create folder');
      console.error(err);
    } finally {
      setIsWorking(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!selectedMenuFolder || !newFolderName.trim()) {
      setError('Folder name cannot be empty');
      return;
    }

    setIsWorking(true);
    setError('');
    try {
      await emailsApi.renameFolder(selectedMenuFolder.id, newFolderName);
      setRenameDialogOpen(false);
      setNewFolderName('');
      setSelectedMenuFolder(null);
      onFoldersChanged();
    } catch (err) {
      setError('Failed to rename folder');
      console.error(err);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!selectedMenuFolder) return;

    setIsWorking(true);
    setError('');
    try {
      await emailsApi.deleteFolder(selectedMenuFolder.id);
      setDeleteDialogOpen(false);
      setSelectedMenuFolder(null);
      onFoldersChanged();
    } catch (err) {
      setError('Failed to delete folder');
      console.error(err);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Box sx={{ mb: 0 }}>
      <ListItemButton
        onClick={() => setIsExpanded(!isExpanded)}
        sx={{
          px: 2,
          py: 1.5,
          mb: 0,
          bgcolor: 'rgba(160, 160, 160, 0.05)',
          borderRadius: 0,
          '&:hover': {
            bgcolor: 'rgba(160, 160, 160, 0.1)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <ListItemText
              primary={accountName}
              primaryTypographyProps={{
                fontWeight: 600,
                fontSize: '0.875rem',
                noWrap: true,
              }}
            />
          </Box>
          <IconButton
            size="small"
            onClick={handleAccountMenuClick}
            sx={{ mr: 0 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          {isExpanded ? <ExpandLess /> : <ExpandMore />}
        </Box>
      </ListItemButton>

      {/* Account Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem
          onClick={() => {
            setAnchorEl(null);
            setCreateDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <CreateNewFolderIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>New Folder</ListItemText>
        </MenuItem>
      </Menu>

      {/* Folder Context Menu */}
      <Menu
        anchorEl={folderMenuAnchor}
        open={Boolean(folderMenuAnchor)}
        onClose={() => setFolderMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setFolderMenuAnchor(null);
            if (selectedMenuFolder) {
              setNewFolderName(selectedMenuFolder.name);
              setRenameDialogOpen(true);
            }
          }}
          disabled={selectedMenuFolder?.specialUse !== null}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setFolderMenuAnchor(null);
            setDeleteDialogOpen(true);
          }}
          disabled={selectedMenuFolder?.specialUse !== null}
        >
          <ListItemIcon>
            <DeleteOutlineIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* Folder List */}
      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
        <List dense sx={{ px: 0.5, pb: 1 }}>
          {/* Special Folders */}
          {specialFolders.map((folder) => (
            <ListItemButton
              key={folder.id}
              selected={selectedFolder === folder.id}
              onClick={() => onSelectFolder(folder.id)}
              sx={{
                borderRadius: 1,
                pl: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.dark',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {getFolderIcon(folder.specialUse, folder.name, folder.path)}
              </ListItemIcon>
              <ListItemText
                primary={folder.name}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: selectedFolder === folder.id ? 600 : 400,
                }}
              />
              {folder.unreadCount > 0 && (
                <Badge badgeContent={folder.unreadCount} color="primary" />
              )}
            </ListItemButton>
          ))}

          {/* Regular Folders */}
          {regularFolders.length > 0 && specialFolders.length > 0 && (
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" color="text.secondary">
                FOLDERS
              </Typography>
            </Box>
          )}
          {regularFolders.map((folder) => (
            <ListItemButton
              key={folder.id}
              selected={selectedFolder === folder.id}
              onClick={() => onSelectFolder(folder.id)}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                pl: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.dark',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {getFolderIcon(folder.specialUse, folder.name, folder.path)}
              </ListItemIcon>
              <ListItemText
                primary={folder.name}
                primaryTypographyProps={{
                  fontSize: '0.875rem',
                  fontWeight: selectedFolder === folder.id ? 600 : 400,
                }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {folder.unreadCount > 0 && (
                  <Badge badgeContent={folder.unreadCount} color="primary" />
                )}
                <IconButton
                  size="small"
                  onClick={(e) => handleFolderMenuClick(e, folder)}
                  sx={{ opacity: 0.7, '&:hover': { opacity: 1 } }}
                >
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Collapse>

      {/* Create Folder Dialog */}
      <Dialog open={createDialogOpen} onClose={() => !isWorking && setCreateDialogOpen(false)}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="Folder Name"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            disabled={isWorking}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleCreateFolder();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} disabled={isWorking}>
            Cancel
          </Button>
          <Button onClick={handleCreateFolder} variant="contained" disabled={isWorking}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={renameDialogOpen} onClose={() => !isWorking && setRenameDialogOpen(false)}>
        <DialogTitle>Rename Folder</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <TextField
            autoFocus
            margin="dense"
            label="New Folder Name"
            fullWidth
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            disabled={isWorking}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameFolder();
              }
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialogOpen(false)} disabled={isWorking}>
            Cancel
          </Button>
          <Button onClick={handleRenameFolder} variant="contained" disabled={isWorking}>
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Folder Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !isWorking && setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Folder</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography>
            Are you sure you want to delete the folder "{selectedMenuFolder?.name}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={isWorking}>
            Cancel
          </Button>
          <Button onClick={handleDeleteFolder} variant="contained" color="error" disabled={isWorking}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
