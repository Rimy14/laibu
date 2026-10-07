"use client";

import { Building2, Smartphone } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { PageHeader, Panel } from "@/components/shell/dashboard-shell";
import { SecureView } from "@/components/secure/secure-view";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import { Alert, Badge } from "@/components/ui/feedback";
import { Field, PasswordField } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { api, ApiError } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useSession } from "@/lib/session";

export default function SettingsPage() {
  const { user } = useSession();
  if (!user) return null;
  const isCreator = user.role === "author" || user.role === "publisher";
  return (
    <>
      <PageHeader title="Settings" description="Your profile and how you get paid." />
      <div className="flex flex-col gap-8">
        <ProfilePanel />
        {isCreator && <PayoutPanel />}
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- Profile */
function ProfilePanel() {
  const session = useSession();
  const toast = useToast();
  const user = session.user!;
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone ? `0${user.phone.slice(3)}` : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = fullName.trim() !== user.full_name || phone !== (user.phone ? `0${user.phone.slice(3)}` : "");

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await api<{ payout_name_mismatch?: boolean }>("/me", { method: "PATCH", body: { full_name: fullName, phone } });
      await session.reload();
      toast.success("Profile saved");
      if (res.payout_name_mismatch) {
        toast.warning("Update your payout method", {
          description: "Your payout account name no longer matches your profile name. Payouts are held until they match.",
        });
      }
    } catch (err) {
      setError((err as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel title="Profile" description="Your name must match your M-Pesa or bank account to receive payouts.">
      <form onSubmit={save} className="grid max-w-xl gap-5" noValidate>
        <Field label="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
        <Field label="Email" value={user.email} readOnly disabled hint="Contact support to change your email." />
        <Field
          label="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
        />
        {error && <Alert tone="danger" title={error} />}
        <div>
          <Button type="submit" variant="dark" loading={saving} loadingText="Saving…" disabled={!dirty}>
            Save profile
          </Button>
        </div>
      </form>
    </Panel>
  );
}

/* ----------------------------------------------------------------- Payout */
interface PayoutMethod {
  type: "mpesa" | "bank";
  account_name: string;
  bank_name: string | null;
  bank_branch: string | null;
  account_last4: string;
  updated_at: string;
  name_matches: boolean;
}

const KENYAN_BANKS = [
  "KCB Bank", "Equity Bank", "Co-operative Bank", "NCBA Bank", "Absa Bank Kenya", "Standard Chartered",
  "Stanbic Bank", "I&M Bank", "Diamond Trust Bank", "Family Bank", "Bank of Africa", "Sidian Bank",
  "Prime Bank", "Kingdom Bank", "Other",
];

function PayoutPanel() {
  const session = useSession();
  const [state, setState] = useState<{ method: PayoutMethod | null; allowed_types: ("mpesa" | "bank")[] } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!session.termsCurrent) return;
    api<{ method: PayoutMethod | null; allowed_types: ("mpesa" | "bank")[] }>("/me/payout-method")
      .then((s) => {
        setState(s);
        setEditing(!s.method);
      })
      .catch((e: ApiError) => setLoadError(e.message));
  }, [session.termsCurrent]);

  return (
    <div id="payout" className="scroll-mt-24">
      <Panel
        title="Payout method"
        description="Where we send your earnings on the 2nd and 4th Thursday of each month."
        actions={
          state?.method && !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
          ) : undefined
        }
      >
        {loadError ? (
          <Alert tone="danger" title={loadError} />
        ) : !state ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-64" />
            <Skeleton className="h-5 w-40" />
          </div>
        ) : editing ? (
          <PayoutForm
            allowed={state.allowed_types}
            current={state.method}
            fullName={session.user!.full_name}
            onCancel={state.method ? () => setEditing(false) : undefined}
            onSaved={(method) => {
              setState({ ...state, method });
              setEditing(false);
            }}
          />
        ) : (
          state.method && <PayoutSummary method={state.method} />
        )}
      </Panel>
    </div>
  );
}

function PayoutSummary({ method }: { method: PayoutMethod }) {
  return (
    // Sensitive view: blacks out on screenshot / window switch (client requirement)
    <SecureView className="rounded-md">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid size-11 place-items-center rounded-md bg-cream text-ink-700">
          {method.type === "mpesa" ? <Smartphone className="size-5" /> : <Building2 className="size-5" />}
        </span>
        <div className="flex-1">
          <p className="font-medium">
            {method.type === "mpesa" ? "M-Pesa" : method.bank_name} · •••• {method.account_last4}
          </p>
          <p className="text-sm text-ink-500">
            {method.account_name}
            {method.bank_branch ? ` · ${method.bank_branch} branch` : ""}
          </p>
        </div>
        {method.name_matches ? (
          <Badge tone="success">Name verified</Badge>
        ) : (
          <Badge tone="danger">Name doesn&apos;t match profile</Badge>
        )}
      </div>
      {!method.name_matches && (
        <Alert tone="warning" title="Payouts are on hold" className="mt-5">
          The name on this account must match your profile name exactly. Update one of them so they match.
        </Alert>
      )}
    </SecureView>
  );
}

function PayoutForm({
  allowed,
  current,
  fullName,
  onCancel,
  onSaved,
}: {
  allowed: ("mpesa" | "bank")[];
  current: PayoutMethod | null;
  fullName: string;
  onCancel?: () => void;
  onSaved: (m: PayoutMethod) => void;
}) {
  const toast = useToast();
  const [type, setType] = useState<"mpesa" | "bank">(current?.type && allowed.includes(current.type) ? current.type : allowed[0]);
  const [phone, setPhone] = useState("");
  const [bankChoice, setBankChoice] = useState(current?.bank_name && KENYAN_BANKS.includes(current.bank_name) ? current.bank_name : "");
  const [bankOther, setBankOther] = useState("");
  const [branch, setBranch] = useState(current?.bank_branch ?? "");
  const [account, setAccount] = useState("");
  const [account2, setAccount2] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const bankName = bankChoice === "Other" ? bankOther.trim() : bankChoice;

  const validate = () => {
    const e: Record<string, string> = {};
    if (type === "mpesa") {
      if (!/^(?:\+?254|0)?[17]\d{8}$/.test(phone.replace(/[\s-]/g, ""))) e.phone = "Enter a Kenyan mobile number, e.g. 0712 345 678.";
    } else {
      if (!bankName) e.bank = "Choose your bank.";
      const a = account.replace(/[\s-]/g, "");
      if (!/^[0-9A-Za-z]{6,20}$/.test(a)) e.account = "Enter your account number (6 to 20 letters or digits).";
      else if (a !== account2.replace(/[\s-]/g, "")) e.account2 = "The account numbers don't match.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setSaving(true);
    setServerError(null);
    try {
      const res = await api<{ method: PayoutMethod }>("/me/payout-method", {
        method: "PUT",
        body: {
          type,
          account_name: fullName,
          ...(type === "mpesa" ? { mpesa_phone: phone } : { bank_name: bankName, bank_branch: branch, bank_account: account }),
          current_password: password,
        },
      });
      setConfirmOpen(false);
      setPassword("");
      toast.success("Payout method saved", {
        description: `Payouts will go to ${type === "mpesa" ? "M-Pesa" : bankName} •••• ${res.method.account_last4}.`,
      });
      onSaved(res.method);
    } catch (e) {
      setServerError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (validate()) {
          setServerError(null);
          setConfirmOpen(true);
        }
      }}
      className="grid max-w-xl gap-6"
    >
      <fieldset>
        <legend className="text-sm font-medium">Payment type</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {(["mpesa", "bank"] as const).map((t) => {
            const enabled = allowed.includes(t);
            return (
              <label
                key={t}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-4 transition-colors",
                  type === t ? "border-ink-900 bg-cream/60" : "border-line",
                  enabled ? "cursor-pointer hover:border-ink-300" : "cursor-not-allowed opacity-55",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  disabled={!enabled}
                  onChange={() => setType(t)}
                  className="mt-1 accent-ink-900"
                />
                <span>
                  <span className="block font-medium">{t === "mpesa" ? "M-Pesa" : "Bank account"}</span>
                  <span className="block text-sm text-ink-500">
                    {t === "mpesa" ? (enabled ? "Paid to your phone" : "Not available for publishers") : "Paid by bank transfer"}
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Field
        label="Account holder name"
        value={fullName}
        readOnly
        hint="Payouts can only go to an account in your registered name. To change it, edit your profile above."
      />

      {type === "mpesa" ? (
        <Field
          label="M-Pesa number"
          required
          inputMode="tel"
          autoComplete="tel"
          placeholder="0712 345 678"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={errors.phone}
          hint={current?.type === "mpesa" ? `Currently •••• ${current.account_last4}. Enter the number again to change it.` : undefined}
        />
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="bank" className="text-sm font-medium">
              Bank<span className="ml-0.5 text-danger-600" aria-hidden>*</span>
            </label>
            <select
              id="bank"
              value={bankChoice}
              onChange={(e) => setBankChoice(e.target.value)}
              aria-invalid={errors.bank ? true : undefined}
              className={cn(
                "h-11 rounded-md border bg-white px-3 text-[0.95rem] outline-none focus:border-ink-700 focus:ring-3 focus:ring-ink-900/8",
                errors.bank ? "border-danger-600" : "border-line",
              )}
            >
              <option value="">Choose your bank</option>
              {KENYAN_BANKS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
            {errors.bank && <p role="alert" className="text-[0.8rem] text-danger-600">{errors.bank}</p>}
          </div>
          {bankChoice === "Other" && <Field label="Bank name" value={bankOther} onChange={(e) => setBankOther(e.target.value)} required />}
          <Field label="Branch (optional)" value={branch} onChange={(e) => setBranch(e.target.value)} />
          <Field
            label="Account number"
            required
            inputMode="numeric"
            autoComplete="off"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            error={errors.account}
          />
          <Field
            label="Confirm account number"
            required
            inputMode="numeric"
            autoComplete="off"
            value={account2}
            onChange={(e) => setAccount2(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            error={errors.account2}
            hint="Type it again to make sure there are no mistakes."
          />
        </>
      )}

      <div className="flex gap-3">
        <Button type="submit" variant="dark">
          Save payout method
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => !saving && setConfirmOpen(false)}
        dismissible={!saving}
        size="sm"
        title="Confirm it's you"
        description="For your security, enter your password to change where your money is sent."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="dark" onClick={submit} loading={saving} loadingText="Saving…" disabled={!password}>
              Confirm
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <PasswordField
            label="Password"
            data-autofocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && password && !saving) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          {serverError && <Alert tone="danger" title={serverError} />}
        </div>
      </Modal>
    </form>
  );
}
