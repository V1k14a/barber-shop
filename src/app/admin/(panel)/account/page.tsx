import { requireUser } from "@/lib/admin/guard";
import { ActionForm, FieldError, SubmitButton } from "@/components/admin/ActionForm";
import { changePassword } from "./actions";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-light">My account</h1>
      <p className="mt-1 text-muted">
        {user.email} · {user.role === "OWNER" ? "Owner" : "Staff"}
      </p>
      <ActionForm action={changePassword} resetOnSuccess className="card mt-6 space-y-4">
        <h2 className="text-lg">Change password</h2>
        {[
          ["current", "Current password", "current-password"],
          ["password", "New password (min. 8 characters)", "new-password"],
          ["confirm", "Repeat new password", "new-password"],
        ].map(([name, label, ac]) => (
          <div key={name}>
            <label htmlFor={name} className="label">
              {label}
            </label>
            <input id={name} name={name} type="password" autoComplete={ac} required className="input" />
            <FieldError name={name} />
          </div>
        ))}
        <SubmitButton className="btn btn-primary w-full">Change password</SubmitButton>
      </ActionForm>
    </div>
  );
}
