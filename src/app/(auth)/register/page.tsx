'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    daemonName: 'Pan',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (step === 1) {
      setStep(2);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <nav className="px-6 h-16 flex items-center">
        <Link href="/" className="text-[13px] text-neutral-500 hover:text-white transition-colors">
          ← Back
        </Link>
      </nav>

      <main className="flex-1 flex items-center justify-center px-6 pb-20">
        <div className="w-full max-w-[340px]">
          <div className="text-center mb-10">
            {step === 1 ? (
              <>
                <h1 className="text-[24px] font-semibold tracking-tight mb-2">Get your Pan</h1>
                <p className="text-[14px] text-neutral-500">Create your account</p>
              </>
            ) : (
              <>
                <h1 className="text-[24px] font-semibold tracking-tight mb-2">Name your Pan</h1>
                <p className="text-[14px] text-neutral-500">Like Lyra&apos;s Pantalaimon</p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {step === 1 ? (
              <>
                <input
                  type="text"
                  placeholder="Your name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full h-12 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
                  required
                />
                <div>
                  <input
                    type="password"
                    placeholder="Password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full h-12 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
                    required
                    minLength={8}
                  />
                  <p className="mt-2 text-[12px] text-neutral-600">Minimum 8 characters</p>
                </div>
              </>
            ) : (
              <div>
                <input
                  type="text"
                  placeholder="Pan"
                  value={formData.daemonName}
                  onChange={(e) => setFormData({ ...formData, daemonName: e.target.value })}
                  className="w-full h-12 px-4 bg-neutral-950 border border-neutral-800 rounded-lg text-[14px] placeholder:text-neutral-600 focus:outline-none focus:border-neutral-700 transition-colors"
                  required
                  autoFocus
                />
                <p className="mt-3 text-[12px] text-neutral-600 leading-relaxed">
                  Your Pan is your personal AI dæmon. It talks to other Pans on your behalf. 
                  You can change this name later.
                </p>
              </div>
            )}

            {error && (
              <p className="text-[13px] text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-white text-black rounded-lg font-semibold text-[14px] hover:bg-neutral-100 transition-colors disabled:opacity-50"
            >
              {step === 1 ? 'Continue' : isLoading ? 'Creating...' : 'Create Pan'}
            </button>

            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full h-12 text-[14px] text-neutral-500 hover:text-white transition-colors"
              >
                Back
              </button>
            )}
          </form>

          {step === 1 && (
            <p className="mt-10 text-center text-[13px] text-neutral-500">
              Have a Pan already?{' '}
              <Link href="/login" className="text-white hover:underline">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
