import { Drawer, Box, Typography, IconButton, CircularProgress, Paper, Avatar, Grid, useTheme, Dialog, DialogTitle, DialogContent, Tooltip } from '@mui/material'
import { useParams, useNavigate } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react';
import { emailsApi } from '../../api';
import type { Email } from '../../types';
import CloseIcon from '@mui/icons-material/Close';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ReplyIcon from '@mui/icons-material/Reply';
import ForwardIcon from '@mui/icons-material/Forward';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import DOMPurify from 'dompurify';
import { useSettingsStore } from '../../stores/settingsStore';
import { useComposeStore } from '../../stores/composeStore';
import { formatEmailViewerDateTime } from '../../utils/dateFormatting';
import { useSocketStore } from '../../stores/socketStore'; 

function GlobalEmailViewer() {
  const { accountId, folderPath, emailUid } = useParams<{ accountId: string; folderPath: string; emailUid?: string }>();
  const navigate = useNavigate();
  const openCompose = useComposeStore((state) => state.openCompose);
  
  const [email, setEmail] = useState<Email | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<{ attachment: { filename: string; contentType?: string; size: number }; index: number; url: string } | null>(null);

  const { settings } = useSettingsStore();
  const theme = useTheme();
  const socketId = useSocketStore((state) => state.socket?.id);

  const decodedFolderPath = folderPath ? decodeURIComponent(folderPath) : "";

  useEffect(() => {
    if (emailUid && accountId && decodedFolderPath) {
      loadEmail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailUid, accountId, decodedFolderPath]);

  const loadEmail = async () => {
    if (!emailUid || !accountId || !decodedFolderPath) return;
    
    console.log('Loading email:', { accountId, decodedFolderPath, emailUid });
    
    setIsLoading(true);
    try {
      const data = await emailsApi.getByUid(
        accountId,
        decodedFolderPath,
        parseInt(emailUid)
      );
      console.log('Email loaded:', data);
      setEmail(data);
    } catch (error) {
      console.error("Failed to load email:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    navigate(`/mail/${accountId}/${encodeURIComponent(decodedFolderPath || '')}`);
  };

  const handleToggleStar = async () => {
    if (!email || !accountId || !decodedFolderPath) return;
    try {
      await emailsApi.markAsFlaggedByUid(
        accountId,
        decodedFolderPath,
        email.uid,
        !email.isFlagged
      );
      setEmail({ ...email, isFlagged: !email.isFlagged });
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  };

  const handleDelete = async () => {
    if (!email || !accountId || !decodedFolderPath || !window.confirm("Delete this email?")) return;
    try {
      await emailsApi.deleteByUid(accountId, decodedFolderPath, email.uid);
      handleClose();
    } catch (error) {
      console.error("Failed to delete email:", error);
    }
  };

  const handlePreviewAttachment = async (att: { filename: string; contentType?: string; size: number }, idx: number) => {
    if (!email || !accountId || !decodedFolderPath) return;
    
    const token = localStorage.getItem('auth-token');
    const url = `${import.meta.env.VITE_API_URL || '/api'}/emails/${accountId}/${encodeURIComponent(decodedFolderPath)}/${email.uid}/attachments/${idx}?socketId=${socketId}`;
    
    const isImage = att.contentType?.startsWith('image/');
    
    if (isImage) {
      // For images, we need to create a blob URL with auth
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch attachment');
        }
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setPreviewAttachment({ attachment: att, index: idx, url: blobUrl });
      } catch (error) {
        console.error('Failed to load image attachment:', error);
        alert('Failed to load image attachment');
      }
    } else {
      // Download non-image files
      handleDownloadAttachment(url, att.filename);
    }
  };

  const handleDownloadAttachment = (url: string, filename: string) => {
    const token = localStorage.getItem('auth-token');
    
    // Create a temporary link with auth token
    fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => response.blob())
      .then(blob => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);
      })
      .catch(error => {
        console.error('Failed to download attachment:', error);
        alert('Failed to download attachment');
      });
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
    
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const processedHtml = useMemo(() => {
    if (!email?.htmlBody) return null;
    const customThemeInjection = settings?.display.applyThemeToEmailViewer ? `
        <style>
          body {
            background-color: ${theme.palette.background.paper};
            color: ${theme.palette.text.primary};
          }
          a {
            color: ${theme.palette.primary.main};
          }
        </style>
    ` : '';
    return customThemeInjection + DOMPurify.sanitize(email.htmlBody)
  }, [email?.htmlBody, settings?.display.applyThemeToEmailViewer, theme.palette.background.paper, theme.palette.text.primary, theme.palette.primary.main]);

  const fromAddress = email?.from[0];

  console.log('Rendering GlobalEmailViewer with email:', emailUid);

  return (
    <Drawer 
      open={Boolean(emailUid)} 
      onClose={handleClose} 
      anchor="right"
      PaperProps={{
        sx: {
          width: { xs: '100vw', md: '100vw', lg: '80vw' },
          maxWidth: '100%'
        }
      }}
    >
      {isLoading || !email ? (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              gap: 1,
              alignItems: 'center',
            }}
          >
            <IconButton onClick={handleClose}>
              <CloseIcon />
            </IconButton>

            <Box sx={{ flex: 1 }} />

            <IconButton onClick={handleToggleStar}>
              {email.isFlagged ? (
                <StarIcon sx={{ color: 'warning.main' }} />
              ) : (
                <StarBorderIcon />
              )}
            </IconButton>

            <IconButton onClick={() => {
              if (email && accountId && folderPath) {
                openCompose('reply', {
                  emailId: emailUid,
                  accountId,
                  folderPath,
                });
              }
            }}>
              <ReplyIcon />
            </IconButton>

            <IconButton onClick={() => {
              if (email && accountId && folderPath) {
                openCompose('forward', {
                  emailId: emailUid,
                  accountId,
                  folderPath,
                });
              }
            }}>
              <ForwardIcon />
            </IconButton>

            <IconButton onClick={handlePrint} title="Print">
              <PrintIcon />
            </IconButton>

            <IconButton onClick={handleDelete}>
              <DeleteIcon />
            </IconButton>
          </Box>

          {/* Email Content with Grid Layout */}
          <Box sx={{ flex: 1, overflow: 'hidden', p: 4 }}>
            <Grid container spacing={3} sx={{ height: '100%' }}>
              {/* Left Column - Metadata & Info */}
              <Grid
                size={{ xs: 12, lg: 4 }}
                sx={{ height: '100%', overflow: 'auto' }}
              >
                {/* Subject */}
                <Paper
                  elevation={0}
                  sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Subject
                  </Typography>
                  <Typography
                    variant="body1"
                    fontWeight={500}
                    sx={{ wordBreak: 'break-word', whiteSpace: 'wrap' }}
                  >
                    {email.subject || '(No Subject)'}
                  </Typography>
                </Paper>

                {/* From */}
                <Paper
                  elevation={0}
                  sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    From
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Avatar sx={{ width: 40, height: 40 }}>
                      {(fromAddress?.name || fromAddress?.address || 'U')
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
                    sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}
                  >
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                      To
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {email.to.map((toAddress, idx) => (
                        <Box
                          key={idx}
                          sx={{ display: 'flex', gap: 2, alignItems: 'center' }}
                        >
                          <Avatar sx={{ width: 40, height: 40 }}>
                            {(toAddress?.name || toAddress?.address || 'U')
                              .charAt(0)
                              .toUpperCase()}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={500} noWrap>
                              {toAddress?.name || toAddress?.address}
                            </Typography>
                            {toAddress?.address && toAddress?.name && (
                              <Typography variant="caption" color="text.secondary" noWrap>
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
                    sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}
                  >
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                      Cc
                    </Typography>
                    <Typography variant="body2">
                      {email.cc.map((addr) => addr.name || addr.address).join(', ')}
                    </Typography>
                  </Paper>
                )}

                {/* Date */}
                <Paper
                  elevation={0}
                  sx={{ p: 3, mb: 3, border: 1, borderColor: 'divider' }}
                >
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Date
                  </Typography>
                  <Typography variant="body2">
                    {email.date && formatEmailViewerDateTime(email.date, settings)}
                  </Typography>
                </Paper>

                {/* Attachments */}
                {email.hasAttachments && email.attachments && (
                  <Paper
                    elevation={0}
                    sx={{ p: 3, border: 1, borderColor: 'divider' }}
                  >
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                      Attachments ({email.attachments.length})
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {email.attachments.map((att, idx) => {
                        const isImage = att.contentType?.startsWith('image/');
                        const attachmentUrl = `${import.meta.env.VITE_API_URL || '/api'}/emails/${accountId}/${encodeURIComponent(decodedFolderPath)}/${email.uid}/attachments/${idx}?socketId=${socketId}`;
                        
                        return (
                          <Box
                            key={idx}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1,
                              p: 1.5,
                              border: 1,
                              borderColor: 'divider',
                              borderRadius: 1,
                              backgroundColor: (theme) => 
                                theme.palette.mode === 'dark' 
                                  ? 'rgba(255, 255, 255, 0.02)' 
                                  : 'rgba(0, 0, 0, 0.01)',
                            }}
                          >
                            {isImage ? (
                              <ImageIcon color="primary" fontSize="small" />
                            ) : (
                              <AttachFileIcon fontSize="small" />
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap fontWeight={500}>
                                {att.filename}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {Math.round(att.size / 1024)}KB
                              </Typography>
                            </Box>
                            <Tooltip title={isImage ? "Preview" : "Download"}>
                              <IconButton
                                size="small"
                                onClick={() => handlePreviewAttachment(att, idx)}
                              >
                                {isImage ? <VisibilityIcon fontSize="small" /> : <DownloadIcon fontSize="small" />}
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Download">
                              <IconButton
                                size="small"
                                onClick={() => handleDownloadAttachment(attachmentUrl, att.filename)}
                              >
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                )}
              </Grid>

              {/* Right Column - Email Content */}
              <Grid
                size={{ xs: 12, lg: 8 }}
                sx={{ height: '100%', overflow: 'auto' }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    p: 4,
                    border: 1,
                    borderColor: 'divider',
                    minHeight: '100%',
                    height: '100%',
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
                        width: '100%',
                        height: '100%',
                        minHeight: '500px',
                        border: 'none',
                        backgroundColor: 'transparent',
                      }}
                      title="Email content"
                    />
                  ) : (
                    <Typography
                      variant="body1"
                      sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {email.textBody || '(No content)'}
                    </Typography>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </Box>
        </Box>
      )}

      {/* Image Preview Modal */}
      <Dialog
        open={previewAttachment !== null}
        onClose={() => setPreviewAttachment(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6">{previewAttachment?.attachment.filename}</Typography>
          <Box>
            <Tooltip title="Download">
              <IconButton
                onClick={() => {
                  if (previewAttachment) {
                    handleDownloadAttachment(previewAttachment.url, previewAttachment.attachment.filename);
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
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '400px',
              }}
            >
              <img
                src={previewAttachment.url}
                alt={previewAttachment.attachment.filename}
                style={{
                  maxWidth: '100%',
                  maxHeight: '70vh',
                  objectFit: 'contain',
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Drawer>
  )
}

export default GlobalEmailViewer