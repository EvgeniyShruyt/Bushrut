import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE, SESSION_MAX_AGE, checkPasscode, createSessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  async function signIn(formData: FormData) {
    'use server';

    const passcode = String(formData.get('passcode') ?? '');
    const next = String(formData.get('next') ?? '/');
    const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/';

    if (!checkPasscode(passcode)) {
      redirect(`/login?error=1${safeNext !== '/' ? `&next=${encodeURIComponent(safeNext)}` : ''}`);
    }

    cookies().set(SESSION_COOKIE, await createSessionToken(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    redirect(safeNext);
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <form action={signIn} className="card w-full max-w-xs space-y-4 p-6">
        <div className="text-center">
          <div className="text-4xl">🏁</div>
          <h1 className="mt-2 text-xl font-bold">Трекер привычек</h1>
          <p className="mt-1 text-sm text-ink-muted">Введите код доступа</p>
        </div>

        <input type="hidden" name="next" value={searchParams.next ?? '/'} />
        <input
          name="passcode"
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          autoFocus
          required
          placeholder="••••"
          className="field tabular text-center text-2xl tracking-[0.4em]"
        />

        {searchParams.error ? (
          <p className="text-center text-sm text-racing">Неверный код</p>
        ) : null}

        <button type="submit" className="btn-primary w-full">
          Войти
        </button>
      </form>
    </div>
  );
}
