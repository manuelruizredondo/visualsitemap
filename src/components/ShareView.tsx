"use client";

import { ReactFlowProvider, ReactFlow, Background, Controls, useNodesState, useEdgesState } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect } from "react";
import type { Project } from "@/types";
import { treeToFlow, customNodesToFlow } from "@/lib/tree-to-flow";
import { getLayoutedElements } from "@/lib/layout";
import PageNode from "@/components/PageNode";

const nodeTypes = { pageNode: PageNode };

function ShareViewInner({ project }: { project: Project }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (!project.tree) return;
    const verticalFromDepth = project.settings?.verticalFromDepth ?? 2;
    const direction = (project.settings?.direction ?? "TB") as "TB" | "LR";

    // Use treeToFlow and layout similar to SitemapCanvas
    const { nodes: treeNodes, edges: treeEdges } = treeToFlow(project.tree, verticalFromDepth);
    const { nodes: customNodes, edges: customEdges } = customNodesToFlow(project.customNodes ?? []);

    // Enrich with pageMeta
    const enrichedTreeNodes = treeNodes.map((n) => {
      const meta = project.pageMeta?.[n.data.url];
      return {
        ...n,
        data: {
          ...n.data,
          screenshotUrl: meta?.screenshotPath || "",
          thumbnailUrl: meta?.thumbnailPath,
          customImageUrl: meta?.customImageUrl,
          title: project.pageNames?.[n.data.url] || meta?.title || n.data.label,
          pageState: project.pageStates?.[n.data.url],
          tags: (project.pageTags?.[n.data.url] ?? [])
            .map((id: string) => project.tags?.find((t) => t.id === id))
            .filter(Boolean),
          availableTags: project.tags ?? [],
          selectedTagIds: project.pageTags?.[n.data.url] ?? [],
        },
      };
    });

    const enrichedCustomNodes = customNodes.map((n) => {
      const meta = project.pageMeta?.[n.id];
      return {
        ...n,
        data: {
          ...n.data,
          screenshotUrl: "",
          thumbnailUrl: undefined,
          customImageUrl: meta?.customImageUrl,
          title: project.pageNames?.[n.id] || n.data.label,
          pageState: project.pageStates?.[n.id],
          tags: (project.pageTags?.[n.id] ?? [])
            .map((id: string) => project.tags?.find((t) => t.id === id))
            .filter(Boolean),
          availableTags: project.tags ?? [],
          selectedTagIds: project.pageTags?.[n.id] ?? [],
        },
      };
    });

    // Apply layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      [...enrichedTreeNodes, ...enrichedCustomNodes],
      [...treeEdges, ...customEdges],
      direction,
      verticalFromDepth
    );

    setNodes(layoutedNodes as any);
    setEdges(layoutedEdges as any);
  }, [project]);

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "12px 20px",
        background: "#fff",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#1a1c1e" }}>
            {project.name}
          </span>
          <span style={{ fontSize: 13, color: "#6b7072", marginLeft: 10 }}>
            {project.domain}
          </span>
        </div>
        <div style={{
          fontSize: 12,
          color: "#9ca3af",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Vista de solo lectura · {project.urls.length} páginas
        </div>
      </div>
      {/* Canvas */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.05}
          maxZoom={2}
          fitView
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}

export default function ShareView({ project }: { project: Project }) {
  return (
    <ReactFlowProvider>
      <ShareViewInner project={project} />
    </ReactFlowProvider>
  );
}
