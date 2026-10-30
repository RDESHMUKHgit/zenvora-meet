import React from 'react';
import { Card, Typography } from 'antd';
import { useDocumentTitle } from '../../hooks';

const { Title, Paragraph } = Typography;

export const AuthPage: React.FC = () => {
  useDocumentTitle('Authentication');

  return (
    <div style={{ maxWidth: '420px', margin: '40px auto' }}>
      <Card>
        <Title level={3} style={{ textAlign: 'center', marginBottom: '8px' }}>
          Welcome
        </Title>
        <Paragraph type="secondary" style={{ textAlign: 'center', marginBottom: '24px' }}>
          Authentication module foundation ready. Features will be implemented in subsequent tasks.
        </Paragraph>
      </Card>
    </div>
  );
};
