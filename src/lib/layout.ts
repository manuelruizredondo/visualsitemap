import type { Node, Edge } from "@xyflow/react";

const NODE_WIDTH = 240;
const NODE_HEIGHT = 180;
const H_GAP = 80;
const V_GAP = 50;
const MARGIN = 50;

/**
 * En modo bracket, los hijos se posicionan a la derecha del centro del padre.
 * Distancia desde el borde izquierdo del padre al borde izquierdo del hijo.
 */
const BRACKET_INDENT = NODE_WIDTH / 2 + 30;

/**
 * A partir de este depth, los hijos se apilan en vertical estilo bracket
 * en lugar de distribuirse en fila horizontal.
 */
const VERTICAL_FROM_DEPTH = 2;

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

  function getDepth(id: string): number {
    const n = nodeMap.get(id);
    return (n?.data as { depth?: number })?.depth ?? 0;
  }

  function isVertical(id: string): boolean {
    return getDepth(id) >= VERTICAL_FROM_DEPTH;
  }

  // ── Subtree sizes ─────────────────────────────────────────────────
  const memo = new Map<string, { w: number; h: number }>();

  function subtreeSize(id: string): { w: number; h: number } {
    if (memo.has(id)) return memo.get(id)!;

    const ch = children.get(id) ?? [];
    if (ch.length === 0) {
      const z = { w: NODE_WIDTH, h: NODE_HEIGHT };
      memo.set(id, z);
      return z;
    }

    if (isVertical(id)) {
      // Bracket: hijos apilados en vertical, indentados a la derecha
      let maxChildW = 0;
      let totalChildH = 0;
      ch.forEach((cid, i) => {
        const s = subtreeSize(cid);
        maxChildW = Math.max(maxChildW, s.w);
        totalChildH += s.h + (i > 0 ? V_GAP : 0);
      });
      const z = {
        w: Math.max(NODE_WIDTH, BRACKET_INDENT + maxChildW),
        h: NODE_HEIGHT + V_GAP + totalChildH,
      };
      memo.set(id, z);
      return z;
    } else {
      // Horizontal: hijos en fila
      let childrenW = 0;
      let maxChildH = 0;
      ch.forEach((cid, i) => {
        const s = subtreeSize(cid);
        childrenW += s.w + (i > 0 ? H_GAP : 0);
        maxChildH = Math.max(maxChildH, s.h);
      });
      const z = {
        w: Math.max(NODE_WIDTH, childrenW),
        h: NODE_HEIGHT + V_GAP + maxChildH,
      };
      memo.set(id, z);
      return z;
    }
  }

  roots.forEach((r) => subtreeSize(r));

  // ── Placement ─────────────────────────────────────────────────────
  const positions = new Map<string, { x: number; y: number }>();

  /**
   * place() recibe la esquina izquierda del espacio asignado (x) y la Y.
   * - Modo horizontal: el nodo se centra en su subtree width.
   * - Modo bracket: el nodo queda left-aligned (llamado con bracketAlign=true).
   */
  function place(id: string, x: number, y: number, bracketAlign = false): void {
    const ch = children.get(id) ?? [];
    const mySize = subtreeSize(id);

    if (bracketAlign) {
      // Left-aligned: el nodo se posiciona directamente en x
      positions.set(id, { x, y });
    } else {
      // Centered: el nodo se centra en su espacio asignado
      positions.set(id, { x: x + mySize.w / 2 - NODE_WIDTH / 2, y });
    }

    if (ch.length === 0) return;

    const nodeX = positions.get(id)!.x;
    const childY = y + NODE_HEIGHT + V_GAP;

    if (isVertical(id)) {
      // Bracket: hijos left-aligned a la derecha del padre
      const childBaseX = nodeX + BRACKET_INDENT;
      let curY = childY;
      ch.forEach((cid) => {
        const s = subtreeSize(cid);
        place(cid, childBaseX, curY, true); // bracket children are left-aligned
        curY += s.h + V_GAP;
      });
    } else {
      // Horizontal: hijos en fila, centrados en su espacio
      let curX = x;
      ch.forEach((cid) => {
        const s = subtreeSize(cid);
        place(cid, curX, childY, false);
        curX += s.w + H_GAP;
      });
    }
  }

  let offsetX = MARGIN;
  roots.forEach((rootId) => {
    place(rootId, offsetX, MARGIN, false);
    offsetX += subtreeSize(rootId).w + H_GAP;
  });

  // ── Normalize ─────────────────────────────────────────────────────
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
