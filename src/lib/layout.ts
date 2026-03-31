import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 180;
const H_GAP = 80;
const V_GAP = 50;
const MARGIN = 50;

/**
 * Layout en árbol:
 * - Nivel 1 (hijos del raíz, depth 1): en fila horizontal.
 * - A partir del nivel 2 (depth >= 2): hijos apilados en vertical bajo su padre
 *   (como en organigramas con columna y ramas en L).
 *
 * Modo LR: misma lógica con coordenadas transpuestas (primera fila vertical, resto horizontal).
 */
export function getLayoutedElements<T extends Record<string, unknown>>(
  nodes: Node<T>[],
  edges: Edge[],
  direction: "TB" | "LR" = "TB"
): { nodes: Node<T>[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();

  edges.forEach((e) => {
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source)!.push(e.target);
    hasParent.add(e.target);
  });

  const roots = nodes.filter((n) => !hasParent.has(n.id)).map((n) => n.id);
  if (roots.length === 0) {
    return {
      nodes: nodes.map((n, i) => ({
        ...n,
        position: { x: MARGIN + i * (NODE_WIDTH + H_GAP), y: MARGIN },
      })),
      edges,
    };
  }

  const memo = new Map<string, { w: number; h: number }>();

  function subtreeSize(id: string): { w: number; h: number } {
    if (memo.has(id)) return memo.get(id)!;

    const n = nodeMap.get(id);
    if (!n) {
      const z = { w: NODE_WIDTH, h: NODE_HEIGHT };
      memo.set(id, z);
      return z;
    }

    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      const z = { w: NODE_WIDTH, h: NODE_HEIGHT };
      memo.set(id, z);
      return z;
    }

    const depth = (n.data as { depth?: number }).depth ?? 0;

    if (depth === 0) {
      let w = 0;
      let maxChildH = 0;
      ch.forEach((cid, i) => {
        const s = subtreeSize(cid);
        w += s.w + (i > 0 ? H_GAP : 0);
        maxChildH = Math.max(maxChildH, s.h);
      });
      const z = {
        w: Math.max(NODE_WIDTH, w),
        h: NODE_HEIGHT + V_GAP + maxChildH,
      };
      memo.set(id, z);
      return z;
    }

    let maxW = NODE_WIDTH;
    let h = NODE_HEIGHT;
    ch.forEach((cid) => {
      const s = subtreeSize(cid);
      maxW = Math.max(maxW, s.w);
      h += V_GAP + s.h;
    });
    const z = { w: maxW, h };
    memo.set(id, z);
    return z;
  }

  roots.forEach((r) => subtreeSize(r));

  const positions = new Map<string, { x: number; y: number }>();

  function place(id: string, x: number, y: number): void {
    positions.set(id, { x, y });
    const n = nodeMap.get(id);
    if (!n) return;

    const ch = children.get(id) ?? [];
    if (ch.length === 0) return;

    const depth = (n.data as { depth?: number }).depth ?? 0;

    if (depth === 0) {
      let curX = x;
      const childY = y + NODE_HEIGHT + V_GAP;
      ch.forEach((cid) => {
        const s = subtreeSize(cid);
        place(cid, curX, childY);
        curX += s.w + H_GAP;
      });
    } else {
      let curY = y + NODE_HEIGHT + V_GAP;
      ch.forEach((cid) => {
        place(cid, x, curY);
        const s = subtreeSize(cid);
        curY += s.h + V_GAP;
      });
    }
  }

  let offsetX = MARGIN;
  roots.forEach((rootId) => {
    place(rootId, offsetX, MARGIN);
    offsetX += subtreeSize(rootId).w + H_GAP;
  });

  let minX = Infinity;
  let minY = Infinity;
  positions.forEach((p) => {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
  });
  if (!Number.isFinite(minX)) minX = MARGIN;
  if (!Number.isFinite(minY)) minY = MARGIN;

  const dx = MARGIN - minX;
  const dy = MARGIN - minY;

  const layoutedNodes = nodes.map((node) => {
    const p = positions.get(node.id);
    if (!p) {
      return { ...node, position: { x: MARGIN, y: MARGIN } };
    }
    let x = p.x + dx;
    let y = p.y + dy;
    if (direction === "LR") {
      const t = x;
      x = y;
      y = t;
    }
    return { ...node, position: { x, y } };
  });

  return { nodes: layoutedNodes, edges };
}
