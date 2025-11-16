import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import { DashboardPage } from './pages/DashboardPage';
import { AdminPage } from './pages/AdminPage';
import { AuthGuard } from './components/AuthGuard';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthGuard>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/mail" replace />} />
            <Route path="/mail/*" element={<DashboardPage />} />
            <Route path="/compose/*" element={<DashboardPage />} />
            <Route path="/accounts" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthGuard>
    </ThemeProvider>
  );
}

export default App;
