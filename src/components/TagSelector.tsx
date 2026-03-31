"use client";

import { useState } from "react";
import type { Tag } from "@/types";
import TagBadge from "./TagBadge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const PRESET_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#3b82f6", "#8b5cf6", "#ec4899", "#6b7280",
];

interface TagSelectorProps {
  projectId: string;
  pageKey: string;
  availableTags: Tag[];
  selectedTagIds: string[];
  onTagsChange: (pageKey: string, tagIds: string[]) => void;
  onTagCreated: (tag: Tag) => void;
  onTagDeleted: (tagId: string) => void;
}

export default function TagSelector({
  projectId,
  pageKey,
  availableTags,
  selectedTagIds,
  onTagsChange,
  onTagCreated,
  onTagDeleted,
}: TagSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#3b82f6");
  const [creating, setCreating] = useState(false);

  async function handleToggleTag(tagId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/page-tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, tagId }),
      });
      const data = await res.json();
      onTagsChange(pageKey, data.pageTags);
    } catch (err) {
      console.error("Error toggling tag:", err);
    }
  }

  async function handleCreateTag(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      const data = await res.json();
      onTagCreated(data.tag);
      setNewName("");
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteTag(tagId: string) {
    try {
      await fetch(`/api/projects/${projectId}/tags`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });
      onTagDeleted(tagId);
    } catch (err) {
      console.error("Error deleting tag:", err);
    }
  }

  const selectedTags = availableTags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div className="relative">
      {/* Current tags + add button */}
      <div className="flex flex-wrap items-center gap-1.5">
        {selectedTags.map((tag) => (
          <TagBadge
            key={tag.id}
            tag={tag}
            size="md"
            onRemove={() => handleToggleTag(tag.id)}
          />
        ))}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-500 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Etiqueta
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => { setIsOpen(false); setShowCreate(false); }} />
          <div className="absolute left-0 top-full mt-1 z-40 bg-white rounded-lg shadow-xl border border-gray-200 w-64 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Etiquetas del proyecto</span>
              <button
                onClick={() => setShowCreate(!showCreate)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>

            {/* Tag list */}
            <div className="max-h-48 overflow-y-auto py-1">
              {availableTags.length === 0 && !showCreate && (
                <p className="text-xs text-gray-400 text-center py-4">Sin etiquetas. Crea la primera.</p>
              )}
              {availableTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 group">
                    <button
                      onClick={() => handleToggleTag(tag.id)}
                      className="flex items-center gap-2 flex-1 min-w-0"
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "border-blue-500 bg-blue-500" : "border-gray-300"}`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <TagBadge tag={tag} size="md" />
                    </button>
                    <button
                      onClick={() => handleDeleteTag(tag.id)}
                      className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Create new tag form */}
            {showCreate && (
              <form onSubmit={handleCreateTag} className="border-t border-gray-100 p-3 space-y-2">
                <Input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre de etiqueta..."
                  shape="rounded"
                  className="px-2.5 py-1.5 text-sm"
                  autoFocus
                />
                <div className="flex gap-1.5">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${newColor === c ? "scale-125 ring-2 ring-offset-1 ring-gray-400" : "hover:scale-110"}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <Button
                  type="submit"
                  variant="primary"
                  shape="rounded"
                  size="sm"
                  fullWidth
                  disabled={creating || !newName.trim()}
                  loading={creating}
                >
                  {creating ? "Creando..." : "Crear etiqueta"}
                </Button>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
