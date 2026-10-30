import React, { useState } from 'react';
import { Input, Button, Checkbox, Typography, Alert, App } from 'antd';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, Lock, Mail } from 'lucide-react';
import { FormField } from '../../components/forms';
import { useAuth } from '../../contexts';
import { useDocumentTitle } from '../../hooks';
import { ROUTES } from '../../constants';
import { tokens } from '../../styles/tokens';

const { Title, Text } = Typography;

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  remember: z.boolean().optional(),
});

type LoginFormData = z.infer<typeof loginSchema>;

export const LoginPage: React.FC = () => {
  useDocumentTitle('Sign In');
  const navigate = useNavigate();
  const { login } = useAuth();
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      remember: true,
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      setSubmitting(true);
      setAuthError(null);
      await login(data.email, data.password);
      message.success('Signed in successfully');
      navigate(ROUTES.HOME);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid email or password';
      setAuthError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '420px',
        margin: '48px auto',
        padding: '32px 28px',
        backgroundColor: tokens.colors.surfacePrimary,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: tokens.borderRadius.lg,
        boxShadow: tokens.shadows.card,
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <Title level={3} style={{ margin: 0, fontWeight: 700, color: tokens.colors.textPrimary }}>
          Sign In
        </Title>
        <Text type="secondary" style={{ fontSize: '13px', display: 'block', marginTop: '6px' }}>
          Access your secure meetings, history, and preferences.
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
          name="email"
          control={control}
          render={({ field }) => (
            <FormField label="Email Address" id="login-email" error={errors.email?.message} required>
              <Input
                {...field}
                id="login-email"
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
              label="Password"
              id="login-password"
              error={errors.password?.message}
              required
            >
              <Input.Password
                {...field}
                id="login-password"
                prefix={<Lock size={15} color={tokens.colors.textLight} />}
                placeholder="Enter password"
                autoComplete="current-password"
                size="middle"
              />
            </FormField>
          )}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Controller
            name="remember"
            control={control}
            render={({ field: { value, onChange } }) => (
              <Checkbox checked={value} onChange={onChange}>
                <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
                  Remember me
                </span>
              </Checkbox>
            )}
          />
        </div>

        <Button
          type="primary"
          htmlType="submit"
          icon={<LogIn size={15} />}
          loading={submitting}
          style={{ height: '42px', fontWeight: 600, marginTop: '4px' }}
        >
          Sign In
        </Button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px' }}>
        <Text type="secondary" style={{ fontSize: '13px' }}>
          Don't have an account?{' '}
          <Link
            to={ROUTES.REGISTER}
            style={{ color: tokens.colors.accentPrimary, fontWeight: 500 }}
          >
            Create account
          </Link>
        </Text>
      </div>
    </div>
  );
};
