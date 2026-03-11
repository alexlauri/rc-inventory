"use client";

import { useEffect, useMemo, useState } from "react";

type InventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  threshold: number;
  par: number;
  active: boolean;
  sort_order: number;
  supplier?: string | null;
  notes?: string | null;
};

const emptyForm = {
  name: "",
  category: "",
  unit: "",
  supplier: "",
  threshold: 0,
  par: 0,
  notes: "",
};

export default function AdminPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [supplierMode, setSupplierMode] = useState<"existing" | "new">("existing");
  const [newSupplier, setNewSupplier] = useState("");

  async function loadItems() {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/items");
      const json = await res.json();

      if (!res.ok) throw new Error(json.error || "Failed to load items");

      setItems(json.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  const supplierOptions = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.supplier?.trim())
          .filter((supplier): supplier is string => Boolean(supplier))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [items]);

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openCreateSheet() {
    setEditingId(null);
    setForm(emptyForm);
    setSupplierMode("existing");
    setNewSupplier("");
    setIsSheetOpen(true);
  }

  useEffect(() => {
    if (!isSheetOpen || editingId) return;

    if (supplierOptions.length === 0) {
      setSupplierMode("new");
    }
  }, [isSheetOpen, editingId, supplierOptions.length]);

  function startEdit(item: InventoryItem) {
    setEditingId(item.id);
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      supplier: item.supplier ?? "",
      threshold: item.threshold,
      par: item.par,
      notes: item.notes ?? "",
    });

    const hasExistingSupplier = item.supplier ? supplierOptions.includes(item.supplier) : false;
    setSupplierMode(hasExistingSupplier ? "existing" : "new");
    setNewSupplier(hasExistingSupplier ? "" : item.supplier ?? "");
    setIsSheetOpen(true);
  }

  function closeSheet() {
    if (saving) return;
    setEditingId(null);
    setForm(emptyForm);
    setSupplierMode("existing");
    setNewSupplier("");
    setIsSheetOpen(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      setSaving(true);
      setError(null);

      const isEditing = Boolean(editingId);
      const url = isEditing ? `/api/items/${editingId}` : "/api/items";
      const method = isEditing ? "PATCH" : "POST";

      let autoFields: Record<string, unknown> = {};

      if (!isEditing) {
        const nextIdNumber = items.reduce((max, item) => {
          const match = item.id.match(/^i(\d+)$/i);
          const numericId = match ? Number(match[1]) : 0;
          return Math.max(max, numericId);
        }, 0) + 1;

        const nextSortOrder = items.reduce((max, item) => {
          return Math.max(max, item.sort_order || 0);
        }, 0) + 1;

        autoFields = {
          id: `i${nextIdNumber}`,
          sort_order: nextSortOrder,
        };
      }

      const resolvedSupplier =
        supplierMode === "new" ? newSupplier.trim() : form.supplier.trim();

      const payload = {
        ...autoFields,
        ...form,
        supplier: resolvedSupplier || null,
        threshold: Number(form.threshold),
        par: Number(form.par),
        active: true,
      };

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) throw new Error(json.error || "Failed to save item");

      closeSheet();
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Archive this item?");
    if (!confirmed) return;

    try {
      setError(null);

      const res = await fetch(`/api/items/${id}`, {
        method: "DELETE",
      });

      const text = await res.text();
      let json: { error?: string } = {};

      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = {};
      }

      if (!res.ok) throw new Error(json.error || "Failed to delete item");

      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete item");
    }
  }

  return (
    <>
      <main className="p-6 space-y-6 pb-24">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Admin</h1>
            <p className="text-sm text-gray-500">Create and manage inventory items.</p>
          </div>

          <button
            type="button"
            onClick={openCreateSheet}
            aria-label="Create new item"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black text-2xl leading-none text-white shadow-sm"
          >
            +
          </button>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-gray-600">Loading items...</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-lg border p-4 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">{item.name}</div>
                    <div className="text-sm text-gray-600">
                      {item.category} · {item.unit}
                      {item.supplier ? ` · ${item.supplier}` : ""}
                    </div>
                    {item.notes && (
                      <div className="text-sm text-gray-500">{item.notes}</div>
                    )}
                  </div>

                  <div className="text-right text-sm text-gray-600">
                    <div>threshold {item.threshold}</div>
                    <div>par {item.par}</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="rounded border px-3 py-2 text-sm"
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    className="rounded border px-3 py-2 text-sm text-red-700"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40">
          <button
            type="button"
            aria-label="Close sheet"
            onClick={closeSheet}
            className="absolute inset-0"
          />

          <div className="relative z-10 w-full rounded-t-3xl bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-gray-300" />

            <div className="mb-4">
              <div className="text-lg font-semibold">
                {editingId ? "Edit Item" : "Create New Item"}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 pb-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Item Name</label>
                <input
                  placeholder="Chocolate Mix"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  className="w-full rounded border px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Category</label>
                  <input
                    placeholder="Toppings"
                    value={form.category}
                    onChange={(e) => updateForm("category", e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Unit</label>
                  <input
                    placeholder="bags"
                    value={form.unit}
                    onChange={(e) => updateForm("unit", e.target.value)}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Supplier</label>

                {supplierMode === "existing" ? (
                  <>
                    <select
                      value={form.supplier}
                      onChange={(e) => {
                        if (e.target.value === "__new__") {
                          setSupplierMode("new");
                          updateForm("supplier", "");
                        } else {
                          updateForm("supplier", e.target.value);
                        }
                      }}
                      className="w-full rounded border bg-white px-3 py-2"
                    >
                      <option value="">Select a supplier</option>
                      {supplierOptions.map((supplier) => (
                        <option key={supplier} value={supplier}>
                          {supplier}
                        </option>
                      ))}
                      <option value="__new__">+ New Supplier</option>
                    </select>
                  </>
                ) : (
                  <>
                    <input
                      placeholder="Enter new supplier"
                      value={newSupplier}
                      onChange={(e) => setNewSupplier(e.target.value)}
                      className="w-full rounded border px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierMode("existing");
                        setNewSupplier("");
                      }}
                      className="text-sm text-gray-500 underline underline-offset-2"
                    >
                      Select from dropdown
                    </button>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Threshold</label>
                  <input
                    type="number"
                    value={form.threshold}
                    onChange={(e) => updateForm("threshold", Number(e.target.value))}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">Par</label>
                  <input
                    type="number"
                    value={form.par}
                    onChange={(e) => updateForm("par", Number(e.target.value))}
                    className="w-full rounded border px-3 py-2"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  placeholder="Optional notes"
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  className="w-full rounded border px-3 py-2"
                  rows={3}
                />
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded bg-black px-4 py-3 text-white disabled:opacity-50"
                >
                  {saving ? "Saving..." : editingId ? "Update Item" : "Create Item"}
                </button>

                <button
                  type="button"
                  onClick={closeSheet}
                  disabled={saving}
                  className="w-full rounded border px-4 py-3 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}