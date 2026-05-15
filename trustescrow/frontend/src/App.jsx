import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/common/Layout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Escrows from './pages/Escrows';
import Contracts from './pages/Contracts';
import Disputes from './pages/Disputes';
import Wallet from './pages/Wallet';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import ProtectedRoute from './hooks/ProtectedRoute';

function App() {
  return (
    <>
      <Toaster position="top-right" />
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        {/* Protected routes */}
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="escrows" element={<Escrows />} />
          <Route path="contracts" element={<Contracts />} />
          <Route path="disputes" element={<Disputes />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="chat" element={<Chat />} />
          <Route path="admin" element={<Admin />} />
        </Route>
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
