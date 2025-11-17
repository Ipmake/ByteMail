import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Divider,
  Paper,
  Stack,
  Autocomplete,
  Select,
  MenuItem,
  FormControl,
  Collapse,
  Snackbar,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import ShortTextIcon from '@mui/icons-material/ShortText';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { emailAccountsApi, emailsApi } from '../api';
import type { EmailAccount, Email, Folder } from '../types';
import { useSettingsStore } from '../stores/settingsStore';
import { formatDateTimeWithSettings } from '../utils/dateFormatting';

// Helper function to find inbox folder reliably
const findInboxFolder = (folders: Folder[]): Folder | undefined => {
  // Try multiple strategies to find the inbox
  
  // 1. Check for special use INBOX (case-insensitive)
  const bySpecialUse = folders.find(f => 
    f.specialUse?.toUpperCase() === 'INBOX' || 
    f.specialUse?.toUpperCase() === '\\INBOX'
  );
  if (bySpecialUse) return bySpecialUse;
  
  // 2. Check for folder path/name that is exactly "INBOX" (case-insensitive)
  const byPath = folders.find(f => 
    f.path.toUpperCase() === 'INBOX' || 
    f.name.toUpperCase() === 'INBOX'
  );
  if (byPath) return byPath;
  
  // 3. Fallback to first folder
  return folders[0];
};


interface ComposePageProps {
  mode?: 'compose' | 'reply' | 'forward' | 'draft';
  emailId?: string;
}

export const ComposePage: React.FC<ComposePageProps> = ({ mode: modeProp, emailId: emailIdProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ emailId?: string }>();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const signatureAddedRef = useRef(false);

  // Determine mode from location pathname if not provided as prop
  let mode: 'compose' | 'reply' | 'forward' | 'draft' = modeProp || 'compose';
  if (!modeProp) {
    if (location.pathname.includes('/reply')) {
      mode = 'reply';
    } else if (location.pathname.includes('/forward')) {
      mode = 'forward';
    } else if (location.pathname.includes('/draft')) {
      mode = 'draft';
    }
  }

  // Use emailId from params if available, otherwise use prop
  const emailId = params.emailId || emailIdProp;

  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [templates, setTemplates] = useState<Array<{ id: string; subject: string; textBody: string }>>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [to, setTo] = useState<string[]>([]);
  const [toInput, setToInput] = useState('');
  const [cc, setCc] = useState<string[]>([]);
  const [ccInput, setCcInput] = useState('');
  const [bcc, setBcc] = useState<string[]>([]);
  const [bccInput, setBccInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [originalEmail, setOriginalEmail] = useState<Email | null>(null);
  
  const [showTemplates, setShowTemplates] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [autoSaved, setAutoSaved] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [attachments, setAttachments] = useState<Array<{ filename: string; content: string; contentType: string; size: number }>>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');

  // Get settings from store
  const { settings } = useSettingsStore();

  // Define all callback functions before useEffect hooks
  const loadAccounts = useCallback(async () => {
    try {
      const data = await emailAccountsApi.getAll();
      setAccounts(data);
      // Only auto-select first account if not in reply/forward mode
      // (reply/forward will set the correct account after loading the original email)
      if (data.length > 0 && mode === 'compose') {
        setSelectedAccountId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
    }
  }, [mode]);

  const loadOriginalEmail = useCallback(async (id: string) => {
    try {
      const email = await emailsApi.getById(id);
      setOriginalEmail(email);
      
      // Auto-select the account that received this email
      if (email.emailAccountId) {
        setSelectedAccountId(email.emailAccountId);
      }
      
      const emailSubject = email.subject || '';
      const originalContent = email.textBody || email.htmlBody || '(No content)';
      const formattedDate = formatDateTimeWithSettings(email.date || new Date(), settings);
      const sender = email.from && email.from[0] ? email.from[0].address : '';
      
      switch (mode) {
        case 'reply':
          setTo(sender ? [sender] : []);
          setSubject(emailSubject.startsWith('Re:') ? emailSubject : `Re: ${emailSubject}`);
          setBody(`\n\n${useSettingsStore.getState().settings?.email.signature}\n\n\nOn ${formattedDate}, ${sender} wrote:\n${originalContent}`);
          break;
        
        case 'forward':
          setSubject(emailSubject.startsWith('Fwd:') ? emailSubject : `Fwd: ${emailSubject}`);
          setBody(`\n\n${useSettingsStore.getState().settings?.email.signature}\n\n\n--- Forwarded Message ---\nFrom: ${sender}\nDate: ${formattedDate}\nSubject: ${emailSubject}\n\n${originalContent}`);
          break;
      }
    } catch (error) {
      console.error('Failed to load original email:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mode, settings]);

  const loadDraft = useCallback(async (id: string) => {
    try {
      const email = await emailsApi.getById(id);
      
      // Auto-select the account that owns this draft
      if (email.emailAccountId) {
        setSelectedAccountId(email.emailAccountId);
      }
      
      // Store the draft ID for updates
      setCurrentDraftId(email.id);

      // Load draft data into form
      setSubject(email.subject || '');
      
      // Parse recipients
      if (email.to && Array.isArray(email.to)) {
        setTo(email.to.map((recipient: string | { address: string }) => 
          typeof recipient === 'string' ? recipient : recipient.address
        ));
      }
      
      if (email.cc && Array.isArray(email.cc)) {
        setCc(email.cc.map((recipient: string | { address: string }) => 
          typeof recipient === 'string' ? recipient : recipient.address
        ));
        setShowCc(true);
      }
      
      if (email.bcc && Array.isArray(email.bcc)) {
        setBcc(email.bcc.map((recipient: string | { address: string }) => 
          typeof recipient === 'string' ? recipient : recipient.address
        ));
        setShowBcc(true);
      }
      
      setBody(email.textBody || '');
      
      // Show cc/bcc if they have values
      if (email.cc && email.cc.length > 0) setShowCc(true);
      if (email.bcc && email.bcc.length > 0) setShowBcc(true);
    } catch (error) {
      console.error('Failed to load draft:', error);
      setError('Failed to load draft');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveDraft = useCallback(async () => {
    if (!selectedAccountId || isSavingDraft) return;
    
    setIsSavingDraft(true);
    try {
      const result = await emailsApi.saveDraft({
        accountId: selectedAccountId,
        to,
        cc,
        bcc,
        subject,
        body,
        draftId: currentDraftId || undefined,
      });
      
      // Store the draft ID for future updates
      if (result.draft && !currentDraftId) {
        setCurrentDraftId(result.draft.id);
      }
      
      setAutoSaved(true);
      setTimeout(() => setAutoSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save draft:', error);
    } finally {
      setIsSavingDraft(false);
    }
  }, [selectedAccountId, isSavingDraft, to, cc, bcc, subject, body, currentDraftId]);

  const loadTemplates = useCallback(async () => {
    if (!selectedAccountId) return;
    
    setIsLoadingTemplates(true);
    try {
      const result = await emailsApi.getTemplates(selectedAccountId);
      setTemplates(result.templates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, [selectedAccountId]);

  // Now the useEffect hooks that depend on these callbacks
  useEffect(() => {
    loadAccounts();
    if (emailId && (mode === 'reply' || mode === 'forward')) {
      loadOriginalEmail(emailId);
    } else if (emailId && mode === 'draft') {
      loadDraft(emailId);
    } else {
      setIsLoading(false);
    }
  }, [emailId, mode, loadAccounts, loadOriginalEmail, loadDraft]);

  // Auto-save draft
  useEffect(() => {
    if (!selectedAccountId) return; // Wait for account to be selected
    if (mode === 'draft' && !currentDraftId) return; // Don't auto-save until draft is loaded
    
    // Check if user has actually started composing (not just auto-signature)
    const hasRecipients = to.length > 0 || cc.length > 0 || bcc.length > 0;
    const hasSubject = subject.trim().length > 0;
    const signature = settings?.email.signature || '';
    const bodyWithoutSignature = body.replace(signature, '').trim();
    const hasBodyContent = bodyWithoutSignature.length > 0;
    
    // Only auto-save if user has added meaningful content
    const shouldSave = hasRecipients || hasSubject || hasBodyContent;
    
    const timer = setTimeout(() => {
      if (shouldSave) {
        saveDraft();
      }
    }, 3000);
    return () => clearTimeout(timer);
  }, [body, subject, to, cc, bcc, selectedAccountId, currentDraftId, mode, settings?.email.signature, saveDraft]);

  // Calculate stats
  useEffect(() => {
    const words = body.trim().split(/\s+/).filter(w => w.length > 0).length;
    setWordCount(words);
    setReadingTime(Math.ceil(words / 200));
  }, [body]);

  // Load templates when account changes
  useEffect(() => {
    if (selectedAccountId) {
      loadTemplates();
    }
  }, [selectedAccountId, loadTemplates]);

  // Auto-add signature for new compose emails
  useEffect(() => {
    if (mode === 'compose' && settings?.email.signature && !signatureAddedRef.current && !body) {
      setBody(`\n\n${settings.email.signature}`);
      signatureAddedRef.current = true;
    }
  }, [mode, settings?.email.signature, body]);

  const handleSend = async () => {
    if (!selectedAccountId || to.length === 0 || !subject) {
      setError('Please fill in all required fields (To, Subject)');
      return;
    }

    setIsSending(true);
    setError('');

    try {
      await emailsApi.send({
        accountId: selectedAccountId,
        to: to.join(', '),
        cc: cc.length > 0 ? cc.join(', ') : undefined,
        bcc: bcc.length > 0 ? bcc.join(', ') : undefined,
        subject,
        text: body,
        inReplyTo: mode === 'reply' ? originalEmail?.messageId : undefined,
        references: mode === 'reply' ? originalEmail?.references : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      // Delete the draft after successful send
      if (currentDraftId) {
        try {
          await emailsApi.deleteDraft(currentDraftId);
        } catch (draftErr) {
          console.error('Failed to delete draft:', draftErr);
          // Don't fail the send if draft deletion fails
        }
      }
      
      // Navigate to the inbox of the account that sent the email
      try {
        const folders = await emailsApi.getFolders(selectedAccountId);
        const inbox = findInboxFolder(folders);
        if (inbox) {
          navigate(`/mail/${inbox.id}`);
        } else {
          navigate('/mail');
        }
      } catch (err) {
        console.error('Failed to load folders:', err);
        navigate('/mail');
      }
    } catch (err) {
      setError('Failed to send email. Please try again.');
      console.error('Send error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        // Remove data URL prefix to get just base64
        const base64Content = content.split(',')[1];
        
        setAttachments((prev) => [
          ...prev,
          {
            filename: file.name,
            content: base64Content,
            contentType: file.type || 'application/octet-stream',
            size: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    event.target.value = '';
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const checkGrammar = () => {
    const commonIssues = [];
    
    if (body.includes('  ')) commonIssues.push('Multiple spaces detected');
    if (!/[.!?]$/.test(body.trim())) commonIssues.push('Missing punctuation at end');
    if (body.split('\n\n').length < 2) commonIssues.push('Consider adding paragraph breaks');
    if (!body.includes('regards') && !body.includes('sincerely') && !body.includes('thanks')) {
      commonIssues.push('Consider adding a closing');
    }
    
    if (commonIssues.length === 0) {
      setSuggestions(['✓ No issues found! Your email looks good.']);
    } else {
      setSuggestions(commonIssues);
    }
    setShowSuggestions(true);
  };

  const insertTemplate = (templateBody: string) => {
    // Check if this is a reply or forward (has quoted message markers)
    const quotedMarkers = ['--- Original Message ---', '--- Forwarded Message ---'];
    const hasQuotedText = quotedMarkers.some(marker => body.includes(marker));
    
    if (hasQuotedText && (mode === 'reply' || mode === 'forward')) {
      // Find the position of the quoted text marker
      const markerIndex = quotedMarkers.reduce((foundIndex, marker) => {
        const index = body.indexOf(marker);
        return index !== -1 && (foundIndex === -1 || index < foundIndex) ? index : foundIndex;
      }, -1);
      
      if (markerIndex !== -1) {
        // Insert template above the quoted text with proper spacing
        const quotedText = body.substring(markerIndex);
        setBody(`${templateBody}\n\n${quotedText}`);
      } else {
        // Fallback: just replace
        setBody(templateBody);
      }
    } else {
      // For new compose or if no quoted text, just replace
      setBody(templateBody);
    }
    
    setShowTemplates(false);
    setSnackbarMessage('Template inserted');
    setSnackbarOpen(true);
  };

  const handleSaveAsTemplate = async () => {
    if (!newTemplateName.trim() || !body.trim()) {
      setError('Template name and body cannot be empty');
      return;
    }

    try {
      await emailsApi.saveTemplate(selectedAccountId, newTemplateName, body);
      setShowSaveTemplateDialog(false);
      setNewTemplateName('');
      setSnackbarMessage('Template saved successfully');
      setSnackbarOpen(true);
      await loadTemplates(); // Reload templates
    } catch (err) {
      setError('Failed to save template');
      console.error(err);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await emailsApi.deleteTemplate(templateId);
      setSnackbarMessage('Template deleted');
      setSnackbarOpen(true);
      await loadTemplates(); // Reload templates
    } catch (err) {
      setError('Failed to delete template');
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', width: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ 
        px: 4, 
        py: 3, 
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="h5" sx={{ fontWeight: 500 }}>
            {mode === 'reply' ? '↩ Reply' : mode === 'forward' ? '➜ Forward' : mode === 'draft' ? '✏ Edit Draft' : '✉ New Email'}
          </Typography>
          {autoSaved && (
            <Chip 
              icon={<CheckCircleIcon />} 
              label="Draft saved" 
              size="small" 
              color="success" 
              variant="outlined"
            />
          )}
        </Box>
        <Stack direction="row" spacing={2} alignItems="center">
          {autoSaved && (
            <Typography variant="caption" color="success.main" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon fontSize="small" />
              Draft saved
            </Typography>
          )}
          {isSavingDraft && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CircularProgress size={14} />
              Saving...
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Button
            variant="text"
            onClick={() => navigate(-1)}
            size="large"
          >
            Discard
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<SaveIcon />}
            onClick={() => saveDraft()}
            disabled={isSavingDraft || !selectedAccountId}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Save Draft
          </Button>
          <Button
            variant="contained"
            size="large"
            startIcon={isSending ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            onClick={handleSend}
            disabled={isSending || to.length === 0 || !subject}
            sx={{ textTransform: 'none', fontWeight: 500, px: 3 }}
          >
            Send
          </Button>
        </Stack>
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 4 }}>
        <Box sx={{ width: "100%" }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Left Column - Recipient & Subject */}
            <Grid size={{
              xs: 12,
              lg: 5,
            }}>
              <Stack spacing={3}>
                {/* From Field */}
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    From
                  </Typography>
                  <FormControl fullWidth>
                    <Select
                      value={selectedAccountId}
                      onChange={(e) => setSelectedAccountId(e.target.value)}
                      displayEmpty
                    >
                      {accounts.map((account) => (
                        <MenuItem key={account.id} value={account.id}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {account.displayName || account.emailAddress}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {account.emailAddress}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Paper>

                {/* To/Cc/Bcc Field */}
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Recipients
                  </Typography>
                  
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      To
                    </Typography>
                    <Autocomplete
                      multiple
                      freeSolo
                      options={[]}
                      value={to}
                      onChange={(_, newValue) => setTo(newValue as string[])}
                      inputValue={toInput}
                      onInputChange={(_, newInputValue) => setToInput(newInputValue)}
                      renderTags={(value, getTagProps) =>
                        value.map((option, index) => (
                          <Chip
                            label={option}
                            size="small"
                            {...getTagProps({ index })}
                            key={index}
                            sx={{ m: 0.5 }}
                          />
                        ))
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Enter email addresses..."
                          variant="outlined"
                          size="small"
                        />
                      )}
                    />
                  </Box>

                  <Collapse in={showCc}>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Cc
                      </Typography>
                      <Autocomplete
                        multiple
                        freeSolo
                        options={[]}
                        value={cc}
                        onChange={(_, newValue) => setCc(newValue as string[])}
                        inputValue={ccInput}
                        onInputChange={(_, newInputValue) => setCcInput(newInputValue)}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              label={option}
                              size="small"
                              {...getTagProps({ index })}
                              key={index}
                              sx={{ m: 0.5 }}
                            />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Add Cc recipients..."
                            variant="outlined"
                            size="small"
                          />
                        )}
                      />
                    </Box>
                  </Collapse>

                  <Collapse in={showBcc}>
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Bcc
                      </Typography>
                      <Autocomplete
                        multiple
                        freeSolo
                        options={[]}
                        value={bcc}
                        onChange={(_, newValue) => setBcc(newValue as string[])}
                        inputValue={bccInput}
                        onInputChange={(_, newInputValue) => setBccInput(newInputValue)}
                        renderTags={(value, getTagProps) =>
                          value.map((option, index) => (
                            <Chip
                              label={option}
                              size="small"
                              {...getTagProps({ index })}
                              key={index}
                              sx={{ m: 0.5 }}
                            />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            placeholder="Add Bcc recipients..."
                            variant="outlined"
                            size="small"
                          />
                        )}
                      />
                    </Box>
                  </Collapse>

                  <Stack direction="row" spacing={1}>
                    {!showCc && (
                      <Chip
                        label="Add Cc"
                        onClick={() => setShowCc(true)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                    {!showBcc && (
                      <Chip
                        label="Add Bcc"
                        onClick={() => setShowBcc(true)}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Stack>
                </Paper>

                {/* Subject */}
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Subject
                  </Typography>
                  <TextField
                    fullWidth
                    placeholder="Enter subject..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    variant="outlined"
                    sx={{ '& input': { fontSize: '1rem', fontWeight: 500 } }}
                  />
                </Paper>

                {/* Attachments */}
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Attachments
                  </Typography>
                  
                  <input
                    type="file"
                    id="file-upload"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<AttachFileIcon />}
                      fullWidth
                      sx={{ mb: 2, justifyContent: 'flex-start', textTransform: 'none' }}
                    >
                      Attach Files
                    </Button>
                  </label>

                  {attachments.length > 0 && (
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {attachments.map((att, idx) => (
                        <Chip
                          key={idx}
                          icon={<AttachFileIcon />}
                          label={`${att.filename} (${Math.round(att.size / 1024)}KB)`}
                          onDelete={() => handleRemoveAttachment(idx)}
                          deleteIcon={<DeleteIcon />}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  )}
                </Paper>

                {/* Tools */}
                <Paper elevation={0} sx={{ p: 3, border: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 2 }}>
                    Writing Tools
                  </Typography>
                  
                  <Stack spacing={2}>
                    <Box>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<SpellcheckIcon />}
                        onClick={checkGrammar}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        Check Grammar & Style
                      </Button>
                    </Box>

                    <Box>
                      <Button
                        fullWidth
                        variant="outlined"
                        startIcon={<ShortTextIcon />}
                        onClick={() => setShowTemplates(!showTemplates)}
                        sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                      >
                        Templates
                      </Button>
                      
                      <Collapse in={showTemplates}>
                        <Stack spacing={1} sx={{ mt: 2 }}>
                          {isLoadingTemplates ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                              <CircularProgress size={20} />
                            </Box>
                          ) : templates.length === 0 ? (
                            <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                              No templates yet. Save your first template!
                            </Typography>
                          ) : (
                            templates.map(template => (
                              <Box key={template.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Button
                                  variant="text"
                                  onClick={() => insertTemplate(template.textBody)}
                                  sx={{ flex: 1, justifyContent: 'flex-start', textTransform: 'none', fontSize: '0.875rem' }}
                                >
                                  {template.subject}
                                </Button>
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteTemplate(template.id)}
                                  sx={{ opacity: 0.6 }}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Box>
                            ))
                          )}
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setShowSaveTemplateDialog(true)}
                            disabled={!body.trim()}
                            sx={{ mt: 1 }}
                          >
                            Save Current as Template
                          </Button>
                        </Stack>
                      </Collapse>
                    </Box>

                    <Divider />

                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {wordCount} words · {readingTime} min read
                      </Typography>
                    </Box>
                  </Stack>

                  {/* Suggestions */}
                  <Collapse in={showSuggestions}>
                    <Box sx={{ mt: 3, bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <LightbulbIcon fontSize="small" sx={{ mt: 0.5 }} />
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Suggestions
                          </Typography>
                          {suggestions.map((suggestion, i) => (
                            <Typography key={i} variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                              • {suggestion}
                            </Typography>
                          ))}
                        </Box>
                        <IconButton 
                          size="small" 
                          onClick={() => setShowSuggestions(false)}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Box>
                  </Collapse>
                </Paper>
              </Stack>
            </Grid>

            {/* Right Column - Message Body */}
            <Grid size={{
              xs: 12,
              lg: 7,
            }}>
              <Paper elevation={0} sx={{ p: 4, border: 1, borderColor: 'divider', minHeight: { xs: 400, lg: '100%' } }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 3 }}>
                  Message
                </Typography>
                <TextField
                  fullWidth
                  inputRef={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  multiline
                  rows={25}
                  placeholder="Write your message..."
                  variant="outlined"
                  InputProps={{ 
                    sx: {
                      fontSize: '0.95rem',
                      lineHeight: 1.8,
                      fontFamily: 'inherit',
                    }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      alignItems: 'flex-start',
                    }
                  }}
                />
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Box>

      {/* Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />

      {/* Save Template Dialog */}
      <Dialog
        open={showSaveTemplateDialog}
        onClose={() => setShowSaveTemplateDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Save as Template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Template Name"
            fullWidth
            variant="outlined"
            value={newTemplateName}
            onChange={(e) => setNewTemplateName(e.target.value)}
            placeholder="e.g., Meeting Request, Follow Up"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSaveTemplateDialog(false)}>
            Cancel
          </Button>
          <Button onClick={handleSaveAsTemplate} variant="contained">
            Save Template
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};