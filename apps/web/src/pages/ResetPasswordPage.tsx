import { useState, type FormEvent } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

/**
 * Reached from the link in the password-reset email
 * (`resetPasswordForEmail`'s `redirectTo`). Supabase establishes a recovery
 * session from the URL before this mounts, so a present `session` here means
 * a valid, unexpired reset link — not that the user is "logged in" normally.
 */
export function ResetPasswordPage() {
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <Navigate to="/" replace />;

  if (loading) {
    return <div className="flex h-screen items-center justify-center text-neutral-500">Loading…</div>;
  }

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50">
        <div className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-neutral-900">Link expired</h1>
          <p className="text-sm text-neutral-600">This password reset link is invalid or has expired.</p>
          <Link to="/login" className="text-sm text-neutral-500 underline hover:text-neutral-800">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) setError(updateError.message);
    else setDone(true);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-neutral-900">Set a new password</h1>

        <input
          type="password"
          required
          minLength={6}
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Update password
        </button>
      </form>
    </div>
  );
}
