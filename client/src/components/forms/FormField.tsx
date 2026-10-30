import React from 'react';
import { Typography } from 'antd';
import { tokens } from '../../styles/tokens';

const { Text } = Typography;

interface FormFieldProps {
  label?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  id?: string;
}

export const FormField: React.FC<FormFieldProps> = ({ label, error, required, children, id }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: tokens.colors.textSecondary,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {label}
          {required && <span style={{ color: tokens.colors.error }}>*</span>}
        </label>
      )}

      {children}

      {error && (
        <Text
          role="alert"
          style={{
            fontSize: '12px',
            color: tokens.colors.error,
            marginTop: '2px',
          }}
        >
          {error}
        </Text>
      )}
    </div>
  );
};

