import {
  Drawer,
  Box,
  Typography,
  IconButton,
  TextField,
  Button,
  Paper,
  Avatar,
  Chip,
  Grid,
  FormControlLabel,
  Switch,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Tooltip,
  Dialog,
  DialogContent,
  DialogTitle,
  CircularProgress,
} from "@mui/material";
import { useState, useEffect } from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ImageIcon from "@mui/icons-material/Image";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import { emailsApi } from "../../api";
import { useAccountStore } from "../../stores/accountStore";
import { useComposeStore } from "../../stores/composeStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { formatEmailViewerDateTime } from "../../utils/dateFormatting";

interface EmailAddress {
  name?: string;
  address: string;
}

interface Attachment {
  file: File;
  name: string;
  size: number;
  type: string;
}

interface ComposeData {
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  body: string;
  attachments: Attachment[];
  isHtml: boolean;
  priority: "low" | "normal" | "high";
  requestReadReceipt: boolean;
}

function GlobalComposeDrawer() {
  // Only subscribe to isOpen to avoid rerenders, use getState() for everything else
  const isOpen = useComposeStore((state) => state.isOpen);
  const accounts = useAccountStore((state) => state.accounts);
  const initAccountId = useComposeStore((state) => state.accountId);

  const [composeData, setComposeData] = useState<ComposeData>({
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    body: "",
    attachments: [],
    isHtml: true,
    priority: "normal",
    requestReadReceipt: false,
  });

  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [editorTab, setEditorTab] = useState<"compose" | "preview">(
    composeData.isHtml ? "compose" : "compose"
  );
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null
  );
  const { settings } = useSettingsStore();
  
  // Set default account
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      setSelectedAccount(initAccountId || accounts[0].id || "");
    }
  }, [accounts, initAccountId]);

  // Load original email data for reply/forward or add signature for new emails
  useEffect(() => {
    const { emailId, accountId, folderPath, mode, initialData } =
      useComposeStore.getState();
    if (
      isOpen &&
      emailId &&
      accountId &&
      folderPath &&
      (mode === "reply" || mode === "forward")
    ) {
      loadOriginalEmail();
    } else if (isOpen && initialData) {
      setComposeData((prev) => ({ ...prev, ...initialData }));
      if (initialData.cc && initialData.cc.length > 0) setShowCc(true);
      if (initialData.bcc && initialData.bcc.length > 0) setShowBcc(true);
    } else if (isOpen && mode === "new") {
      // Add signature to new emails
      const signature =
        useSettingsStore.getState().settings?.email.signature || "";
      if (signature) {
        setComposeData((prev) => ({
          ...prev,
          body: `<p><br></p><p><br></p><p><br></p>${signature}`,
        }));
      }
    }
  }, [isOpen]);

  const loadOriginalEmail = async () => {
    const { emailId, accountId, folderPath, mode } = useComposeStore.getState();
    if (!emailId || !accountId || !folderPath) return;

    try {
      const decodedFolderPath = decodeURIComponent(folderPath);
      const email = await emailsApi.getByUid(
        accountId,
        decodedFolderPath,
        parseInt(emailId)
      );

      const signature =
        useSettingsStore.getState().settings?.email.signature || "";

      if (mode === "reply") {
        console.log(email.from);
        const originalMessage =
          email.htmlBody || email.textBody?.replace(/\n/g, "<br>") || "";
        setComposeData((prev) => ({
          ...prev,
          to: email.from || [],
          subject: email.subject?.startsWith("Re: ")
            ? email.subject
            : `Re: ${email.subject || ""}`,
          body: `<p><br></p><p><br></p><p><br></p>${signature}<p><br></p><hr><p>On ${
            email.date ? formatEmailViewerDateTime(email.date, settings) : 'Unknown date'
          }, ${
            email.from[0]?.name || email.from[0]?.address
          } wrote:</p><blockquote style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 0; color: #666;">${originalMessage}</blockquote>`,
        }));
      } else if (mode === "forward") {
        const originalMessage =
          email.htmlBody || email.textBody?.replace(/\n/g, "<br>") || "";
        setComposeData((prev) => ({
          ...prev,
          subject: email.subject?.startsWith("Fwd: ")
            ? email.subject
            : `Fwd: ${email.subject || ""}`,
          body: `<p><br></p><p><br></p><p><br></p>${signature}<p><br></p><hr><p>Forwarded message:</p><p>From: ${
            email.from[0]?.name || email.from[0]?.address
          }</p><p>Date: ${
            email.date ? formatEmailViewerDateTime(email.date, settings) : "Unknown date"
          }</p><p>Subject: ${
            email.subject || "(No Subject)"
          }</p><p>To: ${email.to
            ?.map((t) => t.name || t.address)
            .join(", ")}</p><p><br></p><blockquote style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 0; color: #666;">${originalMessage}</blockquote>`,
        }));
      }
    } catch (error) {
      console.error("Failed to load original email:", error);
    }
  };

  const parseEmailInput = (input: string): EmailAddress | null => {
    if (!input.trim()) return null;

    const emailRegex = /<(.+?)>/;
    const match = input.match(emailRegex);

    if (match) {
      const address = match[1];
      const name = input.replace(emailRegex, "").trim();
      return { name: name || undefined, address };
    }

    // Simple email validation
    if (input.includes("@")) {
      return { address: input.trim() };
    }

    return null;
  };

  const handleAddRecipient = (field: "to" | "cc" | "bcc", value: string) => {
    const email = parseEmailInput(value);
    if (email && !composeData[field].some((e) => e.address === email.address)) {
      setComposeData((prev) => ({
        ...prev,
        [field]: [...prev[field], email],
      }));
    }

    // Clear input
    if (field === "to") setToInput("");
    if (field === "cc") setCcInput("");
    if (field === "bcc") setBccInput("");
  };

  const handleRemoveRecipient = (
    field: "to" | "cc" | "bcc",
    address: string
  ) => {
    setComposeData((prev) => ({
      ...prev,
      [field]: prev[field].filter((e) => e.address !== address),
    }));
  };

  const handleFileAttachment = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const newAttachments: Attachment[] = Array.from(files).map((file) => ({
      file,
      name: file.name,
      size: file.size,
      type: file.type,
    }));

    setComposeData((prev) => ({
      ...prev,
      attachments: [...prev.attachments, ...newAttachments],
    }));

    // Reset input
    event.target.value = "";
  };

  const handleRemoveAttachment = (index: number) => {
    setComposeData((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index),
    }));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSend = async () => {
    if (!selectedAccount) {
      alert("Please select an email account");
      return;
    }

    if (composeData.to.length === 0) {
      alert("Please add at least one recipient");
      return;
    }

    setIsSending(true);
    try {
      const formData = new FormData();
      formData.append("accountId", selectedAccount);
      formData.append("to", JSON.stringify(composeData.to));
      if (composeData.cc.length > 0) {
        formData.append("cc", JSON.stringify(composeData.cc));
      }
      if (composeData.bcc.length > 0) {
        formData.append("bcc", JSON.stringify(composeData.bcc));
      }
      formData.append("subject", composeData.subject);
      formData.append("body", composeData.body);
      formData.append("isHtml", composeData.isHtml.toString());
      formData.append("priority", composeData.priority);
      formData.append(
        "requestReadReceipt",
        composeData.requestReadReceipt.toString()
      );

      // Append attachments
      composeData.attachments.forEach((att) => {
        formData.append("attachments", att.file);
      });

      // Send the email
      const response = await fetch("/api/emails/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("auth-token")}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send email");
      }

      // Reset and close
      resetCompose();
      useComposeStore.getState().closeCompose();
    } catch (error) {
      console.error("Failed to send email:", error);
      alert(
        (error as Error).message || "Failed to send email. Please try again."
      );
    } finally {
      setIsSending(false);
    }
  };

  const resetCompose = () => {
    setComposeData({
      to: [],
      cc: [],
      bcc: [],
      subject: "",
      body: "",
      attachments: [],
      isHtml: true,
      priority: "normal",
      requestReadReceipt: false,
    });
    setShowCc(false);
    setShowBcc(false);
    setToInput("");
    setCcInput("");
    setBccInput("");
  };

  const handleClose = () => {
    if (composeData.to.length > 0 || composeData.subject || composeData.body) {
      if (
        window.confirm(
          "You have unsaved changes. Do you want to discard this email?"
        )
      ) {
        resetCompose();
        useComposeStore.getState().closeCompose();
      }
    } else {
      resetCompose();
      useComposeStore.getState().closeCompose();
    }
  };

  const totalAttachmentSize = composeData.attachments.reduce(
    (sum, att) => sum + att.size,
    0
  );

  // Calculate word count and reading time
  const getTextContent = (html: string) => {
    const tmp = document.createElement("DIV");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const textContent = composeData.isHtml
    ? getTextContent(composeData.body)
    : composeData.body;
  const wordCount = textContent
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // 200 words per minute

  // Attachment preview handlers
  const handlePreviewAttachment = (attachment: Attachment) => {
    if (attachment.type.startsWith("image/")) {
      setPreviewAttachment(attachment);
    } else {
      // Download non-image files
      const url = URL.createObjectURL(attachment.file);
      const a = document.createElement("a");
      a.href = url;
      a.download = attachment.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Drawer
      open={isOpen}
      onClose={handleClose}
      anchor="right"
      PaperProps={{
        sx: {
          width: { xs: "100vw", md: "100vw", lg: "80vw" },
          maxWidth: "100%",
        },
      }}
    >
      <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <Box
          sx={{
            p: 2,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            gap: 1,
            alignItems: "center",
          }}
        >
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>

          <Typography variant="h6" sx={{ flex: 1 }}>
            {useComposeStore.getState().mode === "reply" && "Reply"}
            {useComposeStore.getState().mode === "forward" && "Forward"}
            {useComposeStore.getState().mode === "draft" && "Edit Draft"}
            {useComposeStore.getState().mode === "new" && "New Message"}
          </Typography>

          <Button
            variant="contained"
            startIcon={
              isSending ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <SendIcon />
              )
            }
            onClick={handleSend}
            disabled={isSending || composeData.to.length === 0}
          >
            {isSending ? "Sending..." : "Send"}
          </Button>
        </Box>

        {/* Stats Bar */}
        <Box
          sx={{
            px: 4,
            py: 1,
            borderBottom: 1,
            borderColor: "divider",
            display: "flex",
            gap: 3,
            alignItems: "center",
            backgroundColor: (theme) =>
              theme.palette.mode === "dark"
                ? "rgba(255, 255, 255, 0.02)"
                : "rgba(0, 0, 0, 0.01)",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {wordCount} {wordCount === 1 ? "word" : "words"}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ~{readingTime} min read
          </Typography>
          {composeData.attachments.length > 0 && (
            <Typography variant="caption" color="text.secondary">
              {composeData.attachments.length}{" "}
              {composeData.attachments.length === 1
                ? "attachment"
                : "attachments"}{" "}
              ({formatBytes(totalAttachmentSize)})
            </Typography>
          )}
        </Box>

        {/* Compose Content */}
        <Box sx={{ flex: 1, overflow: "hidden", p: 4 }}>
          <Grid container spacing={3} sx={{ height: "100%" }}>
            {/* Left Column - Recipients & Settings */}
            <Grid
              size={{ xs: 12, lg: 4 }}
              sx={{ height: "100%", overflow: "auto" }}
            >
              {/* From Account */}
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
                <FormControl fullWidth size="small">
                  <Select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    {accounts &&
                      accounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Avatar
                              sx={{
                                width: 24,
                                height: 24,
                                fontSize: "0.75rem",
                              }}
                            >
                              {account.emailAddress.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body2">
                                {account.displayName || account.emailAddress}
                              </Typography>
                              {account.displayName && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {account.emailAddress}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Paper>

              {/* To Recipients */}
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
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  {composeData.to.map((recipient, idx) => (
                    <Chip
                      key={idx}
                      label={`${recipient.name} <${recipient.address}>`}
                      onDelete={() =>
                        handleRemoveRecipient("to", recipient.address)
                      }
                      size="small"
                    />
                  ))}
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add recipient (name@example.com)"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      handleAddRecipient("to", toInput);
                    }
                  }}
                  onBlur={() => {
                    if (toInput.trim()) {
                      handleAddRecipient("to", toInput);
                    }
                  }}
                />
                <Box sx={{ mt: 1, display: "flex", gap: 1 }}>
                  {!showCc && (
                    <Button size="small" onClick={() => setShowCc(true)}>
                      + Cc
                    </Button>
                  )}
                  {!showBcc && (
                    <Button size="small" onClick={() => setShowBcc(true)}>
                      + Bcc
                    </Button>
                  )}
                </Box>
              </Paper>

              {/* Cc Recipients */}
              {showCc && (
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
                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}
                  >
                    {composeData.cc.map((recipient, idx) => (
                      <Chip
                        key={idx}
                        label={recipient.name || recipient.address}
                        onDelete={() =>
                          handleRemoveRecipient("cc", recipient.address)
                        }
                        size="small"
                      />
                    ))}
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add Cc recipient"
                    value={ccInput}
                    onChange={(e) => setCcInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddRecipient("cc", ccInput);
                      }
                    }}
                    onBlur={() => {
                      if (ccInput.trim()) {
                        handleAddRecipient("cc", ccInput);
                      }
                    }}
                  />
                </Paper>
              )}

              {/* Bcc Recipients */}
              {showBcc && (
                <Paper
                  elevation={0}
                  sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
                >
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 2 }}
                  >
                    Bcc
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}
                  >
                    {composeData.bcc.map((recipient, idx) => (
                      <Chip
                        key={idx}
                        label={recipient.name || recipient.address}
                        onDelete={() =>
                          handleRemoveRecipient("bcc", recipient.address)
                        }
                        size="small"
                      />
                    ))}
                  </Box>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add Bcc recipient"
                    value={bccInput}
                    onChange={(e) => setBccInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        handleAddRecipient("bcc", bccInput);
                      }
                    }}
                    onBlur={() => {
                      if (bccInput.trim()) {
                        handleAddRecipient("bcc", bccInput);
                      }
                    }}
                  />
                </Paper>
              )}

              {/* Attachments */}
              <Paper
                elevation={0}
                sx={{ p: 3, mb: 3, border: 1, borderColor: "divider" }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Attachments{" "}
                  {composeData.attachments.length > 0 &&
                    `(${formatBytes(totalAttachmentSize)})`}
                </Typography>

                <input
                  accept="*/*"
                  style={{ display: "none" }}
                  id="attachment-file-input"
                  type="file"
                  multiple
                  onChange={handleFileAttachment}
                />
                <label htmlFor="attachment-file-input">
                  <Button
                    component="span"
                    variant="outlined"
                    startIcon={<AttachFileIcon />}
                    fullWidth
                    size="small"
                  >
                    Add Attachment
                  </Button>
                </label>

                {composeData.attachments.length > 0 && (
                  <Box
                    sx={{
                      mt: 2,
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    {composeData.attachments.map((att, idx) => {
                      const isImage = att.type.startsWith("image/");
                      return (
                        <Box
                          key={idx}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            p: 1,
                            border: 1,
                            borderColor: "divider",
                            borderRadius: 1,
                            backgroundColor: (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(255, 255, 255, 0.02)"
                                : "rgba(0, 0, 0, 0.02)",
                          }}
                        >
                          {isImage ? (
                            <ImageIcon fontSize="small" color="primary" />
                          ) : (
                            <AttachFileIcon fontSize="small" />
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" noWrap>
                              {att.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {formatBytes(att.size)}
                            </Typography>
                          </Box>
                          <Tooltip title={isImage ? "Preview" : "Download"}>
                            <IconButton
                              size="small"
                              onClick={() => handlePreviewAttachment(att)}
                            >
                              {isImage ? (
                                <VisibilityIcon fontSize="small" />
                              ) : (
                                <DownloadIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveAttachment(idx)}
                              color="error"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Paper>

              {/* Advanced Options */}
              <Paper
                elevation={0}
                sx={{ p: 3, border: 1, borderColor: "divider" }}
              >
                <Typography
                  variant="subtitle2"
                  color="text.secondary"
                  sx={{ mb: 2 }}
                >
                  Options
                </Typography>

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={composeData.priority}
                    label="Priority"
                    onChange={(e) =>
                      setComposeData((prev) => ({
                        ...prev,
                        priority: e.target.value as "low" | "normal" | "high",
                      }))
                    }
                  >
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="normal">Normal</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    <Switch
                      checked={composeData.requestReadReceipt}
                      onChange={(e) =>
                        setComposeData((prev) => ({
                          ...prev,
                          requestReadReceipt: e.target.checked,
                        }))
                      }
                      size="small"
                    />
                  }
                  label={
                    <Typography variant="body2">
                      Request read receipt
                    </Typography>
                  }
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={composeData.isHtml}
                      onChange={(e) =>
                        setComposeData((prev) => ({
                          ...prev,
                          isHtml: e.target.checked,
                        }))
                      }
                      size="small"
                    />
                  }
                  label={<Typography variant="body2">HTML Format</Typography>}
                />
              </Paper>
            </Grid>

            {/* Right Column - Subject & Body */}
            <Grid
              size={{ xs: 12, lg: 8 }}
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
                <TextField
                  fullWidth
                  placeholder="Enter subject"
                  value={composeData.subject}
                  onChange={(e) =>
                    setComposeData((prev) => ({
                      ...prev,
                      subject: e.target.value,
                    }))
                  }
                  variant="outlined"
                />
              </Paper>

              {/* Body */}
              <Paper
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: "divider",
                  minHeight: "400px",
                  height: "calc(100% - 170px)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <Tabs
                  value={editorTab}
                  onChange={(_, value) => setEditorTab(value)}
                  sx={{
                    borderBottom: 1,
                    borderColor: "divider",
                    px: 2,
                    flexShrink: 0,
                  }}
                >
                  <Tab label="Compose" value="compose" />
                  {composeData.isHtml && (
                    <Tab label="Preview" value="preview" />
                  )}
                </Tabs>

                <Box
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    overflowY: "auto",
                  }}
                >
                  {editorTab === "compose" ? (
                    composeData.isHtml ? (
                      <Box
                        sx={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          "& .quill": {
                            display: "flex",
                            flexDirection: "column",
                            height: "100%",
                          },
                          "& .ql-toolbar": {
                            backgroundColor: (theme) =>
                              theme.palette.mode === "dark"
                                ? "rgba(29, 29, 29, 0.9)"
                                : "rgba(0, 0, 0, 0.02)",
                            borderTop: "none",
                            borderLeft: "none",
                            borderRight: "none",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                            padding: "12px 16px",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          },
                          "& .ql-container": {
                            flex: 1,
                            border: "none",
                            fontSize: "14px",
                            fontFamily: (theme) => theme.typography.fontFamily,
                          },
                          "& .ql-editor": {
                            minHeight: "350px",
                            padding: "16px",
                            color: (theme) => theme.palette.text.primary,
                            "&.ql-blank::before": {
                              color: (theme) => theme.palette.text.disabled,
                              fontStyle: "normal",
                            },
                          },
                          "& .ql-stroke": {
                            stroke: (theme) => theme.palette.text.primary,
                          },
                          "& .ql-fill": {
                            fill: (theme) => theme.palette.text.primary,
                          },
                          "& .ql-picker-label": {
                            color: (theme) => theme.palette.text.primary,
                          },
                          "& .ql-picker-options": {
                            backgroundColor: (theme) =>
                              theme.palette.background.paper,
                            border: "1px solid",
                            borderColor: "divider",
                          },
                          "& button:hover .ql-stroke, & button:focus .ql-stroke, & button.ql-active .ql-stroke":
                            {
                              stroke: (theme) => theme.palette.primary.main,
                            },
                          "& button:hover .ql-fill, & button:focus .ql-fill, & button.ql-active .ql-fill":
                            {
                              fill: (theme) => theme.palette.primary.main,
                            },
                          "& .ql-picker-label:hover, & .ql-picker-label.ql-active":
                            {
                              color: (theme) => theme.palette.primary.main,
                            },
                        }}
                      >
                        <ReactQuill
                          theme="snow"
                          value={composeData.body}
                          onChange={(value) =>
                            setComposeData((prev) => ({
                              ...prev,
                              body: value,
                            }))
                          }
                          modules={{
                            toolbar: [
                              [{ header: [1, 2, 3, false] }],
                              ["bold", "italic", "underline", "strike"],
                              [{ list: "ordered" }, { list: "bullet" }],
                              [{ color: [] }, { background: [] }],
                              ["link", "image"],
                              ["clean"],
                            ],
                          }}
                          placeholder="Write your message..."
                        />
                      </Box>
                    ) : (
                      <Box sx={{ p: 2, flex: 1, overflow: "auto" }}>
                        <TextField
                          fullWidth
                          multiline
                          minRows={15}
                          value={composeData.body}
                          onChange={(e) =>
                            setComposeData((prev) => ({
                              ...prev,
                              body: e.target.value,
                            }))
                          }
                          placeholder="Write your message..."
                          variant="standard"
                          InputProps={{
                            disableUnderline: true,
                          }}
                          sx={{
                            "& .MuiInputBase-root": {
                              fontSize: "1rem",
                            },
                          }}
                        />
                      </Box>
                    )
                  ) : (
                    <Box
                      sx={{ p: 2 }}
                      dangerouslySetInnerHTML={{
                        __html:
                          composeData.body ||
                          '<p style="color: #999;">Preview will appear here...</p>',
                      }}
                    />
                  )}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Image Preview Modal */}
      <Dialog
        open={previewAttachment !== null}
        onClose={() => setPreviewAttachment(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6">{previewAttachment?.name}</Typography>
          <Box>
            <Tooltip title="Download">
              <IconButton
                onClick={() => {
                  if (previewAttachment) {
                    const url = URL.createObjectURL(previewAttachment.file);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = previewAttachment.name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }
                }}
              >
                <DownloadIcon />
              </IconButton>
            </Tooltip>
            <IconButton onClick={() => setPreviewAttachment(null)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          {previewAttachment && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                minHeight: "400px",
              }}
            >
              <img
                src={URL.createObjectURL(previewAttachment.file)}
                alt={previewAttachment.name}
                style={{
                  maxWidth: "100%",
                  maxHeight: "70vh",
                  objectFit: "contain",
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Drawer>
  );
}

export default GlobalComposeDrawer;
