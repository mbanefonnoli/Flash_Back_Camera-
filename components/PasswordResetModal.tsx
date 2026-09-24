"use client";

import { useState } from "react";

type Props = {
  code: string;
  onClose: () => void;
  onReset: (newPassword: string) => void;
};

export default function PasswordResetModal({ code, onClose, onReset }: Props) {
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const res = await fetch(`/api/events/${code}/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recoveryCode, newPassword }),
      });
      const json = await res.json();

      if (!json.success) {
        setError(json.error ?? "Could not reset the password.");
        return;
      }

      onReset(newPassword.trim());
    } catch {
      setError("Network error.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 px-6">
      <div className="bg-surface rounded-2xl p-6 w-full max-w-sm space-y-4">
        <h2 className="text-text-primary font-bold text-xl">Reset Host Password</h2>
        <p className="text-text-muted text-sm">
          Enter the recovery code you saved when you created this event.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={recoveryCode}
            onChange={(e) => { setRecoveryCode(e.target.value); setError(""); }}
            placeholder="XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            className="w-full py-3 px-4 bg-background border border-text-muted text-text-primary rounded-lg font-mono tracking-widest text-center placeholder:text-text-muted placeholder:tracking-normal focus:outline-none focus:border-accent"
            autoFocus
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
            placeholder="New password"
            className="w-full py-3 px-4 bg-background border border-text-muted text-text-primary rounded-lg placeholder:text-text-muted focus:outline-none focus:border-accent"
          />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-text-muted text-text-muted rounded-lg hover:border-text-primary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-accent text-background font-semibold rounded-lg hover:bg-amber-400 transition-colors disabled:opacity-50"
            >
              {saving ? "Resetting…" : "Reset"}
            </button>
          </div>
        </form>

        <p className="text-text-muted text-xs">
          Lost the recovery code too? It cannot be recovered — the server only stores a
          scrambled copy.
        </p>
      </div>
    </div>
  );
}
