import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '../components/layout';
import { HomePage } from '../pages/home';
import { LoginPage, RegisterPage } from '../pages/auth';
import { MeetingPage } from '../pages/meeting';
import { HistoryPage } from '../pages/history';
import { SettingsPage } from '../pages/settings';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ROUTES } from '../constants';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path={ROUTES.AUTH} element={<Navigate to={ROUTES.LOGIN} replace />} />
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.REGISTER} element={<RegisterPage />} />
        <Route path={ROUTES.MEETING} element={<MeetingPage />} />
        <Route path={ROUTES.HISTORY} element={<HistoryPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};
