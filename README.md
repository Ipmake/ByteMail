# ByteMail

A modern, self-hosted webmail client built with TypeScript, React, Express, and PostgreSQL.

## Features

- 🔐 **Secure Authentication** - User login with JWT tokens (no registration, admin-managed users)
- 📧 **Multi-Account Support** - Manage multiple email accounts from different servers
- 🔄 **IMAP/SMTP Integration** - Full email sync with IMAP and sending via SMTP
- 📁 **Folder Management** - View and organize emails in folders
- 🎨 **Modern UI** - Built with Material-UI with a minimalist dark theme
- ⚡ **Real-time Updates** - Socket.IO for live email notifications
- 👨‍💼 **Admin Panel** - User management and server configuration
- 🔒 **Server Restrictions** - Optional limits on allowed email servers/domains
- 🐳 **Docker Ready** - Easy deployment with Docker Compose

## Tech Stack

### Backend
- **Node.js** with **Express**
- **TypeScript** for type safety
- **Prisma ORM** with **PostgreSQL**
- **Socket.IO** for real-time updates
- **imap-simple** for IMAP email fetching
- **Nodemailer** for SMTP email sending
- **bcryptjs** for password hashing
- **jsonwebtoken** for authentication

### Frontend
- **React** with **TypeScript**
- **Vite** for fast builds
- **Material-UI (MUI)** for UI components
- **React Router** for navigation
- **Socket.IO Client** for real-time updates
- **Axios** for API requests
- **date-fns** for date formatting
- **DOMPurify** for HTML sanitization

## Prerequisites

- Docker and Docker Compose (recommended)
- OR Node.js 22+ and PostgreSQL 16+

## Quick Start with Docker

1. **Clone the repository**
   ```bash
   cd "Webmail Client"
   ```

2. **Set environment variables**
   ```bash
   # Create .env file in backend directory
   cp backend/.env.example backend/.env
   
   # Edit backend/.env and set secure secrets:
   # - JWT_SECRET (use a long random string)
   # - ENCRYPTION_KEY (use a 32-character random string)
   ```

3. **Build and start**
   ```bash
   docker-compose up -d
   ```

4. **Access ByteMail**
   - Open http://localhost:3001
   - Default admin credentials: `admin` / `admin`
   - **⚠️ Change the default password immediately!**

## Manual Setup

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials

# Run database migrations
npm run prisma:migrate

# Generate Prisma client
npm run prisma:generate

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

### Production Build

```bash
# Build frontend (outputs to www directory)
cd frontend
npm run build

# Build backend
cd ../backend
npm run build

# Start production server
npm start
```

## Configuration

### Environment Variables

Create `backend/.env`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/bytemail?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
ENCRYPTION_KEY="your-32-char-secret-key-here!!"
PORT=3001
NODE_ENV=production
```

### Admin Settings

Admins can configure:

- **Restricted Server**: Limit users to add accounts from only one IMAP/SMTP server
- **Restricted Domain**: Limit users to email addresses from one domain
- **Multiple Accounts**: Allow/disallow users to add multiple email accounts

## Usage

### Adding an Email Account

1. Log in to ByteMail
2. Click "Add Account" in the top toolbar
3. Enter your email account details:
   - Email address
   - Display name (optional)
   - IMAP server details (host, port, SSL)
   - SMTP server details (host, port, SSL)
   - Username and password
4. Click "Test Connection" to verify
5. Save the account

The system will automatically:
- Test IMAP and SMTP connections
- Sync your folders
- Fetch recent emails

### Common Email Server Settings

**Gmail:**
- IMAP: imap.gmail.com:993 (SSL)
- SMTP: smtp.gmail.com:465 (SSL)
- Note: Enable "App Passwords" in Google Account settings

**Outlook/Office 365:**
- IMAP: outlook.office365.com:993 (SSL)
- SMTP: smtp.office365.com:587 (TLS)

**Yahoo:**
- IMAP: imap.mail.yahoo.com:993 (SSL)
- SMTP: smtp.mail.yahoo.com:465 (SSL)

## Admin Panel

Access the admin panel at `/admin` (admin users only):

### User Management
- Create new users with username/password
- Set admin privileges
- Delete users
- View email account count per user

### Server Settings
- Configure server restrictions
- Control multiple account permissions

## Security Notes

- ⚠️ Change default admin password immediately
- Use strong, unique passwords for JWT_SECRET and ENCRYPTION_KEY
- Email passwords are encrypted before storage
- HTTPS is recommended for production deployments
- Consider using a reverse proxy (nginx/traefik) for SSL termination

## Development

### Project Structure

```
.
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── routes/                # API routes
│   │   ├── services/              # Business logic
│   │   ├── middleware/            # Auth middleware
│   │   ├── utils/                 # Utilities
│   │   └── index.ts               # Server entry
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/                   # API client
│   │   ├── components/            # React components
│   │   ├── contexts/              # React contexts
│   │   ├── hooks/                 # Custom hooks
│   │   ├── pages/                 # Page components
│   │   ├── types/                 # TypeScript types
│   │   ├── App.tsx                # Main app
│   │   └── theme.ts               # MUI theme
│   └── package.json
├── docker-compose.yml
└── Dockerfile
```

### API Endpoints

**Authentication:**
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

**Email Accounts:**
- `GET /api/email-accounts` - List user's accounts
- `POST /api/email-accounts` - Add account
- `PUT /api/email-accounts/:id` - Update account
- `DELETE /api/email-accounts/:id` - Delete account
- `POST /api/email-accounts/:id/sync` - Trigger sync

**Emails:**
- `GET /api/emails/accounts/:id/folders` - List folders
- `GET /api/emails/folders/:id/emails` - List emails
- `GET /api/emails/:id` - Get email details
- `POST /api/emails/send` - Send email
- `PATCH /api/emails/:id/read` - Mark as read
- `PATCH /api/emails/:id/flag` - Toggle flag

**Admin:**
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/settings` - Get server settings
- `PUT /api/admin/settings` - Update settings

## Troubleshooting

### IMAP Connection Issues
- Verify IMAP is enabled on your email provider
- Check firewall settings
- For Gmail: Enable "Less secure app access" or use App Passwords
- Verify port and SSL settings

### Database Connection Issues
- Check DATABASE_URL in .env
- Ensure PostgreSQL is running
- Verify database exists
- Check user permissions

### Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Clear build cache: `rm -rf dist www`
- Rebuild: `npm run build`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - See LICENSE file for details

## Support

For issues and questions, please create an issue on GitHub.

---

**ByteMail** - A modern, self-hosted email client for the privacy-conscious.
