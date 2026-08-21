import type { Metadata } from "next";
import PersonForm from "@/components/PersonForm";
import { createPersonAction } from "../actions";

export const metadata: Metadata = {
  title: "Add person",
};

export default function NewPersonPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Add person</h1>
      <PersonForm action={createPersonAction} />
    </div>
  );
}
