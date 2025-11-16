import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  IconButton,
  Chip,
  Avatar,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Paper,
  Grid,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReplyIcon from "@mui/icons-material/Reply";
import ForwardIcon from "@mui/icons-material/Forward";
import DeleteIcon from "@mui/icons-material/Delete";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DownloadIcon from "@mui/icons-material/Download";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";
import EditIcon from "@mui/icons-material/Edit";
import { format } from "date-fns";
import DOMPurify from "dompurify";
import { emailsApi } from "../api";
import type { Email } from "../types";

interface ImageModalProps {
  open: boolean;
  onClose: () => void;
  emailId: string;
  attachmentIndex: number;
  filename: string;
  contentType: string;
}

const ImageModal: React.FC<ImageModalProps> = ({
  open,
  onClose,
  emailId,
  attachmentIndex,
  filename,
  contentType,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !contentType.startsWith("image/")) {
      return;
    }

    const token = localStorage.getItem("token");
    const url = `${
      import.meta.env.VITE_API_URL || "/api"
    }/emails/${emailId}/attachments/${attachmentIndex}`;

    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((response) => response.blob())
      .then((blob) => {
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch((error) => {
        console.error("Failed to load image:", error);
      });

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [open, emailId, attachmentIndex, contentType, imageUrl]);

  const handleDownload = () => {
    emailsApi.downloadAttachment(emailId, attachmentIndex, filename);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: "background.paper",
          backgroundImage: "none",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="h6">{filename}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "400px",
          bgcolor: "background.default",
        }}
      >
        {!imageUrl ? (
          <CircularProgress />
        ) : (
          <img
            src={imageUrl}
            alt={filename}
            style={{
              maxWidth: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
            }}
          />
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
        <Button onClick={onClose}>Close</Button>
        <Button
          variant="contained"
          startIcon={<DownloadIcon />}
          onClick={handleDownload}
        >
          Download
        </Button>
      </DialogActions>
    </Dialog>
  );
};

interface EmailViewerProps {
  emailId: string | null;
  onClose: () => void;
  onDelete?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onEditDraft?: () => void;
  onEmailRead?: (emailId: string) => void;
}

export const EmailViewer: React.FC<EmailViewerProps> = ({
  emailId,
  onClose,
  onDelete,
  onReply,
  onForward,
  onEditDraft,
  onEmailRead,
}) => {
  const [email, setEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    emailId: string;
    index: number;
    filename: string;
    contentType: string;
  } | null>(null);

  useEffect(() => {
    if (emailId) {
      loadEmail(emailId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId]);

  const loadEmail = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await emailsApi.getById(id);
      setEmail(data);
      // Notify parent that email was read
      if (onEmailRead && !data.isRead) {
        onEmailRead(id);
      }
    } catch (error) {
      console.error("Failed to load email:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStar = async () => {
    if (!email) return;
    try {
      await emailsApi.markAsFlagged(email.id, !email.isFlagged);
      setEmail({ ...email, isFlagged: !email.isFlagged });
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  };

  const handleDelete = async () => {
    if (!email || !window.confirm("Delete this email?")) return;
    try {
      await emailsApi.delete(email.id);
      onDelete?.();
      onClose();
    } catch (error) {
      console.error("Failed to delete email:", error);
    }
  };

  const handleAttachmentClick = (
    att: { filename: string; contentType?: string },
    idx: number
  ) => {
    if (att.contentType?.startsWith("image/")) {
      setSelectedImage({
        emailId: email!.id,
        index: idx,
        filename: att.filename,
        contentType: att.contentType,
      });
      setImageModalOpen(true);
    } else {
      emailsApi.downloadAttachment(email!.id, idx, att.filename);
    }
  };

  const handleCloseImageModal = () => {
    setImageModalOpen(false);
    setSelectedImage(null);
  };

  if (!emailId) {
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
          Select an email to view
        </Typography>
      </Box>
    );
  }

  if (isLoading || !email) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  const fromAddress = email.from[0];
  const sanitizedHtml = email.htmlBody
    ? DOMPurify.sanitize(email.htmlBody)
    : null;

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
          display: "flex",
          gap: 1,
          alignItems: "center",
        }}
      >
        <IconButton onClick={onClose}>
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flex: 1 }} />

        <IconButton onClick={handleToggleStar}>
          {email.isFlagged ? (
            <StarIcon sx={{ color: "warning.main" }} />
          ) : (
            <StarBorderIcon />
          )}
        </IconButton>

        {/* Show Edit Draft button if this is a draft */}
        {email.flags?.includes('\\Draft') ? (
          <IconButton onClick={onEditDraft} color="primary">
            <EditIcon />
          </IconButton>
        ) : (
          <>
            <IconButton onClick={onReply}>
              <ReplyIcon />
            </IconButton>

            <IconButton onClick={onForward}>
              <ForwardIcon />
            </IconButton>
          </>
        )}

        <IconButton onClick={handleDelete}>
          <DeleteIcon />
        </IconButton>
      </Box>

      {/* Email Content with Grid Layout */}
      <Box sx={{ flex: 1, overflow: "hidden", p: 4 }}>
        <Grid container spacing={3} sx={{ height: "100%" }}>
          {/* Left Column - Metadata & Info */}
          <Grid
            size={{ xs: 12, lg: 4 }}
            sx={{ height: "100%", overflow: "auto" }}
          >
            {/* Subject */}
            <Paper
              elevation={0}
              sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                Subject
              </Typography>
              <Typography
                variant="body1"
                fontWeight={500}
                sx={{
                  wordBreak: "break-word",
                  whiteSpace: "wrap",
                }}
              >
                {email.subject || "(No Subject)"}
              </Typography>
            </Paper>

            {/* From */}
            <Paper
              elevation={0}
              sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                From
              </Typography>
              <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                <Avatar sx={{ width: 40, height: 40 }}>
                  {(fromAddress?.name || fromAddress?.address || "U")
                    .charAt(0)
                    .toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={500} noWrap>
                    {fromAddress?.name || fromAddress?.address}
                  </Typography>
                  {fromAddress?.address && fromAddress?.name && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {fromAddress.address}
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>

            {/* To */}
            {email.to && email.to.length > 0 && (
              <Paper
                elevation={0}
                sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  To
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {email.to.map((toAddress, idx) => (
                    <Box
                      key={idx}
                      sx={{ display: "flex", gap: 2, alignItems: "center" }}
                    >
                      <Avatar sx={{ width: 40, height: 40 }}>
                        {(toAddress?.name || toAddress?.address || "U")
                          .charAt(0)
                          .toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {toAddress?.name || toAddress?.address}
                        </Typography>
                        {toAddress?.address && toAddress?.name && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                          >
                            {toAddress.address}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  ))}
                </Box>
              </Paper>
            )}

            {/* Cc */}
            {email.cc && email.cc.length > 0 && (
              <Paper
                elevation={0}
                sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Cc
                </Typography>
                <Typography variant="body2">
                  {email.cc.map((addr) => addr.name || addr.address).join(", ")}
                </Typography>
              </Paper>
            )}

            {/* Date */}
            <Paper
              elevation={0}
              sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
            >
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                Date
              </Typography>
              <Typography variant="body2">
                {email.date && format(new Date(email.date), "PPpp")}
              </Typography>
            </Paper>

            {/* Attachments */}
            {email.hasAttachments && email.attachments && (
              <Paper
                elevation={0}
                sx={{ p: 3, border: 1, borderColor: "divider" }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Attachments ({email.attachments.length})
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  {email.attachments.map((att, idx) => {
                    const isImage = att.contentType?.startsWith("image/");
                    return (
                      <Chip
                        key={idx}
                        icon={isImage ? <ImageIcon /> : <AttachFileIcon />}
                        label={`${att.filename} (${Math.round(
                          att.size / 1024
                        )}KB)`}
                        size="small"
                        variant={isImage ? "filled" : "outlined"}
                        color={isImage ? "primary" : "default"}
                        onClick={() => handleAttachmentClick(att, idx)}
                        sx={{ cursor: "pointer", justifyContent: "flex-start" }}
                      />
                    );
                  })}
                </Box>
              </Paper>
            )}
          </Grid>

          {/* Right Column - Email Content */}
          <Grid
            size={{ xs: 12, lg: 8 }}
            sx={{ height: "100%", overflow: "auto" }}
          >
            <Paper
              elevation={0}
              sx={{
                p: 4,
                border: 1,
                borderColor: "divider",
                minHeight: "100%",
                height: "100%",
              }}
            >
              {sanitizedHtml ? (
                <iframe
                  srcDoc={sanitizedHtml}
                  sandbox="allow-same-origin"
                  style={{
                    width: "100%",
                    height: "100%",
                    minHeight: "500px",
                    border: "none",
                    backgroundColor: "transparent",
                  }}
                  title="Email content"
                />
              ) : (
                <Typography
                  variant="body1"
                  sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                >
                  {email.textBody || "(No content)"}
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Image Modal */}
      {selectedImage && (
        <ImageModal
          open={imageModalOpen}
          onClose={handleCloseImageModal}
          emailId={selectedImage.emailId}
          attachmentIndex={selectedImage.index}
          filename={selectedImage.filename}
          contentType={selectedImage.contentType}
        />
      )}
    </Box>
  );
};
