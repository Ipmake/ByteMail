import React, { useState } from "react";
import {
  ListItemButton,
  Box,
  Typography,
  Checkbox,
  Avatar,
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
} from "@mui/material";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import DeleteIcon from "@mui/icons-material/Delete";
import MarkEmailReadIcon from "@mui/icons-material/MarkEmailRead";
import MarkEmailUnreadIcon from "@mui/icons-material/MarkEmailUnread";
import CloseIcon from "@mui/icons-material/Close";
import { Virtuoso } from "react-virtuoso";
import { format } from "date-fns";
import type { Email } from "../types";

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

const getInitials = (email: string) => {
  return email.charAt(0).toUpperCase();
};

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = diff / (1000 * 60 * 60 * 24);

  if (days < 1) {
    return format(date, "HH:mm");
  } else if (days < 7) {
    return format(date, "EEE");
  } else {
    return format(date, "MMM d");
  }
};

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
        itemContent={(_index, email) => {
          const fromAddress = email.from[0];
          const fromName =
            fromAddress?.name || fromAddress?.address || "Unknown";

          return (
            <ListItemButton
              key={email.id}
              selected={selectedEmail === email.id}
              onClick={() => onSelectEmail(email.id)}
              sx={{
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                py: 2,
                px: 3,
                backgroundColor: email.isRead
                  ? "transparent"
                  : "rgba(160, 160, 160, 0.05)",
                "&:hover": {
                  backgroundColor: "rgba(160, 160, 160, 0.1)",
                },
                "&.Mui-selected": {
                  backgroundColor: "rgba(160, 160, 160, 0.15)",
                  "&:hover": {
                    backgroundColor: "rgba(160, 160, 160, 0.2)",
                  },
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  gap: 2,
                  width: "100%",
                  alignItems: "center",
                }}
              >
                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleSelect(email.id);
                  }}
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <Checkbox
                    sx={{ p: 0 }}
                    checked={selectedEmails.has(email.id)}
                  />
                </Box>

                <Box
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleStar(email.id, !email.isFlagged);
                  }}
                  sx={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {email.isFlagged ? (
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
                        fontWeight: email.isRead ? 400 : 600,
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
                      fontWeight: email.isRead ? 400 : 600,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      mb: 0.5,
                      fontSize: "0.9375rem",
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
                      lineHeight: 1.5,
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
                    {formatDate(email.date)}
                  </Typography>
                </Box>
              </Box>
            </ListItemButton>
          );
        }}
      />

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
    </Box>
  );
};
