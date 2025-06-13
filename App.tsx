

import React, { useState, createContext, useContext, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { UserRole } from './types';
import LoginPage from './pages/LoginPage';
import { Layout } from './components/Layout'; // Changed to named import
// Updated import paths to reflect the user's provided file structure
import CustomerNewDemandPage from './pages/customer/CustomerNewDemandPage'; 
import CustomerMyDemandsPage from './pages/customer/CustomerMyDemandsPage'; 
import ManufacturerNewStockPage from './pages/manufacturer/ManufacturerNewStockPage';
import ManufacturerMyStockPage from './pages/manufacturer/ManufacturerMyStockPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminStockManagementPage from './pages/admin/AdminStockManagementPage';
import AdminMatchmakingPage from './pages/admin/AdminMatchmakingPage';
import AdminTruckPlanningPage from './pages/admin/AdminTruckPlanningPage';
import AdminShippingTemplatesPage from './pages/admin/AdminShippingTemplatesPage';
import AdminAiReportsPage from './pages/admin/AdminAiReportsPage';
import PlaceholderPage from './pages/PlaceholderPage';
import { useLocale } from './LocaleContext'; 

interface AppContextType {
  userRole: UserRole | null;
  setUserRole: (role: UserRole | null) => void;
  logout: () => void;
}

export const AppContext = createContext<AppContextType | null>(null);

export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

const App: React.FC = () => {
  const [userRole, setUserRoleState] = useState<UserRole | null>(null);
  const { t } = useLocale(); 

  const setUserRole = (role: UserRole | null) => {
    setUserRoleState(role);
  };
  
  const logout = () => {
    setUserRoleState(null);
  };

  const contextValue = useMemo(() => ({ userRole, setUserRole, logout }), [userRole]);

  if (!userRole) {
    return (
      <AppContext.Provider value={contextValue}>
        <LoginPage />
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Layout>
        <Routes>
          {userRole === UserRole.CUSTOMER && ( 
            <>
              <Route path="/" element={<Navigate to="/customer/new-demand" replace />} /> 
              <Route path="/customer/new-demand" element={<CustomerNewDemandPage />} />
              <Route path="/customer/my-demands" element={<CustomerMyDemandsPage />} />
            </>
          )}
          {userRole === UserRole.MANUFACTURER && (
            <>
              <Route path="/" element={<Navigate to="/manufacturer/new-stock" replace />} />
              <Route path="/manufacturer/new-stock" element={<ManufacturerNewStockPage />} />
              <Route path="/manufacturer/my-stock" element={<ManufacturerMyStockPage />} />
            </>
          )}
          {userRole === UserRole.ADMIN && (
            <>
              <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/stock-management" element={<AdminStockManagementPage />} />
              <Route path="/admin/matchmaking" element={<AdminMatchmakingPage />} />
              <Route path="/admin/truck-planning" element={<AdminTruckPlanningPage />} />
              <Route path="/admin/shipping-templates" element={<AdminShippingTemplatesPage />} />
              <Route path="/admin/ai-reports" element={<AdminAiReportsPage />} />
            </>
          )}
           <Route 
             path="*" 
             element={<PlaceholderPage title={t('pageNotFoundTitle')} message={t('pageNotFoundMessage')} />} 
           />
        </Routes>
      </Layout>
    </AppContext.Provider>
  );
};

export default App;