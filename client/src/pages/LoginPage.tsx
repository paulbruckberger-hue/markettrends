import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radar } from 'lucide-react';
import { useLogin } from '../hooks/useAuth';
import { apiError } from '../lib/api';

export default function LoginPage() {
  const [username, setUsername] = useState('paul');
  const [password, setPassword] = useState('');
  const login = useLogin();
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login.mutateAsync({ username, password });
      navigate('/feed');
    } catch {
      /* error rendered below */
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-600/20">
            <Radar className="text-accent-400" size={26} />
          </div>
          <h1 className="text-2xl font-bold text-slate-100">Markttrends Scouting</h1>
          <p className="mt-1 text-sm text-slate-400">B2B Content Intelligence</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-ink-800 bg-ink-900 p-6">
          <div>
            <label className="mb-1 block text-sm text-slate-300">Benutzername</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-slate-100 outline-none focus:border-accent-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Passwort</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-slate-100 outline-none focus:border-accent-500"
            />
          </div>

          {login.isError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {apiError(login.error, 'Anmeldung fehlgeschlagen')}
            </div>
          )}

          <button
            type="submit"
            disabled={login.isPending}
            className="w-full rounded-lg bg-accent-600 px-4 py-2.5 font-semibold text-white hover:bg-accent-500 disabled:opacity-50"
          >
            {login.isPending ? 'Anmeldung …' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  );
}
