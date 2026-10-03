import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from 'react';

type AccountMode = 'create' | 'sign-in';

interface AccountModalProps {
  isOpen: boolean;
  mode: AccountMode;
  googleClientId: string | null;
  onClose: () => void;
  onModeChange: (mode: AccountMode) => void;
  onCreate: (name: string, email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onGoogle: (credential: string) => Promise<void>;
}

export function AccountModal({
  isOpen,
  mode,
  googleClientId,
  onClose,
  onModeChange,
  onCreate,
  onSignIn,
  onGoogle,
}: AccountModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const onGoogleRef = useRef(onGoogle);
  onGoogleRef.current = onGoogle;

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSubmitting(false);
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen || !googleClientId || !googleButtonRef.current) return;
    const buttonHost = googleButtonRef.current;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !buttonHost) return;
      buttonHost.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          setSubmitting(true);
          setError(null);
          onGoogleRef.current(response.credential)
            .catch((err: unknown) => {
              setError(err instanceof Error ? err.message : 'Google sign-in failed.');
            })
            .finally(() => setSubmitting(false));
        },
      });
      window.google.accounts.id.renderButton(buttonHost, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        width: 320,
      });
    };

    if (window.google) {
      render();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-google-identity]');
    const script = existing ?? document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.googleIdentity = 'true';
    script.addEventListener('load', render);
    if (!existing) document.body.appendChild(script);
    return () => {
      cancelled = true;
      script.removeEventListener('load', render);
    };
  }, [googleClientId, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await onCreate(name, email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div className="join-room-modal" onClick={handleBackdropClick}>
      <div className="join-room-modal__content" role="dialog" aria-modal="true" aria-labelledby="account-modal-title">
        <button type="button" className="join-room-modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h2 id="account-modal-title" className="join-room-modal__title">
          {mode === 'create' ? 'Create account' : 'Sign in'}
        </h2>
        <form onSubmit={handleSubmit} className="join-room-modal__form">
          {mode === 'create' && (
            <div className="join-room-modal__field">
              <label htmlFor="account-name" className="join-room-modal__label">Name</label>
              <input
                id="account-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Name shown in games"
                className="join-room-modal__input"
                maxLength={20}
                autoFocus
                required
              />
            </div>
          )}
          <div className="join-room-modal__field">
            <label htmlFor="account-email" className="join-room-modal__label">Email</label>
            <input
              id="account-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="join-room-modal__input"
              autoComplete="email"
              autoFocus={mode === 'sign-in'}
              required
            />
          </div>
          <div className="join-room-modal__field">
            <label htmlFor="account-password" className="join-room-modal__label">Password</label>
            <input
              id="account-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder={mode === 'create' ? 'At least 8 characters' : 'Password'}
              className="join-room-modal__input"
              autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
              minLength={8}
              required
            />
          </div>
          {error && <p className="account-modal__error" role="alert">{error}</p>}
          <button type="submit" className="join-room-modal__button" disabled={submitting}>
            {mode === 'create' ? 'Create account' : 'Sign in'}
          </button>
          <button
            type="button"
            className="account-modal__switch"
            onClick={() => onModeChange(mode === 'create' ? 'sign-in' : 'create')}
          >
            {mode === 'create' ? 'Already have an account? Sign in' : 'Need an account? Create one'}
          </button>
        </form>
        {googleClientId && (
          <div className="account-modal__google">
            <p className="account-modal__or">or</p>
            <div ref={googleButtonRef} className="account-modal__google-button" />
          </div>
        )}
      </div>
    </div>
  );
}
