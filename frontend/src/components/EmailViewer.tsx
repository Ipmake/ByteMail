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
  useTheme,
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
import PrintIcon from "@mui/icons-material/Print";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import DOMPurify from "dompurify";
import { emailsApi } from "../api";
import type { Email } from "../types";
import { useSettingsStore } from "../stores/settingsStore";
import { formatEmailViewerDateTime } from "../utils/dateFormatting";
import { MoveFolderDialog } from "./MoveFolderDialog";

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
  const [moveFolderDialogOpen, setMoveFolderDialogOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{
    emailId: string;
    index: number;
    filename: string;
    contentType: string;
  } | null>(null);

  const theme = useTheme();
  const { settings } = useSettingsStore();

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

  const handlePrint = () => {
    if (!email) return;
    
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
    
    // Give time for content to load before printing
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const fromAddress = email?.from[0];
  
  // Block external images if setting enabled
  const processedHtml = React.useMemo(() => {
    if (!email?.htmlBody) return null;
    
    let html = email.htmlBody;
    
    // If blockExternalImages is enabled, remove or placeholder external images
    if (settings?.privacy.blockExternalImages) {
      // Replace img tags with external sources with a placeholder
      html = html.replace(
        /<img([^>]*?)src=["'](?:https?:\/\/|\/\/|data:)([^"']+)["']([^>]*?)>/gi,
        (match, _before, src) => {
          // Keep data: URIs (embedded images)
          if (src.startsWith('data:')) {
            return match;
          }
          // Block external images
          return `<div style="padding: 10px; background-color: #333; color: #888; border: 1px solid #555; margin: 5px 0; font-size: 12px;">[External image blocked]</div>`;
        }
      );
    }
    
    return DOMPurify.sanitize(html);
  }, [email?.htmlBody, settings?.privacy.blockExternalImages]);

  // Determine if we should apply theme to email viewer
  const shouldApplyTheme = settings?.display.applyThemeToEmailViewer !== false;
  const emailBodyColor = shouldApplyTheme ? theme.palette.text.primary : '#333';
  const emailBgColor = shouldApplyTheme ? theme.palette.background.paper : '#fff';

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
        {email.flags?.includes("\\Draft") ? (
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

        <IconButton onClick={handlePrint} title="Print">
          <PrintIcon />
        </IconButton>

        <IconButton onClick={() => setMoveFolderDialogOpen(true)} title="Move to folder">
          <DriveFileMoveIcon />
        </IconButton>

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
              {email.date && formatEmailViewerDateTime(email.date, settings)}
            </Typography>
          </Paper>            {/* Attachments */}
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
              {processedHtml ? (
                <iframe
                  srcDoc={`
                    <style>
                      body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI',
                          Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans',
                          'Helvetica Neue', sans-serif;
                        padding: 20px;
                        color: ${emailBodyColor};
                        background-color: ${emailBgColor};
                      }
                      img {
                        max-width: 100%;
                        height: auto;
                      }
                    </style>
                    <base target="_blank" />
                    ${processedHtml}`}
                  sandbox="allow-top-navigation-by-user-activation allow-popups-to-escape-sandbox allow-popups"
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

      {/* Move Folder Dialog */}
      {email && (
        <MoveFolderDialog
          open={moveFolderDialogOpen}
          onClose={() => setMoveFolderDialogOpen(false)}
          emailId={email.id}
          currentFolderId={email.folderId}
          accountId={email.emailAccountId}
          onSuccess={() => {
            // Refresh the email list or navigate back
            onClose();
          }}
        />
      )}
    </Box>
  );
};
