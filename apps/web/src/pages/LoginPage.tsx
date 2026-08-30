import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../auth/AuthProvider";

type Mode = "sign-in" | "sign-up" | "forgot";

export function LoginPage() {
  const { session } = useAuth();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (session) return <Navigate to="/" replace />;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResetSent(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    if (mode === "forgot") {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      setSubmitting(false);
      if (resetError) setError(resetError.message);
      else setResetSent(true);
      return;
    }

    const { error: authError } =
      mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setSubmitting(false);
    if (authError) setError(authError.message);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-neutral-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-neutral-900">
          {mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Reset password"}
        </h1>

        {mode === "forgot" && resetSent ? (
          <p className="text-sm text-neutral-600">
            If an account exists for {email}, we've sent a password reset link — check your inbox.
          </p>
        ) : (
          <>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
            />

            {mode !== "forgot" && (
              <input
                type="password"
                required
                minLength={6}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              />
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Sign up" : "Send reset link"}
            </button>
          </>
        )}

        {mode === "sign-in" && (
          <button
            type="button"
            onClick={() => switchMode("forgot")}
            className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
          >
            Forgot password?
          </button>
        )}

        <button
          type="button"
          onClick={() => switchMode(mode === "sign-up" ? "sign-in" : mode === "forgot" ? "sign-in" : "sign-up")}
          className="w-full text-center text-sm text-neutral-500 hover:text-neutral-800"
        >
          {mode === "sign-up"
            ? "Have an account? Sign in"
            : mode === "forgot"
              ? "Back to sign in"
              : "Need an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
