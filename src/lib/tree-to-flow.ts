import type { Node, Edge } from "@xyflow/react";
import type { TreeNode, CustomNode } from "@/types";

export interface PageNodeData {
  nodeId: string;      // React Flow node id (same as node.id)
  label: string;
  url: string;
  fullPath: string;
  screenshotUrl?: string;
  customImageUrl?: string;
  title?: string;
  depth: number;
  isVirtual: boolean;
  isCustom?: boolean;
  hasError?: boolean;
  seoScore?: number;
  a11yScore?: number;
  isLanguage?: boolean;
  tags?: { id: string; name: string; color: string }[];
  onNameChange?: (pageKey: string, name: string) => void;
  [key: string]: unknown;
}

export function treeToFlow(tree: TreeNode): {
  nodes: Node<PageNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<PageNodeData>[] = [];
  const edges: Edge[] = [];

  function traverse(node: TreeNode, parentId?: string) {
    nodes.push({
      id: node.id,
      type: "pageNode",
      position: { x: 0, y: 0 }, // getLayoutedElements asigna posiciones
      data: {
        nodeId: node.id,
        label: node.label,
        url: node.url,
        fullPath: node.fullPath,
        depth: node.depth,
        isVirtual: !node.url && !node.isLanguage,
        isLanguage: node.isLanguage,
      },
    });

    if (parentId) {
      // depth >= 3 → bracket (smoothstep crea ángulo recto: baja → gira a la derecha)
      // depth < 3  → bezier (curva suave)
      edges.push({
        id: `edge-${parentId}-${node.id}`,
        source: parentId,
        target: node.id,
        type: node.depth >= 3 ? "smoothstep" : "bezier",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      });
    }

    for (const child of node.children) {
      traverse(child, node.id);
    }
  }

  traverse(tree);
  return { nodes, edges };
}

export function customNodesToFlow(customNodes: CustomNode[]): {
  nodes: Node<PageNodeData>[];
  edges: Edge[];
} {
  const nodes: Node<PageNodeData>[] = customNodes.map((cn) => ({
    id: cn.id,
    type: "pageNode",
    position: cn.position,
    data: {
      nodeId: cn.id,
      label: cn.label,
      url: "",
      fullPath: "",
      depth: 1,
      isVirtual: false,
      isCustom: true,
    },
  }));

  const edges: Edge[] = customNodes
    .filter((cn) => cn.parentNodeId)
    .map((cn) => ({
      id: `edge-${cn.parentNodeId}-${cn.id}`,
      source: cn.parentNodeId,
      target: cn.id,
      type: "bezier",
      style: { stroke: "#94a3b8", strokeWidth: 2 },
    }));

  return { nodes, edges };
}
