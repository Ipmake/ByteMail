import { useParams } from "react-router-dom";
import { useAccountStore } from "../../stores/accountStore";
import LoadingDisplay from "../../components/LoadingDisplay";
import EmailListItem from "../../components/EmailListItem";
import { useEffect, useState } from "react";
import { emailsApi } from "../../api";
import type { Email } from "../../types";
import {
  Box,
  List,
  Typography,
  Pagination,
  IconButton,
  Checkbox,
  Button,
  Toolbar,
  Collapse,
} from "@mui/material";
import {
  Refresh,
  Delete,
  Star,
  StarBorder,
  MarkEmailRead,
  MarkEmailUnread,
} from "@mui/icons-material";
import GlobalEmailViewer from "../../components/Drawers/GlobalEmailViewer";
import { useSettingsStore } from "../../stores/settingsStore";
import { formatEmailListDate } from "../../utils/dateFormatting";

function EmailList() {
  const { accountId, folderPath } = useParams<{
    accountId: string;
    folderPath: string;
  }>();
  const folders = useAccountStore((state) => state.folders);

  const [emails, setEmails] = useState<Email[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
  const { settings } = useSettingsStore();

  const decodedFolderPath = folderPath ? decodeURIComponent(folderPath) : "";

  const loadEmails = async () => {
    if (!accountId || !decodedFolderPath) return;
    if (!folders[accountId]) return;

    setLoading(true);
    setEmails(null);

    try {
      const response = await emailsApi.getEmails(
        `${accountId}/${encodeURIComponent(decodedFolderPath)}`,
        page,
        50
      );
      setEmails(response.emails);
      setTotalPages(response.pagination.totalPages);
      setTotal(response.pagination.total);
    } catch (err) {
      console.error("Failed to load emails:", err);
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmails();
    setSelectedUids(new Set()); // Clear selection when changing folders/pages
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, decodedFolderPath, page, folders]);

  const handleSelectAll = () => {
    if (!emails) return;
    if (selectedUids.size === emails.length) {
      setSelectedUids(new Set());
    } else {
      setSelectedUids(new Set(emails.map((e) => e.uid)));
    }
  };

  const handleSelect = (uid: number, selected: boolean) => {
    const newSelected = new Set(selectedUids);
    if (selected) {
      newSelected.add(uid);
    } else {
      newSelected.delete(uid);
    }
    setSelectedUids(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!accountId || !decodedFolderPath || selectedUids.size === 0) return;
    if (!window.confirm(`Delete ${selectedUids.size} selected emails?`)) return;

    try {
      await Promise.all(
        Array.from(selectedUids).map((uid) =>
          emailsApi.deleteByUid(accountId, decodedFolderPath, uid)
        )
      );
      setSelectedUids(new Set());
      loadEmails();
    } catch (error) {
      console.error("Failed to delete emails:", error);
    }
  };

  const handleBulkStar = async () => {
    if (!accountId || !decodedFolderPath || selectedUids.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedUids).map((uid) =>
          emailsApi.markAsFlaggedByUid(accountId, decodedFolderPath, uid, true)
        )
      );
      loadEmails();
    } catch (error) {
      console.error("Failed to star emails:", error);
    }
  };

  const handleBulkUnstar = async () => {
    if (!accountId || !decodedFolderPath || selectedUids.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedUids).map((uid) =>
          emailsApi.markAsFlaggedByUid(accountId, decodedFolderPath, uid, false)
        )
      );
      loadEmails();
    } catch (error) {
      console.error("Failed to unstar emails:", error);
    }
  };

  const handleBulkMarkRead = async () => {
    if (!accountId || !decodedFolderPath || selectedUids.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedUids).map((uid) =>
          emailsApi.markAsReadByUid(accountId, decodedFolderPath, uid, true)
        )
      );
      loadEmails();
    } catch (error) {
      console.error("Failed to mark emails as read:", error);
    }
  };

  const handleBulkMarkUnread = async () => {
    if (!accountId || !decodedFolderPath || selectedUids.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedUids).map((uid) =>
          emailsApi.markAsReadByUid(accountId, decodedFolderPath, uid, false)
        )
      );
      loadEmails();
    } catch (error) {
      console.error("Failed to mark emails as unread:", error);
    }
  };

  if (!accountId || !folderPath) return <></>;
  if (!folders[accountId || ""])
    return <LoadingDisplay text="Connecting to Account..." />;

  const formatDate = (dateString?: string | null) => {
    if (!dateString) return "Unknown";
    return formatEmailListDate(dateString, settings);
  };

  return (
    <>
      <GlobalEmailViewer />
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">
            {decodedFolderPath} ({total} emails)
          </Typography>
          <IconButton
            onClick={loadEmails}
            disabled={loading}
            size="small"
            title="Refresh emails"
          >
            <Refresh />
          </IconButton>
        </Box>

        {/* Bulk Actions Toolbar */}
        <Collapse in={selectedUids.size > 0}>
          <Toolbar
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              gap: 1,
              bgcolor: "action.hover",
            }}
          >
            <Checkbox
              checked={emails ? selectedUids.size === emails.length : false}
              indeterminate={
                emails
                  ? selectedUids.size > 0 && selectedUids.size < emails.length
                  : false
              }
              onChange={handleSelectAll}
            />
            <Typography variant="body2" sx={{ mr: 2 }}>
              {selectedUids.size} selected
            </Typography>
            <Button size="small" startIcon={<Star />} onClick={handleBulkStar}>
              Star
            </Button>
            <Button
              size="small"
              startIcon={<StarBorder />}
              onClick={handleBulkUnstar}
            >
              Unstar
            </Button>
            <Button
              size="small"
              startIcon={<MarkEmailRead />}
              onClick={handleBulkMarkRead}
            >
              Mark Read
            </Button>
            <Button
              size="small"
              startIcon={<MarkEmailUnread />}
              onClick={handleBulkMarkUnread}
            >
              Mark Unread
            </Button>
            <Button
              size="small"
              startIcon={<Delete />}
              onClick={handleBulkDelete}
              color="error"
            >
              Delete
            </Button>
          </Toolbar>
        </Collapse>

        {/* Email List */}
        <Box sx={{ flex: 1, overflow: "auto" }}>
          {loading && !emails ? (
            <LoadingDisplay text="Fetching emails..." />
          ) : emails?.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">
                No emails in this folder
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {emails?.map((email) => (
                <EmailListItem
                  key={email.uid}
                  email={email}
                  formatDate={formatDate}
                  selected={selectedUids.has(email.uid)}
                  onSelect={handleSelect}
                />
              ))}
            </List>
          )}
        </Box>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: "divider",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 2,
            }}
          >
            <Pagination
              count={totalPages}
              page={page}
              onChange={(_, value) => setPage(value)}
              color="primary"
              disabled={loading}
            />
          </Box>
        )}
      </Box>
    </>
  );
}

export default EmailList;
