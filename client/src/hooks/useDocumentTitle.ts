import { useEffect } from 'react';
import { APP_NAME } from '../constants';

export const useDocumentTitle = (title: string): void => {
  useEffect(() => {
    document.title = `${title} | ${APP_NAME}`;
  }, [title]);
};
