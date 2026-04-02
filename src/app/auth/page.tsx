'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Toast } from '@/components/Toast';
import { useNotification } from '@/hooks/useNotification';
import { loginUser } from '@/lib/firebase/auth';
import ES from '@/config/text.es';

export default function AuthPage() {
  const router = useRouter();
  const { notifications, removeNotification, success, error } = useNotification();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginUser(formData.email, formData.password);
      success(ES.auth.signInSuccess);
      setTimeout(() => router.push('/dashboard'), 500);
    } catch (err) {
      const code = (err as { code?: string }).code || '';
      if (
        code === 'auth/invalid-credential' ||
        code === 'auth/wrong-password' ||
        code === 'auth/user-not-found' ||
        code === 'auth/invalid-email'
      ) {
        error(ES.auth.invalidCredentials);
      } else {
        error(ES.auth.loginFailed);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Toast notifications={notifications} onDismiss={removeNotification} />
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            {ES.auth.signIn}
          </h1>
          <p className="text-center text-gray-600 text-sm mt-2">
            {ES.app.tagline}
          </p>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleLogin} className="space-y-4">
            <Input
              label={ES.auth.email}
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label={ES.auth.password}
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
            />

            <Button
              type="submit"
              loading={loading}
              className="w-full"
              size="lg"
            >
              {ES.auth.signIn}
            </Button>
          </form>

          <p className="mt-4 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
            {ES.app.contactAdmin}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
