import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { AppRoutes } from './routes';
import { appTheme } from './styles/theme';
import { ThemeProvider, AuthProvider } from './contexts';

export const App: React.FC = () => {
  return (
    <ConfigProvider theme={appTheme}>
      <AntApp>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
