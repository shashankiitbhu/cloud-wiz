import type { Edge } from "@xyflow/react";
import type { InfraNode } from "@/store/useCanvasStore";

export interface SavedArchitecture {
  id: string;
  name: string;
  description: string;
  nodes: InfraNode[];
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "cloudwiz_architectures";
const CURRENT_KEY = "cloudwiz_current";

export function generateId(): string {
  return `arch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listSaved(): SavedArchitecture[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedArchitecture[];
  } catch {
    return [];
  }
}

export function saveArchitecture(arch: SavedArchitecture): void {
  const existing = listSaved();
  const idx = existing.findIndex((a) => a.id === arch.id);
  if (idx >= 0) {
    existing[idx] = { ...arch, updatedAt: Date.now() };
  } else {
    existing.unshift(arch);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteArchitecture(id: string): void {
  const existing = listSaved().filter((a) => a.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function loadArchitecture(id: string): SavedArchitecture | null {
  return listSaved().find((a) => a.id === id) || null;
}

export function setCurrentId(id: string | null): void {
  if (id) {
    localStorage.setItem(CURRENT_KEY, id);
  } else {
    localStorage.removeItem(CURRENT_KEY);
  }
}

export function getCurrentId(): string | null {
  return localStorage.getItem(CURRENT_KEY);
}
