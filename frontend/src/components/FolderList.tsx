import { useEffect, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Collapse,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import LoadingDisplay from "./LoadingDisplay";
import {
  ChevronLeft,
  Delete,
  Drafts,
  Edit,
  Folder as FolderIcon,
  Inbox,
  Send,
  Star,
} from "@mui/icons-material";
import { emailAccountsApi, emailsApi } from "../api";
import { useSocketStore } from "../stores/socketStore";
import { useLocation, useNavigate } from "react-router-dom";
import { 
  useAccountStore,
  type EmailAccountWithIdle 
} from "../stores/accountStore";
import { useComposeStore } from "../stores/composeStore";

const getFolderIcon = (
  specialUse?: string | null,
  folderName?: string,
  folderPath?: string
) => {
  // Check specialUse first
  const upperSpecialUse = specialUse?.toUpperCase();

  switch (upperSpecialUse) {
    case "INBOX":
    case "\\INBOX":
      return <Inbox fontSize="small" />;
    case "SENT":
    case "\\SENT":
      return <Send fontSize="small" />;
    case "DRAFTS":
    case "\\DRAFTS":
      return <Drafts fontSize="small" />;
    case "TRASH":
    case "\\TRASH":
      return <Delete fontSize="small" />;
    case "JUNK":
    case "\\JUNK":
    case "SPAM":
      return <Star fontSize="small" />;
  }

  // Fallback: check folder name/path if specialUse not set
  const upperName = folderName?.toUpperCase() || "";
  const upperPath = folderPath?.toUpperCase() || "";

  if (upperName === "INBOX" || upperPath === "INBOX") {
    return <Inbox fontSize="small" />;
  } else if (
    upperName === "SENT" ||
    upperName === "SENT ITEMS" ||
    upperPath.includes("SENT")
  ) {
    return <Send fontSize="small" />;
  } else if (upperName === "DRAFTS" || upperPath.includes("DRAFT")) {
    return <Drafts fontSize="small" />;
  } else if (
    upperName === "TRASH" ||
    upperName === "DELETED" ||
    upperPath.includes("TRASH")
  ) {
    return <Delete fontSize="small" />;
  } else if (
    upperName === "JUNK" ||
    upperName === "SPAM" ||
    upperPath.includes("JUNK") ||
    upperPath.includes("SPAM")
  ) {
    return <Star fontSize="small" />;
  }

  return <FolderIcon fontSize="small" />;
};

function FolderList() {
  const accounts = useAccountStore((state) => state.accounts);
  const setAccounts = useAccountStore((state) => state.setAccounts);

  useEffect(() => {
    emailAccountsApi
      .getAll()
      .then((acc) => {
        // Sort accounts by email address
        acc.sort((a, b) => a.emailAddress.localeCompare(b.emailAddress));
        setAccounts(acc);
      })
      .catch((err) => {
        console.error("Failed to load email accounts:", err);
        setAccounts([]);
      });
  }, [setAccounts]);

  return (
    <Box
      sx={{
        width: 300,
        height: "100%",
        bgcolor: "background.default",
        borderRight: 1,
        borderColor: "divider",
      }}
    >
      {!accounts ? (
        <LoadingDisplay text="Loading accounts..." />
      ) : (
        <Box>
          <Box sx={{ mb: 0, width: '100%', p: 2 }}>
            <Button variant="contained" fullWidth disabled={accounts.filter(acc => acc.isIdleConnected).length === 0} onClick={() => useComposeStore.getState().openCompose("new")}>
              <Edit fontSize="small" /> Compose
            </Button>
          </Box>
          {accounts.map((account) => (
            <CollapsibleAccount key={account.id} account={account} />
          ))}
        </Box>
      )}
    </Box>
  );
}

function CollapsibleAccount({ account }: { account: EmailAccountWithIdle }) {
  const { socket } = useSocketStore();
  const folders = useAccountStore((state) => state.folders[account.id] || null);
  const setFolders = useAccountStore((state) => state.setFolders);
  const updateAccountIdleStatus = useAccountStore((state) => state.updateAccountIdleStatus);
  const [expanded, setExpanded] = useState(false);
  
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const idleStartListener = (data: {
      accountId: string;
      success: boolean;
    }) => {
      if (data.accountId === account.id && data.success) {
        socket?.off("idle:started", idleStartListener);
        
        // Update idle connection status
        updateAccountIdleStatus(account.id, true);

        emailsApi
          .getFolders(account.id)
          .then((fetchedFolders) => {
            console.log(fetchedFolders);
            fetchedFolders.sort((a, b) => {
              // Folders with specialUse come first
              const aHasSpecialUse = !!a.specialUse;
              const bHasSpecialUse = !!b.specialUse;

              if (aHasSpecialUse && !bHasSpecialUse) return -1;
              if (!aHasSpecialUse && bHasSpecialUse) return 1;

              // Then sort alphabetically by name
              return a.name.localeCompare(b.name);
            });
            setFolders(account.id, fetchedFolders);

            setExpanded(localStorage.getItem(`folderListExpanded_${account.id}`) === 'true');
          })
          .catch((err) => {
            console.error(
              `Failed to load folders for account ${account.emailAddress}:`,
              err
            );
            setFolders(account.id, []);
          });
      }
    };

    socket?.on("idle:started", idleStartListener);

    socket?.emit("idle:start", { accountId: account.id });

    return () => {
      socket?.off("idle:started", idleStartListener);
    };
  }, [socket, account.id, account.emailAddress, setFolders, updateAccountIdleStatus]);

  return (
    <Box sx={{ mb: 0 }}>
      <ListItemButton
        sx={{ py: 1.5, px: 2 }}
        onClick={() => {
          localStorage.setItem(`folderListExpanded_${account.id}`, (!expanded).toString());
          setExpanded(!expanded)
        }}
      >
        <ListItemText primary={account.emailAddress} />

        {!folders && <CircularProgress size={16} />}
        {folders && (
          <ChevronLeft
            fontSize="small"
            style={{
              transform: expanded ? "rotate(90deg)" : "rotate(-90deg)",
              transition: "transform 0.2s",
            }}
          />
        )}
      </ListItemButton>
      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <List dense sx={{ px: 0.5, pb: 1 }}>
          {folders?.map((folder) => (
            <ListItemButton
              key={encodeURIComponent(account.id  + folder.path)}
              selected={
                location.pathname === `/mail/${account.id}/${encodeURIComponent(folder.path)}`
              }
              sx={{
                borderRadius: 1,
                pl: 2,
                "&.Mui-selected": {
                  bgcolor: "primary.dark",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                },
              }}
              onClick={() => navigate(`/mail/${account.id}/${encodeURIComponent(folder.path)}`)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                {getFolderIcon(folder.specialUse, folder.name, folder.path)}
              </ListItemIcon>
              <ListItemText primary={folder.name} />
            </ListItemButton>
          ))}
        </List>
      </Collapse>
    </Box>
  );
}

export default FolderList;
