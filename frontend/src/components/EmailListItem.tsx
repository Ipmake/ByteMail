import React, { useState } from "react";
import {
  ListItemButton,
  Box,
  Typography,
  Checkbox,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import FolderIcon from "@mui/icons-material/Folder";
import MailIcon from "@mui/icons-material/Mail";
import type { Email } from "../types";
import { useSettingsStore } from "../stores/settingsStore";
import { formatEmailListDate, formatEmailViewerDateTime } from "../utils/dateFormatting";
import { emailsApi } from "../api";
import { MoveFolderDialog } from "./MoveFolderDialog";

interface EmailListItemProps {
  initialEmail: Email;
  isSelected: boolean;
  isChecked: boolean;
  onSelect: (emailId: string) => void;
  onToggleCheck: (emailId: string) => void;
}

const getInitials = (email: string) => {
  return email.charAt(0).toUpperCase();
};

const EmailListItemComponent: React.FC<EmailListItemProps> = ({
  initialEmail,
  isSelected,
  isChecked,
  onSelect,
  onToggleCheck,
}) => {
  // Each row has COMPLETELY independent state
  // Once initialized, it never syncs with props - it's fully autonomous
  const [email] = useState(initialEmail);
  
  // Debug: log email properties on mount
  React.useEffect(() => {
    console.log('EmailListItem mounted with email:', {
      id: email.id,
      emailAccountId: email.emailAccountId,
      folderId: email.folderId,
      subject: email.subject
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const [isFlagged, setIsFlagged] = useState(initialEmail.isFlagged);
  const [isRead, setIsRead] = useState(initialEmail.isRead);
  const [isDeleted, setIsDeleted] = useState(false);
  const [isMoved, setIsMoved] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const [isPrintLoading, setIsPrintLoading] = useState(false);
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const { settings } = useSettingsStore();

  const fromAddress = email.from && email.from[0];
  const fromName = fromAddress?.name || fromAddress?.address || "Unknown";

  const handleToggleStar = (e: React.MouseEvent) => {
    e.stopPropagation();
    const newFlagged = !isFlagged;
    // Update OWN state immediately
    setIsFlagged(newFlagged);
    // Call API directly
    emailsApi.markAsFlagged(email.id, newFlagged).catch(err => {
      console.error('Failed to toggle star:', err);
      // Revert on error
      setIsFlagged(!newFlagged);
    });
  };

  const handleToggleCheck = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleCheck(email.id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      mouseX: e.clientX - 2,
      mouseY: e.clientY - 4,
    });
  };

  const handleCloseMenu = () => {
    setContextMenu(null);
  };

  const handleToggleRead = () => {
    const newIsRead = !isRead;
    setIsRead(newIsRead);
    emailsApi.markAsRead(email.id, newIsRead).catch(err => {
      console.error('Failed to toggle read:', err);
      setIsRead(!newIsRead);
    });
    handleCloseMenu();
  };

  const handlePrintEmail = async () => {
    setIsPrintLoading(true);
    try {
      // Fetch full email content
      const fullEmail = await emailsApi.getById(email.id);
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setIsPrintLoading(false);
        return;
      }
      
      const emailDate = fullEmail.date ? formatEmailViewerDateTime(fullEmail.date, settings) : 'Unknown date';
      const fromName = fullEmail.from[0]?.name || fullEmail.from[0]?.address || 'Unknown';
      const toList = fullEmail.to?.map(t => t.name || t.address).join(', ') || 'Unknown';
      
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Print: ${fullEmail.subject || '(No Subject)'}</title>
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
            <h1>${fullEmail.subject || '(No Subject)'}</h1>
            <div class="meta">
              <div class="meta-row"><span class="label">From:</span> ${fromName}</div>
              <div class="meta-row"><span class="label">To:</span> ${toList}</div>
              ${fullEmail.cc && fullEmail.cc.length > 0 ? `<div class="meta-row"><span class="label">Cc:</span> ${fullEmail.cc.map(c => c.name || c.address).join(', ')}</div>` : ''}
              <div class="meta-row"><span class="label">Date:</span> ${emailDate}</div>
            </div>
            <div class="content">
              ${fullEmail.htmlBody || fullEmail.textBody?.replace(/\n/g, '<br>') || '(No content)'}
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
    } catch (error) {
      console.error('Failed to fetch email for printing:', error);
    } finally {
      setIsPrintLoading(false);
      handleCloseMenu();
    }
  };

  const handleMoveEmail = () => {
    setMoveFolderDialogOpen(true);
    handleCloseMenu();
  };

  const handleDeleteEmail = async () => {
    try {
      setIsDeleted(true);
      setDeleteConfirmOpen(false);
      await emailsApi.delete(email.id);
      handleCloseMenu();
    } catch (error) {
      console.error('Failed to delete email:', error);
      setIsDeleted(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirmOpen(true);
    handleCloseMenu();
  };

  return (
    <>
      <ListItemButton
        selected={isSelected}
        onClick={() => onSelect(email.id)}
        onContextMenu={handleContextMenu}
        disabled={isDeleted || isMoved}
        sx={{
        borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
        py: 2,
        px: 3,
        backgroundColor: isRead
          ? "transparent"
          : "rgba(160, 160, 160, 0.05)",
        opacity: (isDeleted || isMoved) ? 0.4 : 1,
        transition: "all 0.3s ease",
        position: "relative",
        "&:hover": {
          backgroundColor: (isDeleted || isMoved) ? "transparent" : "rgba(160, 160, 160, 0.1)",
        },
        "&.Mui-selected": {
          backgroundColor: "rgba(160, 160, 160, 0.15)",
          "&:hover": {
            backgroundColor: "rgba(160, 160, 160, 0.2)",
          },
        },
      }}
    >
      {isDeleted && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: "error.main",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Deleted
          </Typography>
        </Box>
      )}
      {isMoved && (
        <Box
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 1,
            pointerEvents: "none",
          }}
        >
          <Typography
            variant="h6"
            sx={{
              color: "success.main",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Moved
          </Typography>
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          gap: 2,
          width: "100%",
          alignItems: "center",
        }}
      >
        <Box
          onClick={handleToggleCheck}
          sx={{ display: "flex", alignItems: "center" }}
        >
          <Checkbox
            sx={{ p: 0 }}
            checked={isChecked}
          />
        </Box>

        <Box
          onClick={handleToggleStar}
          sx={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
          }}
        >
          {isFlagged ? (
            <StarIcon fontSize="small" sx={{ color: "warning.main" }} />
          ) : (
            <StarBorderIcon
              fontSize="small"
              sx={{ color: "text.disabled" }}
            />
          )}
        </Box>

        <Avatar
          sx={{
            width: 44,
            height: 44,
            bgcolor: "primary.main",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          {getInitials(fromName)}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 0.5,
            }}
          >
            <Typography
              variant="body2"
              sx={{
                fontWeight: isRead ? 400 : 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: "0.9375rem",
              }}
            >
              {fromName}
            </Typography>
            {email.hasAttachments && (
              <AttachFileIcon
                fontSize="small"
                sx={{ color: "text.secondary", fontSize: 16 }}
              />
            )}
          </Box>

          <Typography
            variant="body2"
            sx={{
              fontWeight: isRead ? 400 : 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              mb: 0.5,
              fontSize: "0.875rem",
            }}
          >
            {email.subject || "(No Subject)"}
          </Typography>

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {email.textBody?.substring(0, 100)}
          </Typography>
        </Box>

        <Box sx={{ textAlign: "right", minWidth: 70 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ fontWeight: 500 }}
          >
            {email.date ? formatEmailListDate(email.date, settings) : ''}
          </Typography>
        </Box>
      </Box>
    </ListItemButton>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => { onSelect(email.id); handleCloseMenu(); }}>
          <MailIcon sx={{ mr: 1, fontSize: 20 }} />
          Open
        </MenuItem>
        
        <MenuItem onClick={handleToggleRead}>
          <MarkEmailReadIcon sx={{ mr: 1, fontSize: 20 }} />
          Mark as {isRead ? 'Unread' : 'Read'}
        </MenuItem>
        
        <MenuItem onClick={() => { handleToggleStar({ stopPropagation: () => {} } as React.MouseEvent); }}>
          {isFlagged ? (
            <>
              <StarBorderIcon sx={{ mr: 1, fontSize: 20 }} />
              Unstar
            </>
          ) : (
            <>
              <StarIcon sx={{ mr: 1, fontSize: 20 }} />
              Star
            </>
          )}
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleMoveEmail}>
          <FolderIcon sx={{ mr: 1, fontSize: 20 }} />
          Move to Folder
        </MenuItem>

        <MenuItem onClick={handlePrintEmail} disabled={isPrintLoading}>
          {isPrintLoading ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : (
            <PrintIcon sx={{ mr: 1, fontSize: 20 }} />
          )}
          {isPrintLoading ? 'Loading...' : 'Print'}
        </MenuItem>

        <Divider />

        <MenuItem onClick={handleDeleteClick}>
          <DeleteIcon sx={{ mr: 1, fontSize: 20, color: 'error.main' }} />
          <Typography color="error">Delete</Typography>
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Delete Email?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this email? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDeleteEmail} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Move Folder Dialog */}
      <MoveFolderDialog
        open={moveFolderDialogOpen}
        onClose={() => setMoveFolderDialogOpen(false)}
        emailId={email.id}
        currentFolderId={email.folderId}
        accountId={email.emailAccountId}
        onSuccess={() => {
          setIsMoved(true);
          setMoveFolderDialogOpen(false);
        }}
      />
    </>
  );
};

// Memoize - component will NEVER re-render unless React unmounts and remounts it
// We use emailId as the key, so changing email ID = new component instance
export const EmailListItem = React.memo(EmailListItemComponent);
