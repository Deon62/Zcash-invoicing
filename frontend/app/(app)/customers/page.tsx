"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useZcash } from "@/lib/useZcash";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/zcashService";
import type { Customer } from "@/lib/types";

type ModalState =
  | { mode: "closed" }
  | { mode: "add" }
  | { mode: "edit"; customer: Customer }
  | { mode: "delete"; customer: Customer };

export default function CustomersPage() {
  useZcash();
  const customers = listCustomers();
  const searchParams = useSearchParams();
  const [modal, setModal] = useState<ModalState>(() =>
    searchParams.get("new") === "1" ? { mode: "add" } : { mode: "closed" }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Add / edit form state ──────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [taxPin, setTaxPin] = useState("");

  function openAdd() {
    setName("");
    setEmail("");
    setTaxPin("");
    setError("");
    setModal({ mode: "add" });
  }

  function openEdit(c: Customer) {
    setName(c.name);
    setEmail(c.email);
    setTaxPin(c.taxPin ?? "");
    setError("");
    setModal({ mode: "edit", customer: c });
  }

  function close() {
    setModal({ mode: "closed" });
    setError("");
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const input = { name, email, taxPin: taxPin || undefined };
      if (modal.mode === "add") {
        await createCustomer(input);
      } else if (modal.mode === "edit") {
        await updateCustomer(modal.customer.id, input);
      }
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save customer.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (modal.mode !== "delete") return;
    setSaving(true);
    try {
      await deleteCustomer(modal.customer.id);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete customer.");
    } finally {
      setSaving(false);
    }
  }

  const isFormModal = modal.mode === "add" || modal.mode === "edit";

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Customers"
        description="Businesses or individuals you invoice."
        action={
          <Button onClick={openAdd}>
            <Plus /> Add customer
          </Button>
        }
      />

      {customers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-muted-foreground">No customers yet.</p>
            <Button onClick={openAdd}>
              <Plus /> Add your first customer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{customers.length} customer{customers.length !== 1 ? "s" : ""}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Tax PIN</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-5 py-3 font-medium text-foreground">{c.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-5 py-3 font-mono text-muted-foreground">
                      {c.taxPin ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(c)}
                          aria-label="Edit"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => { setError(""); setModal({ mode: "delete", customer: c }); }}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ── Add / Edit modal ─────────────────────────────────────────────────── */}
      {isFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">
                {modal.mode === "add" ? "Add customer" : "Edit customer"}
              </h2>
              <Button variant="ghost" size="icon" onClick={close}>
                <X className="size-4" />
              </Button>
            </div>
            <form onSubmit={handleSave} className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label htmlFor="c-name">Name</Label>
                <Input
                  id="c-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acacia Digital Ltd"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-email">Email</Label>
                <Input
                  id="c-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="billing@acacia.co.ke"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-taxpin">Tax PIN <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="c-taxpin"
                  value={taxPin}
                  onChange={(e) => setTaxPin(e.target.value)}
                  placeholder="A00XXXXX0A"
                />
              </div>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : modal.mode === "add" ? "Add customer" : "Save changes"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation ──────────────────────────────────────────────── */}
      {modal.mode === "delete" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-xl border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Delete customer</h2>
              <Button variant="ghost" size="icon" onClick={close}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="space-y-4 p-5">
              <p className="text-sm text-muted-foreground">
                Are you sure you want to delete{" "}
                <span className="font-semibold text-foreground">{modal.customer.name}</span>?
                This cannot be undone.
              </p>
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={close}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={saving}>
                  {saving ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
