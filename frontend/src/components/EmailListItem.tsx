import {
  ListItemButton,
  Box,
  Typography,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Collapse,
} from "@mui/material";
import {
  AttachFile,
  Star,
  StarBorder,
  Reply,
  Forward,
  Delete,
  MarkEmailRead,
  MarkEmailUnread,
} from "@mui/icons-material";
import type { Email } from "../types";
import { useState } from "react";
import type { MouseEvent } from "react";
import { emailsApi } from "../api";
import { useNavigate, useParams } from "react-router-dom";

interface EmailListItemProps {
  email: Email;
  formatDate: (dateString?: string) => string;
  selected?: boolean;
  onSelect?: (uid: number, selected: boolean) => void;
}

function EmailListItem({
  email,
  formatDate,
  selected = false,
  onSelect,
}: EmailListItemProps) {
  const [deleted, setDeleted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [localEmail, setLocalEmail] = useState(email);
  const navigate = useNavigate();
  const { accountId, folderPath } = useParams<{
    accountId: string;
    folderPath: string;
  }>();

  const decodedFolderPath = folderPath ? decodeURIComponent(folderPath) : "";

  const getFromName = () => {
    if (!localEmail.from || localEmail.from.length === 0) return "Unknown";
    const from = localEmail.from[0];
    return from.name || from.address;
  };

  const handleContextMenu = (event: MouseEvent) => {
    event.preventDefault();
    setContextMenu(
      contextMenu === null
        ? {
            mouseX: event.clientX + 2,
            mouseY: event.clientY - 6,
          }
        : null
    );
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleClick = () => {
    if (!accountId || !decodedFolderPath) return;
    navigate(
      `/mail/${accountId}/${encodeURIComponent(decodedFolderPath)}/${
        localEmail.uid
      }`
    );
    if (!localEmail.isRead) {
      handleMarkRead(true);
    }
  };

  const handleCheckboxClick = (event: MouseEvent) => {
    event.stopPropagation();
    onSelect?.(localEmail.uid, !selected);
  };

  const handleStar = async () => {
    if (!accountId || !decodedFolderPath) return;

    try {
      const newFlaggedState = !localEmail.isFlagged;
      // Optimistic update
      setLocalEmail({ ...localEmail, isFlagged: newFlaggedState });

      await emailsApi.markAsFlaggedByUid(
        accountId,
        decodedFolderPath,
        localEmail.uid,
        newFlaggedState
      );
    } catch (error) {
      console.error("Failed to toggle star:", error);
      // Revert on error
      setLocalEmail(localEmail);
    }
  };

  const handleMarkRead = async (isRead: boolean) => {
    if (!accountId || !decodedFolderPath) return;

    try {
      // Optimistic update
      setLocalEmail({ ...localEmail, isRead });

      await emailsApi.markAsReadByUid(
        accountId,
        decodedFolderPath,
        localEmail.uid,
        isRead
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
      // Revert on error
      setLocalEmail(localEmail);
    }
  };

  const handleDelete = async () => {
    if (!accountId || !decodedFolderPath) return;
    if (!window.confirm("Delete this email?")) return;

    try {
      await emailsApi.deleteByUid(accountId, decodedFolderPath, localEmail.uid);
      setDeleted(true);
    } catch (error) {
      console.error("Failed to delete email:", error);
      setDeleted(false);
    }
  };

  const handleReply = () => {
    // TODO: Implement reply functionality
    console.log("Reply to:", localEmail.uid);
    handleCloseContextMenu();
  };

  const handleForward = () => {
    // TODO: Implement forward functionality
    console.log("Forward:", localEmail.uid);
    handleCloseContextMenu();
  };

  const handleMenuAction = (action: () => void) => {
    action();
    handleCloseContextMenu();
  };

  return (
    <>
      <Collapse in={!deleted} timeout="auto" unmountOnExit>
        <ListItemButton
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            py: 1.5,
            bgcolor: selected
              ? "action.selected"
              : localEmail.isRead
              ? "transparent"
              : "action.hover",
            "&:hover": {
              bgcolor: "action.selected",
            },
          }}
        >
          {onSelect && (
            <Checkbox
              checked={selected}
              onClick={handleCheckboxClick}
              sx={{ mr: 1 }}
            />
          )}

          <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* First Row: From, Subject, Date */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                mb: 0.5,
              }}
            >
              {/* From - Fixed width */}
              <Typography
                variant="body2"
                sx={{
                  fontWeight: localEmail.isRead ? 400 : 600,
                  width: 200,
                  flexShrink: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {getFromName()}
              </Typography>

              {/* Subject - Flexible */}
              <Typography
                variant="body2"
                sx={{
                  flex: 1,
                  fontWeight: localEmail.isRead ? 400 : 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  minWidth: 0,
                }}
              >
                {localEmail.subject || "(No subject)"}
              </Typography>

              {/* Icons and Date - Fixed width */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  flexShrink: 0,
                  width: 100,
                  justifyContent: "flex-end",
                }}
              >
                {localEmail.hasAttachments && (
                  <AttachFile fontSize="small" color="action" />
                )}
                {localEmail.isFlagged ? (
                  <Star fontSize="small" color="warning" />
                ) : (
                  <StarBorder fontSize="small" sx={{ visibility: "hidden" }} />
                )}
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ minWidth: 60, textAlign: "right" }}
                >
                  {formatDate(localEmail.date)}
                </Typography>
              </Box>
            </Box>

            {/* Second Row: Preview */}
            {localEmail.textBody && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  fontSize: "0.875rem",
                }}
              >
                {localEmail.textBody.substring(0, 100)}
              </Typography>
            )}
          </Box>
        </ListItemButton>
      </Collapse>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleMenuAction(handleReply)}>
          <ListItemIcon>
            <Reply fontSize="small" />
          </ListItemIcon>
          <ListItemText>Reply</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction(handleForward)}>
          <ListItemIcon>
            <Forward fontSize="small" />
          </ListItemIcon>
          <ListItemText>Forward</ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction(handleStar)}>
          <ListItemIcon>
            {localEmail.isFlagged ? (
              <StarBorder fontSize="small" />
            ) : (
              <Star fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {localEmail.isFlagged ? "Unstar" : "Star"}
          </ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() =>
            handleMenuAction(() => handleMarkRead(!localEmail.isRead))
          }
        >
          <ListItemIcon>
            {localEmail.isRead ? (
              <MarkEmailUnread fontSize="small" />
            ) : (
              <MarkEmailRead fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {localEmail.isRead ? "Mark as Unread" : "Mark as Read"}
          </ListItemText>
        </MenuItem>

        <MenuItem onClick={() => handleMenuAction(handleDelete)}>
          <ListItemIcon>
            <Delete fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default EmailListItem;
