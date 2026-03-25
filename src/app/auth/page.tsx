'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardBody, CardHeader } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { useNotification } from '@/hooks/useNotification';
import { loginUser, registerUser, createUserDocument } from '@/lib/firebase/auth';

type AuthMode = 'login' | 'register';

export default function AuthPage() {
  const router = useRouter();
  const { success, error } = useNotification();
  const [mode, setMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    salonName: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await loginUser(formData.email, formData.password);
      success('Logged in successfully!');
      setTimeout(() => router.push('/dashboard'), 500);
    } catch (err) {
      error(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await registerUser(formData.email, formData.password);

      await createUserDocument(userCredential.uid, {
        id: userCredential.uid,
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        role: 'admin',
        salonId: `salon_${userCredential.uid}`,
        isActive: true,
      });

      success('Account created successfully!');
      setMode('login');
      setFormData({
        email: '',
        password: '',
        firstName: '',
        lastName: '',
        salonName: '',
      });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader>
          <h1 className="text-2xl font-bold text-gray-900 text-center">
            Salon Management
          </h1>
          <p className="text-center text-gray-600 text-sm mt-2">
            Premium beauty salon management system
          </p>
        </CardHeader>

        <CardBody>
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-4">
            {mode === 'register' && (
              <>
                <Input
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  required
                />
                <Input
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  required
                />
                <Input
                  label="Salon Name"
                  value={formData.salonName}
                  onChange={(e) =>
                    setFormData({ ...formData, salonName: e.target.value })
                  }
                  required
                />
              </>
            )}

            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />

            <Input
              label="Password"
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
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-600">
              {mode === 'login'
                ? "Don't have an account? "
                : 'Already have an account? '}
              <button
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setFormData({
                    email: '',
                    password: '',
                    firstName: '',
                    lastName: '',
                    salonName: '',
                  });
                }}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                {mode === 'login' ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
