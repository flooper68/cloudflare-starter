import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FieldError,
  Input,
  Label,
} from "@cloudflare-starter/ui";
import { type FormEvent, useState } from "react";
import { authClient, authErrorMessage } from "@/lib/auth-client";

interface FieldErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function clearField(field: keyof FieldErrors) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function resetForm() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setFieldErrors({});
  }

  function validateForm() {
    const next: FieldErrors = {};

    if (!currentPassword) next.currentPassword = "Current password is required";
    if (!newPassword) next.newPassword = "New password is required";
    if (!confirmPassword) {
      next.confirmPassword = "Please confirm the new password";
    }
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      next.confirmPassword = "Passwords do not match";
    }

    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    const { error: changeError } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });

    setLoading(false);

    if (changeError) {
      setError(authErrorMessage(changeError, "Unable to update password."));
      return;
    }

    resetForm();
    setSuccess("Password updated. Other sessions were signed out.");
  }

  return (
    <Card className="space-y-6">
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <p className="text-sm text-fg-muted">
          Change your password. Other signed-in sessions are revoked.
        </p>
      </CardHeader>

      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              aria-invalid={Boolean(fieldErrors.currentPassword)}
              onChange={(event) => {
                setCurrentPassword(event.target.value);
                clearField("currentPassword");
              }}
            />
            <FieldError message={fieldErrors.currentPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              aria-invalid={Boolean(fieldErrors.newPassword)}
              onChange={(event) => {
                setNewPassword(event.target.value);
                clearField("newPassword");
              }}
            />
            <FieldError message={fieldErrors.newPassword} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              aria-invalid={Boolean(fieldErrors.confirmPassword)}
              onChange={(event) => {
                setConfirmPassword(event.target.value);
                clearField("confirmPassword");
              }}
            />
            <FieldError message={fieldErrors.confirmPassword} />
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {success ? <p className="text-sm text-accent">{success}</p> : null}

          <Button disabled={loading} type="submit" variant="primary">
            {loading ? "Updating password..." : "Update password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
