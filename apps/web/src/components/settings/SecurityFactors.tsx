import {
  BackupCodes,
  Button,
  Callout,
  Card,
  CardTitle,
  DataState,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PasskeyList,
  SkeletonCard,
  TotpSetup,
} from "@cloudflare-starter/ui";
import { useState } from "react";
import { renderSVG } from "uqr";
import { TwoFactorChallenge } from "@/components/auth/TwoFactorChallenge";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc/client";
import { useAsync } from "@/lib/use-async";

/** Security settings and the enrollment page share the native factor-management UI. */
export function SecurityFactors({ search = "" }: { readonly search?: string }) {
  const state = useAsync(
    () => trpc.account.security.status.query(),
    "security"
  );
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [setup, setSetup] = useState<{ uri: string; codes: string[] } | null>(
    null
  );
  const [codes, setCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't update security settings."
      );
    } finally {
      setPending(false);
    }
  }
  const check = (result: {
    error: { message?: string; code?: string } | null;
  }) => {
    if (result.error) throw new Error(authErrorMessage(result.error));
  };
  return (
    <DataState
      status={state.status}
      data={state.data}
      error={state.error}
      onRetry={state.refetch}
      loading={<SkeletonCard />}
      empty={
        <EmptyState
          title="Security status unavailable"
          description="Reload this page to try again."
        />
      }
    >
      {(data) => {
        const forceChallenge =
          new URLSearchParams(search).get("stepUp") === "1";
        if (
          data.enrolled &&
          (data.decision === "step_up_required" || forceChallenge)
        )
          return (
            <TwoFactorChallenge
              emailOtp={data.settings.emailOtp}
              trustedDays={forceChallenge ? 0 : data.settings.trustedDeviceDays}
              search={search}
            />
          );
        if (codes)
          return (
            <BackupCodes
              codes={codes}
              onDone={() => {
                setCodes(null);
                void state.refetch();
              }}
            />
          );
        if (setup)
          return (
            <TotpSetup
              qrUrl={`data:image/svg+xml,${encodeURIComponent(renderSVG(setup.uri))}`}
              secret={new URL(setup.uri).searchParams.get("secret") ?? ""}
              code={code}
              onCode={setCode}
              pending={pending}
              error={error}
              onVerify={() =>
                void run(async () => {
                  const result = await authClient.twoFactor.verifyTotp({
                    code,
                  });
                  check(result);
                  setCodes(setup.codes);
                  setSetup(null);
                  setPassword("");
                  await state.refetch();
                })
              }
            />
          );
        return (
          <div className="space-y-4">
            {data.decision === "enrollment_required" ? (
              <Callout
                tone="warning"
                title="Two-factor authentication is required"
                description="Set up your authenticator before continuing."
              />
            ) : null}
            {error ? <ErrorState variant="inline" description={error} /> : null}
            <Card className="space-y-4">
              <CardTitle>Two-factor authentication</CardTitle>
              <p className="text-sm text-fg-muted">
                {data.settings.mode === "off"
                  ? "Two-factor authentication is disabled for this app."
                  : data.enrolled
                    ? "Your authenticator protects your sign-ins."
                    : "Protect your account with an authenticator and recovery codes."}
              </p>
              {data.settings.mode !== "off" ? (
                <>
                  {data.hasPassword ? (
                    <Field label="Password for security changes">
                      <Input
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </Field>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {!data.enrolled ? (
                      <Button
                        variant="primary"
                        loading={pending}
                        onClick={() =>
                          void run(async () => {
                            const result = await authClient.twoFactor.enable({
                              password: password || undefined,
                            });
                            check(result);
                            if (
                              result.data &&
                              "totpURI" in result.data &&
                              result.data.totpURI
                            )
                              setSetup({
                                uri: result.data.totpURI,
                                codes: result.data.backupCodes ?? [],
                              });
                          })
                        }
                      >
                        Set up authenticator
                      </Button>
                    ) : (
                      <>
                        <Button
                          disabled={pending}
                          onClick={() =>
                            void run(async () => {
                              const result =
                                await authClient.twoFactor.generateBackupCodes({
                                  password: password || undefined,
                                });
                              check(result);
                              setCodes(result.data?.backupCodes ?? []);
                              setPassword("");
                            })
                          }
                        >
                          Regenerate recovery codes
                        </Button>
                        {!data.required ? (
                          <Button
                            disabled={pending}
                            onClick={() =>
                              void run(async () => {
                                const result =
                                  await authClient.twoFactor.disable({
                                    password: password || undefined,
                                  });
                                check(result);
                                setPassword("");
                                await state.refetch();
                              })
                            }
                          >
                            Disable two-factor authentication
                          </Button>
                        ) : null}
                      </>
                    )}
                  </div>
                </>
              ) : null}
            </Card>
            {data.settings.passkeys && data.decision === "allowed" ? (
              <Card className="space-y-4">
                <CardTitle>Passkeys</CardTitle>
                <Field label="Passkey name">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Personal laptop"
                  />
                </Field>
                <PasskeyList
                  items={data.passkeys}
                  pending={pending}
                  onAdd={() =>
                    void run(async () => {
                      const result = await authClient.passkey.addPasskey({
                        name: name.trim() || undefined,
                      });
                      if (result?.error)
                        throw new Error(authErrorMessage(result.error));
                      setName("");
                      await state.refetch();
                    })
                  }
                  onRemove={(id) =>
                    void run(async () => {
                      const result = await authClient.passkey.deletePasskey({
                        id,
                      });
                      check(result);
                      await state.refetch();
                    })
                  }
                />
              </Card>
            ) : null}
            {data.decision === "allowed" ? (
              <Button asChild>
                <a href="/app/dashboard">Continue to app</a>
              </Button>
            ) : null}
          </div>
        );
      }}
    </DataState>
  );
}
