import React, { useState } from "react";
import {
  Box,
  Typography,
  Checkbox,
  CircularProgress,
  Toolbar,
  IconButton,
  Tooltip,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
} from "@mui/material";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import CloseIcon from "@mui/icons-material/Close";
import PrintIcon from "@mui/icons-material/Print";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { Virtuoso } from "react-virtuoso";
import type { Email } from "../types";
import { useSettingsStore } from "../stores/settingsStore";
import { formatEmailViewerDateTime } from "../utils/dateFormatting";
import { MoveFolderDialog } from "./MoveFolderDialog";
import { EmailListItem } from "./EmailListItem";

interface EmailListProps {
  emails: Email[];
  selectedEmail: string | null;
  onSelectEmail: (emailId: string) => void;
  onToggleStar: (emailId: string, isFlagged: boolean) => void;
  onBulkDelete?: (emailIds: string[]) => void;
  onBulkMarkRead?: (emailIds: string[], isRead: boolean) => void;
  onBulkStar?: (emailIds: string[], isFlagged: boolean) => void;
  isLoading?: boolean;
}

export const EmailList: React.FC<EmailListProps> = ({
  emails,
  selectedEmail,
  onSelectEmail,
  onToggleStar,
  onBulkDelete,
  onBulkMarkRead,
  onBulkStar,
  isLoading = false,
}) => {
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [emailToMove, setEmailToMove] = useState<Email | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    email: Email;
  } | null>(null);
  const { settings } = useSettingsStore();

  const handleToggleSelect = (emailId: string) => {
    setSelectedEmails((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(emailId)) {
        newSet.delete(emailId);
      } else {
        newSet.add(emailId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedEmails.size === emails.length) {
      setSelectedEmails(new Set());
    } else {
      setSelectedEmails(new Set(emails.map((e) => e.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedEmails(new Set());
  };

  const handleBulkDeleteClick = () => {
    setDeleteConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = () => {
    if (onBulkDelete && selectedEmails.size > 0) {
      onBulkDelete(Array.from(selectedEmails));
      setSelectedEmails(new Set());
    }
    setDeleteConfirmOpen(false);
  };

  const handleBulkDeleteCancel = () => {
    setDeleteConfirmOpen(false);
  };

  const handleBulkMarkRead = (isRead: boolean) => {
    if (onBulkMarkRead && selectedEmails.size > 0) {
      onBulkMarkRead(Array.from(selectedEmails), isRead);
      setSelectedEmails(new Set());
    }
  };

  const handleBulkStar = (isFlagged: boolean) => {
    if (onBulkStar && selectedEmails.size > 0) {
      onBulkStar(Array.from(selectedEmails), isFlagged);
      setSelectedEmails(new Set());
    }
  };

  const handlePrintEmail = (email: Email) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const emailDate = email.date ? formatEmailViewerDateTime(email.date, settings) : 'Unknown date';
    const fromName = email.from[0]?.name || email.from[0]?.address || 'Unknown';
    const toList = email.to?.map(t => t.name || t.address).join(', ') || 'Unknown';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print: ${email.subject || '(No Subject)'}</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              line-height: 1.6;
              padding: 20px;
              max-width: 800px;
              margin: 0 auto;
            }
            h1 { font-size: 24px; margin-bottom: 20px; }
            .meta { 
              border-bottom: 2px solid #ddd; 
              padding-bottom: 15px; 
              margin-bottom: 20px;
            }
            .meta-row { margin: 5px 0; }
            .label { font-weight: bold; }
            .content { margin-top: 20px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${email.subject || '(No Subject)'}</h1>
          <div class="meta">
            <div class="meta-row"><span class="label">From:</span> ${fromName}</div>
            <div class="meta-row"><span class="label">To:</span> ${toList}</div>
            ${email.cc && email.cc.length > 0 ? `<div class="meta-row"><span class="label">Cc:</span> ${email.cc.map(c => c.name || c.address).join(', ')}</div>` : ''}
            <div class="meta-row"><span class="label">Date:</span> ${emailDate}</div>
          </div>
          <div class="content">
            ${email.htmlBody || email.textBody?.replace(/\n/g, '<br>') || '(No content)'}
          </div>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleMoveEmail = (email: Email) => {
    setEmailToMove(email);
    setMoveFolderDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          p: 4,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (emails.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          p: 4,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          No emails in this folder
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Bulk Actions Toolbar */}
      <Collapse in={selectedEmails.size > 0} unmountOnExit>
        <Toolbar
          sx={{
            bgcolor: "primary.dark",
            borderBottom: 1,
            borderColor: "divider",
            px: 3,
            minHeight: "56px !important",
          }}
        >
          <Typography variant="body2" sx={{ flex: 1 }}>
            {selectedEmails.size} selected
          </Typography>

          <Tooltip title="Mark as read">
            <IconButton
              size="small"
              onClick={() => handleBulkMarkRead(true)}
              sx={{ color: "inherit" }}
            >
              <MarkEmailReadIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Mark as unread">
            <IconButton
              size="small"
              onClick={() => handleBulkMarkRead(false)}
              sx={{ color: "inherit" }}
            >
              <MarkEmailUnreadIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Star">
            <IconButton
              size="small"
              onClick={() => handleBulkStar(true)}
              sx={{ color: "inherit" }}
            >
              <StarIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Unstar">
            <IconButton
              size="small"
              onClick={() => handleBulkStar(false)}
              sx={{ color: "inherit" }}
            >
              <StarBorderIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Delete">
            <IconButton
              size="small"
              onClick={handleBulkDeleteClick}
              sx={{ color: "inherit" }}
            >
              <DeleteIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Clear selection">
            <IconButton
              size="small"
              onClick={handleClearSelection}
              sx={{ color: "inherit", ml: 2 }}
            >
              <CloseIcon />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </Collapse>

      {/* Select All Toolbar */}
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          px: 3,
          py: 1,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Checkbox
          checked={emails.length > 0 && selectedEmails.size === emails.length}
          indeterminate={
            selectedEmails.size > 0 && selectedEmails.size < emails.length
          }
          onChange={handleSelectAll}
        />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
          Select all
        </Typography>
      </Box>

      <Virtuoso
        style={{ flex: 1 }}
        data={emails}
        computeItemKey={(_index, email) => email.id}
        itemContent={(_index, email) => (
          <EmailListItem
            key={email.id}
            initialEmail={email}
            isSelected={selectedEmail === email.id}
            isChecked={selectedEmails.has(email.id)}
            onSelect={onSelectEmail}
            onToggleCheck={handleToggleSelect}
          />
        )}
      />

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => {
          if (contextMenu) {
            onSelectEmail(contextMenu.email.id);
            setContextMenu(null);
          }
        }}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          Open
        </MenuItem>
        
        <MenuItem onClick={() => {
          if (contextMenu && onBulkMarkRead) {
            onBulkMarkRead([contextMenu.email.id], !contextMenu.email.isRead);
            setContextMenu(null);
          }
        }}>
          <ListItemIcon>
            {contextMenu?.email.isRead ? (
              <MarkEmailUnreadIcon fontSize="small" />
            ) : (
              <MarkEmailReadIcon fontSize="small" />
            )}
          </ListItemIcon>
          Mark as {contextMenu?.email.isRead ? 'Unread' : 'Read'}
        </MenuItem>
        
        <MenuItem onClick={() => {
          if (contextMenu) {
            onToggleStar(contextMenu.email.id, !contextMenu.email.isFlagged);
            setContextMenu(null);
          }
        }}>
          <ListItemIcon>
            {contextMenu?.email.isFlagged ? (
              <StarBorderIcon fontSize="small" />
            ) : (
              <StarIcon fontSize="small" />
            )}
          </ListItemIcon>
          {contextMenu?.email.isFlagged ? 'Unstar' : 'Star'}
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => {
          if (contextMenu) {
            handleMoveEmail(contextMenu.email);
            setContextMenu(null);
          }
        }}>
          <ListItemIcon>
            <DriveFileMoveIcon fontSize="small" />
          </ListItemIcon>
          Move to Folder...
        </MenuItem>
        
        <MenuItem onClick={() => {
          if (contextMenu) {
            handlePrintEmail(contextMenu.email);
            setContextMenu(null);
          }
        }}>
          <ListItemIcon>
            <PrintIcon fontSize="small" />
          </ListItemIcon>
          Print
        </MenuItem>
        
        <Divider />
        
        <MenuItem onClick={() => {
          if (contextMenu && onBulkDelete) {
            onBulkDelete([contextMenu.email.id]);
            setContextMenu(null);
          }
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={handleBulkDeleteCancel}
        aria-labelledby="delete-dialog-title"
        aria-describedby="delete-dialog-description"
      >
        <DialogTitle id="delete-dialog-title">
          Delete {selectedEmails.size} email{selectedEmails.size > 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-dialog-description">
            Are you sure you want to delete {selectedEmails.size} selected email{selectedEmails.size > 1 ? 's' : ''}? 
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleBulkDeleteCancel} color="primary">
            Cancel
          </Button>
          <Button onClick={handleBulkDeleteConfirm} color="error" variant="contained" autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Folder Dialog */}
      {emailToMove && (
        <MoveFolderDialog
          open={moveFolderDialogOpen}
          onClose={() => {
            setMoveFolderDialogOpen(false);
            setEmailToMove(null);
          }}
          emailId={emailToMove.id}
          currentFolderId={emailToMove.folderId}
          accountId={emailToMove.emailAccountId}
          onSuccess={() => {
            // Optionally refresh the email list
            window.location.reload();
          }}
        />
      )}
    </Box>
  );
};
