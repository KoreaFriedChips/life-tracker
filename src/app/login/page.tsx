import { Button } from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/fields";
import { login } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const failed = typeof params.error === "string";

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-sm items-center px-4">
      <Card className="w-full p-6">
        <h1 className="mb-4 text-lg font-semibold tracking-tight">Life Tracker</h1>
        <form action={login} className="flex flex-col gap-4">
          <Field label="Password">
            <Input type="password" name="password" autoFocus required />
          </Field>
          {failed && <p className="text-sm text-danger">Wrong password.</p>}
          <Button type="submit">Sign in</Button>
        </form>
      </Card>
    </main>
  );
}
