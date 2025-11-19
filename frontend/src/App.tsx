import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from './theme';
import DashboardPage from './pages/DashboardPage';
import { AuthGuard } from './components/AuthGuard';

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthGuard>
        <BrowserRouter>
          <Routes>
            {/* <Route path="/" element={<Navigate to="/mail" replace />} /> */}
            <Route path="/*" element={<DashboardPage />} />
          </Routes>
        </BrowserRouter>
      </AuthGuard>
    </ThemeProvider>
  );
}

export default App;
