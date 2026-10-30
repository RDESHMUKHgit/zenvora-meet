import React, { useState } from 'react';
import { Input, Button, Typography, Alert, App } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { UserCheck, Lock, Mail, User } from 'lucide-react';
import { FormField } from '../../components/forms';
import { useAuth } from '../../contexts';
import { useDocumentTitle } from '../../hooks';
import { ROUTES } from '../../constants';
import { tokens } from '../../styles/tokens';

const { Title, Text } = Typography;

const registerSchema = z
  .object({
    name: z.string().min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid work email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export const RegisterPage: React.FC = () => {
  useDocumentTitle('Create Account');
  const navigate = useNavigate();
  const { register } = useAuth();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setSubmitting(true);
      setAuthError(null);
      await register(data.name, data.email, data.password);
      message.success('Account created successfully');
      navigate(ROUTES.HOME);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setAuthError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '440px',
        margin: '40px auto',
        padding: '32px 28px',
        backgroundColor: tokens.colors.surfacePrimary,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.card,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: tokens.colors.textPrimary }}>
          Create an Account
        </Title>
        <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginTop: '6px' }}>
          Secure, enterprise-grade video meeting workspace.
        </Text>
      </div>

      {authError && (
        <Alert
          type="error"
          message={authError}
          showIcon
          closable
          onClose={() => setAuthError(null)}
          style={{ marginBottom: '18px', fontSize: '13px' }}
        />
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
      >
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <FormField label="Full Name" id="reg-name" error={errors.name?.message} required>
              <Input
                {...field}
                id="reg-name"
                prefix={<User size={15} color={tokens.colors.textLight} />}
                placeholder="Rudra Deshmukh"
                autoComplete="name"
                size="middle"
              />
            </FormField>
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field }) => (
            <FormField label="Work Email" id="reg-email" error={errors.email?.message} required>
              <Input
                {...field}
                id="reg-email"
                prefix={<Mail size={15} color={tokens.colors.textLight} />}
                placeholder="name@company.com"
                autoComplete="email"
                size="middle"
              />
            </FormField>
          )}
        />

        <Controller
          name="password"
          control={control}
          render={({ field }) => (
            <FormField
              label="Password (min. 8 characters)"
              id="reg-password"
              error={errors.password?.message}
              required
            >
              <Input.Password
                {...field}
                id="reg-password"
                prefix={<Lock size={15} color={tokens.colors.textLight} />}
                placeholder="Create password"
                autoComplete="new-password"
                size="middle"
              />
            </FormField>
          )}
        />

        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <FormField
              label="Confirm Password"
              id="reg-confirm-password"
              error={errors.confirmPassword?.message}
              required
            >
              <Input.Password
                {...field}
                id="reg-confirm-password"
                prefix={<Lock size={15} color={tokens.colors.textLight} />}
                placeholder="Re-enter password"
                autoComplete="new-password"
                size="middle"
              />
            </FormField>
          )}
        />

        <Button
          type="primary"
          htmlType="submit"
          icon={<UserCheck size={16} />}
          loading={submitting}
          style={{ height: '42px', fontWeight: 600, marginTop: '4px' }}
        >
          Create Account
        </Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Text type="secondary" style={{ fontSize: '13px' }}>
          Already have an account?{' '}
          <Link to={ROUTES.LOGIN} style={{ color: tokens.colors.accentPrimary, fontWeight: 500 }}>
            Sign In
          </Link>
        </Text>
      </div>
    </div>
  );
};
