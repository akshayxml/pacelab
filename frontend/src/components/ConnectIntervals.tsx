import { useState, type FormEvent } from "react";
import { ExternalLink, KeyRound, ShieldCheck } from "lucide-react";

interface ConnectIntervalsProps {
  /** Validates and saves the key; throws an Error with a user-facing message. */
  onConnect: (apiKey: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * Asks for the user's Intervals.icu API key. Built as a login form (hidden
 * username + password field) so password managers offer to save the key and
 * sync it to the user's other devices.
 */
export default function ConnectIntervals({ onConnect, onCancel }: ConnectIntervalsProps) {
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onConnect(apiKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <section className="panel connect-panel" aria-labelledby="connect-title">
      <div className="panel-heading">
        <div>
          <h2 id="connect-title">Connect Intervals.icu</h2>
          <p>Paste your personal API key to see your own runs.</p>
        </div>
        <KeyRound size={20} className="connect-icon" aria-hidden />
      </div>

      <form className="connect-form" onSubmit={handleSubmit}>
        <input
          type="text"
          name="username"
          autoComplete="username"
          value="Intervals.icu API key"
          readOnly
          hidden
        />
        <label htmlFor="intervals-api-key">API key</label>
        <div className="connect-row">
          <input
            id="intervals-api-key"
            name="password"
            type="password"
            autoComplete="current-password"
            spellCheck={false}
            autoCapitalize="off"
            required
            autoFocus
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "connect-error" : undefined}
          />
          <button type="submit" id="connect-submit" className="button-primary" disabled={busy}>
            {busy ? "Checking..." : "Connect"}
          </button>
          <button type="button" id="connect-cancel" className="button-ghost" onClick={onCancel}>
            Cancel
          </button>
        </div>
        {error && (
          <p id="connect-error" className="connect-error" role="alert">
            {error}
          </p>
        )}
      </form>

      <ol className="connect-steps">
        <li>
          Open{" "}
          <a href="https://intervals.icu/settings" target="_blank" rel="noopener noreferrer">
            Intervals.icu settings <ExternalLink size={11} aria-hidden />
          </a>{" "}
          and scroll to <strong>Developer Settings</strong>.
        </li>
        <li>Copy your API key (generate one if there isn't one yet) and paste it above.</li>
      </ol>

      <p className="connect-privacy">
        <ShieldCheck size={14} aria-hidden />
        The key is stored only in this browser and sent only to Intervals.icu. Disconnect to
        remove it, or revoke it anytime in Intervals.icu.
      </p>
    </section>
  );
}
