"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type NodeMouseHandler,
  type OnConnectEnd,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import PageNodeComponent from "./PageNode";
import CleanStepEdge from "./CleanStepEdge";
import ProgressOverlay from "./ProgressOverlay";
import NodeDrawer from "./NodeDrawer";
import { treeToFlow, customNodesToFlow, type PageNodeData } from "@/lib/tree-to-flow";
import { getLayoutedElements } from "@/lib/layout";
import type { Project, ScreenshotJob, Annotation, PageMeta, CustomNode, Tag, A11yData } from "@/types";

// Global project ID so PageNode can call the API without prop-drilling through React Flow
declare global {
  interface Window { __VS_PROJECT_ID__?: string; }
}

const nodeTypes = { pageNode: PageNodeComponent };
const edgeTypes = { cleanStep: CleanStepEdge };

/** Calculate accessibility score (0-10) from A11yData */
function calculateA11yScore(a11y: A11yData): number {
  let score = 10; // start perfect, deduct for issues

  // Images without alt (-1, capped)
  if (a11y.totalImages > 0 && a11y.imgWithoutAlt > 0) score--;

  // Buttons without label
  if (a11y.buttonsWithoutLabel > 0) score--;

  // Inputs without label
  if (a11y.inputsWithoutLabel > 0) score--;

  // Links without text
  if (a11y.linksWithoutText > 0) score--;

  // Missing lang attribute
  if (a11y.missingLang) score--;

  // Heading order broken
  if (!a11y.headingOrderValid) score--;

  // Low contrast texts (threshold: 3+)
  if (a11y.lowContrastTexts >= 3) score--;

  // Missing skip link
  if (a11y.missingSkipLink) score--;

  // Missing main landmark
  if (a11y.missingMainLandmark) score--;

  // Autoplaying media
  if (a11y.autoplaying > 0) score--;

  return Math.max(0, score);
}

interface SitemapCanvasProps {
  projectId: string;
}

interface SelectedNode {
  nodeKey: string;
  url: string;
  label: string;
  fullPath: string;
  screenshotUrl?: string;
  customImageUrl?: string;
  isCustom?: boolean;
  tags?: Tag[];
}

function SitemapCanvasInner({ projectId }: SitemapCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PageNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([] as Edge[]);
  const [direction, setDirection] = useState<"TB" | "LR">("TB");
  const [screenshotStatus, setScreenshotStatus] = useState<ScreenshotJob | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [filterTagId, setFilterTagId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [edgeStyle, setEdgeStyle] = useState<"bezier" | "cleanStep">("bezier");
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const thumbnailSentRef = useRef(false);
  const pageMetaSentRef = useRef(false);
  const pendingAutoCaptureRef = useRef<{ urls: string[]; jobId: string } | null>(null);
  const autoCaptureTriggeredRef = useRef(false);
  const router = useRouter();

  // Expose projectId globally for PageNode inline editing
  useEffect(() => {
    window.__VS_PROJECT_ID__ = projectId;
  }, [projectId]);

  // Ref for name change callback (used by PageNode via node data)
  const nameChangeRef = useRef<(pageKey: string, name: string) => void>(() => {});
  const stableNameChange = useCallback((pageKey: string, name: string) => nameChangeRef.current(pageKey, name), []);

  // Ref for delete callback (used by PageNode via node data)
  const deleteRef = useRef<(nodeId: string) => void>(() => {});
  const stableDelete = useCallback((nodeId: string) => deleteRef.current(nodeId), []);

  // Ref for toggle tag callback (used by PageNode context menu)
  const toggleTagRef = useRef<(pageKey: string, tagId: string, selected: boolean) => void>(() => {});
  const stableToggleTag = useCallback((pageKey: string, tagId: string, selected: boolean) => toggleTagRef.current(pageKey, tagId, selected), []);

  // Load project from API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}`);
        if (!res.ok) { setNotFound(true); setLoading(false); return; }
        const data = await res.json();
        const proj: Project = data.project;
        setProject(proj);

        const { nodes: treeNodes, edges: treeEdges } = treeToFlow(proj.tree);
        const { nodes: customNodes, edges: customEdges } = customNodesToFlow(proj.customNodes ?? []);

        // Enrich tree nodes with pageMeta data and tags
        const enrichedTreeNodes = treeNodes.map((n) => {
          const meta = proj.pageMeta?.[n.data.url];
          const tags = (proj.pageTags?.[n.data.url] ?? [])
            .map((tagId) => proj.tags?.find((t) => t.id === tagId))
            .filter((t) => t !== undefined) as Tag[];

          if (meta) {
            let seoScore: number | undefined;
            let a11yScore: number | undefined;
            if (meta.seo) {
              let score = 0;
              if (meta.seo.titleLength >= 30 && meta.seo.titleLength <= 60) score++;
              if (meta.seo.descriptionLength >= 120 && meta.seo.descriptionLength <= 160) score++;
              if (meta.seo.h1.length > 0) score++;
              if (meta.seo.h1.length === 1) score++;
              if (meta.seo.hasOgTitle) score++;
              if (meta.seo.hasOgDescription) score++;
              if (meta.seo.hasOgImage) score++;
              if (meta.seo.hasCanonical) score++;
              if (meta.seo.totalImages === 0 || meta.seo.imgWithoutAlt === 0) score++;
              if (meta.seo.wordCount > 300) score++;
              seoScore = score;
            }
            if (meta.a11y) {
              a11yScore = calculateA11yScore(meta.a11y);
            }
            const customName = proj.pageNames?.[n.data.url];
            return {
              ...n,
              data: {
                ...n.data,
                screenshotUrl: meta.screenshotPath || undefined,
                customImageUrl: meta.customImageUrl || undefined,
                title: customName || meta.title || n.data.label,
                seoScore,
                a11yScore,
                tags,
                availableTags: proj.tags ?? [],
                selectedTagIds: proj.pageTags?.[n.data.url] ?? [],
                onNameChange: stableNameChange, onDelete: stableDelete, onToggleTag: stableToggleTag,
              },
            };
          }
          const customName = proj.pageNames?.[n.data.url];
          return { ...n, data: { ...n.data, tags, title: customName || n.data.label, availableTags: proj.tags ?? [], selectedTagIds: proj.pageTags?.[n.data.url] ?? [], onNameChange: stableNameChange, onDelete: stableDelete, onToggleTag: stableToggleTag } };
        });

        // Enrich custom nodes with pageMeta
        const enrichedCustomNodes = customNodes.map((n) => {
          const meta = proj.pageMeta?.[n.id];
          if (meta) {
            return { ...n, data: { ...n.data, customImageUrl: meta.customImageUrl || undefined, availableTags: proj.tags ?? [], selectedTagIds: proj.pageTags?.[n.id] ?? [], onNameChange: stableNameChange, onDelete: stableDelete, onToggleTag: stableToggleTag } };
          }
          return { ...n, data: { ...n.data, availableTags: proj.tags ?? [], selectedTagIds: proj.pageTags?.[n.id] ?? [], onNameChange: stableNameChange, onDelete: stableDelete, onToggleTag: stableToggleTag } };
        });

        const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
          enrichedTreeNodes, treeEdges, "TB"
        );

        setNodes([...layouted, ...enrichedCustomNodes]);
        setEdges([...layoutedEdges, ...customEdges]);
        setLoading(false);
        setTimeout(() => fitView({ padding: 0.2 }), 100);

        // Auto-capture: if pages have no screenshots yet, start sequential capture
        const urlsWithoutScreenshots = proj.urls
          .filter((u: string) => u.startsWith("http"))
          .filter((u: string) => !proj.pageMeta?.[u]?.screenshotPath);

        if (urlsWithoutScreenshots.length > 0 && proj.screenshotJobId) {
          // Trigger auto-capture after component is mounted
          pendingAutoCaptureRef.current = { urls: urlsWithoutScreenshots, jobId: proj.screenshotJobId };
        }
      } catch {
        setNotFound(true);
        setLoading(false);
      }
    }
    load();
    return () => {
      if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Auto-capture: sequentially capture pages that have no screenshots yet
  useEffect(() => {
    if (!pendingAutoCaptureRef.current || autoCaptureTriggeredRef.current) return;
    autoCaptureTriggeredRef.current = true;

    const { urls, jobId } = pendingAutoCaptureRef.current;
    pendingAutoCaptureRef.current = null;

    (async () => {
      setScreenshotStatus({ jobId, status: "processing", total: urls.length, completed: 0, results: [] });
      thumbnailSentRef.current = false;
      pageMetaSentRef.current = false;

      const results: import("@/types").ScreenshotResult[] = [];
      const pageMeta: Record<string, PageMeta> = {};

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        // Mark this node as capturing
        setNodes((prev) =>
          prev.map((node) =>
            node.data.url === url ? { ...node, data: { ...node.data, isCapturing: true } } : node
          )
        );

        try {
          const captureRes = await fetch(`/api/projects/${projectId}/recapture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });

          if (captureRes.ok) {
            const { result, pageMeta: meta } = await captureRes.json();
            results.push(result);
            if (meta) pageMeta[url] = meta;

            setNodes((prev) =>
              prev.map((node) => {
                if (node.data.url === url) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      isCapturing: false,
                      screenshotUrl: result.screenshotPath || node.data.screenshotUrl,
                      title: result.title || node.data.label,
                      hasError: !!result.error,
                    },
                  };
                }
                return node;
              })
            );

            if (!thumbnailSentRef.current && result.screenshotPath && !result.error) {
              thumbnailSentRef.current = true;
              fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ thumbnailUrl: result.screenshotPath }),
              }).catch(() => {});
            }
          } else {
            results.push({ url, screenshotPath: "", title: url, description: "", error: "Capture failed" });
            setNodes((prev) =>
              prev.map((node) =>
                node.data.url === url ? { ...node, data: { ...node.data, isCapturing: false, hasError: true } } : node
              )
            );
          }
        } catch {
          results.push({ url, screenshotPath: "", title: url, description: "", error: "Network error" });
          setNodes((prev) =>
            prev.map((node) =>
              node.data.url === url ? { ...node, data: { ...node.data, isCapturing: false, hasError: true } } : node
            )
          );
        }

        setScreenshotStatus({ jobId, status: "processing", total: urls.length, completed: i + 1, results });
      }

      setScreenshotStatus({ jobId, status: "complete", total: urls.length, completed: urls.length, results });

      if (Object.keys(pageMeta).length > 0) {
        setProject((prev) =>
          prev ? { ...prev, pageMeta: { ...prev.pageMeta, ...pageMeta } } : prev
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const onLayout = useCallback(
    (dir: "TB" | "LR", overrideEdgeStyle?: "bezier" | "cleanStep") => {
      setDirection(dir);
      const eStyle = overrideEdgeStyle ?? edgeStyle;
      // Only layout non-custom nodes; keep custom nodes in their saved positions
      const treeNodes = nodes.filter((n) => !n.data.isCustom);
      const treeEdges = edges.filter((e) => {
        const srcCustom = nodes.find((n) => n.id === e.source)?.data.isCustom;
        const tgtCustom = nodes.find((n) => n.id === e.target)?.data.isCustom;
        return !srcCustom && !tgtCustom;
      });
      const customNodes = nodes.filter((n) => n.data.isCustom);
      const customEdges = edges.filter((e) => {
        const srcCustom = nodes.find((n) => n.id === e.source)?.data.isCustom;
        const tgtCustom = nodes.find((n) => n.id === e.target)?.data.isCustom;
        return srcCustom || tgtCustom;
      });
      const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(treeNodes, treeEdges, dir);
      setNodes([...layouted, ...customNodes]);
      const allEdges = [...layoutedEdges, ...customEdges].map((e) => ({ ...e, type: eStyle }));
      setEdges(allEdges);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [nodes, edges, edgeStyle, setNodes, setEdges, fitView]
  );

  // ── Drag parent → move descendants too ──────────────────────────────
  const dragStartPos = useRef<Map<string, { x: number; y: number }>>(new Map());

  const getDescendantIds = useCallback(
    (nodeId: string): Set<string> => {
      const desc = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const e of edges) {
          if (e.source === current && !desc.has(e.target)) {
            desc.add(e.target);
            stack.push(e.target);
          }
        }
      }
      return desc;
    },
    [edges]
  );

  const onNodeDragStart: OnNodeDrag = useCallback(
    (_event, node) => {
      const posMap = new Map<string, { x: number; y: number }>();
      posMap.set(node.id, { ...node.position });
      const descIds = getDescendantIds(node.id);
      for (const n of nodes) {
        if (descIds.has(n.id)) {
          posMap.set(n.id, { ...n.position });
        }
      }
      dragStartPos.current = posMap;
    },
    [nodes, getDescendantIds]
  );

  const onNodeDrag: OnNodeDrag = useCallback(
    (_event, node) => {
      const startPos = dragStartPos.current.get(node.id);
      if (!startPos) return;
      const dx = node.position.x - startPos.x;
      const dy = node.position.y - startPos.y;
      if (dx === 0 && dy === 0) return;

      const descIds = getDescendantIds(node.id);
      if (descIds.size === 0) return;

      setNodes((prev) =>
        prev.map((n) => {
          if (!descIds.has(n.id)) return n;
          const orig = dragStartPos.current.get(n.id);
          if (!orig) return n;
          return {
            ...n,
            position: { x: orig.x + dx, y: orig.y + dy },
          };
        })
      );
    },
    [getDescendantIds, setNodes]
  );

  const updateNodesForSearch = useCallback(
    (search: string) => {
      setNodes((prev) =>
        prev.map((n) => {
          const matches =
            search.length > 0 &&
            (n.data.label.toLowerCase().includes(search.toLowerCase()) ||
              n.data.url.toLowerCase().includes(search.toLowerCase()) ||
              n.data.fullPath.toLowerCase().includes(search.toLowerCase()) ||
              (n.data.title && n.data.title.toLowerCase().includes(search.toLowerCase())));

          return {
            ...n,
            style: {
              ...n.style,
              opacity: search.length === 0 || matches ? 1 : 0.3,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchTerm(value);
      updateNodesForSearch(value);
    },
    [updateNodesForSearch]
  );

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
    updateNodesForSearch("");
  }, [updateNodesForSearch]);

  const countMatches = useCallback(() => {
    if (searchTerm.length === 0) return 0;
    return nodes.filter((n) => n.style?.opacity === 1).length;
  }, [nodes, searchTerm]);

  const handleProjectNameClick = useCallback(() => {
    setEditingName(true);
    setNewName(project?.name || "");
  }, [project?.name]);

  const handleSaveName = useCallback(async () => {
    if (!newName.trim() || newName === project?.name) {
      setEditingName(false);
      return;
    }

    setSavingName(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      setProject((prev) => prev ? { ...prev, name: newName.trim() } : prev);
      setEditingName(false);
    } finally {
      setSavingName(false);
    }
  }, [projectId, newName, project?.name]);

  const handleRecaptureAll = useCallback(async () => {
    if (screenshotStatus?.status === "processing") return; // already running
    try {
      // Step 1: Prepare project (get URLs, new jobId, clear drawings)
      const res = await fetch(`/api/projects/${projectId}/recapture-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      const { jobId, urls } = (await res.json()) as { jobId: string; urls: string[]; total: number };

      // Reset refs
      thumbnailSentRef.current = false;
      pageMetaSentRef.current = false;

      // Update project with new jobId
      setProject((prev) => prev ? { ...prev, screenshotJobId: jobId, pageDrawings: {} } : prev);

      // Show progress overlay
      setScreenshotStatus({ jobId, status: "processing", total: urls.length, completed: 0, results: [] });

      // Step 2: Capture each URL one at a time via the single-recapture endpoint
      const results: import("@/types").ScreenshotResult[] = [];
      const pageMeta: Record<string, PageMeta> = {};

      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];

        // Mark this node as capturing
        setNodes((prev) =>
          prev.map((node) =>
            node.data.url === url ? { ...node, data: { ...node.data, isCapturing: true } } : node
          )
        );

        try {
          const captureRes = await fetch(`/api/projects/${projectId}/recapture`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          });

          if (captureRes.ok) {
            const { result, pageMeta: meta } = await captureRes.json();
            results.push(result);
            if (meta) pageMeta[url] = meta;

            // Update node screenshot in real time
            setNodes((prev) =>
              prev.map((node) => {
                if (node.data.url === url) {
                  return {
                    ...node,
                    data: {
                      ...node.data,
                      isCapturing: false,
                      screenshotUrl: result.screenshotPath || node.data.screenshotUrl,
                      title: result.title || node.data.label,
                      hasError: !!result.error,
                    },
                  };
                }
                return node;
              })
            );

            // Save thumbnail from first successful result
            if (!thumbnailSentRef.current && result.screenshotPath && !result.error) {
              thumbnailSentRef.current = true;
              fetch(`/api/projects/${projectId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ thumbnailUrl: result.screenshotPath }),
              }).catch(() => {});
            }
          } else {
            results.push({ url, screenshotPath: "", title: url, description: "", error: "Capture failed" });
            setNodes((prev) =>
              prev.map((node) =>
                node.data.url === url ? { ...node, data: { ...node.data, isCapturing: false, hasError: true } } : node
              )
            );
          }
        } catch {
          results.push({ url, screenshotPath: "", title: url, description: "", error: "Network error" });
          setNodes((prev) =>
            prev.map((node) =>
              node.data.url === url ? { ...node, data: { ...node.data, isCapturing: false, hasError: true } } : node
            )
          );
        }

        // Update progress
        setScreenshotStatus({ jobId, status: "processing", total: urls.length, completed: i + 1, results });
      }

      // Step 3: Mark as complete
      setScreenshotStatus({ jobId, status: "complete", total: urls.length, completed: urls.length, results });

      // Update local project pageMeta
      if (Object.keys(pageMeta).length > 0) {
        setProject((prev) =>
          prev ? { ...prev, pageMeta: { ...prev.pageMeta, ...pageMeta } } : prev
        );
      }
    } catch (err) {
      console.error("Recapture all error:", err);
      setScreenshotStatus((prev) => prev ? { ...prev, status: "error" } : null);
    }
  }, [projectId, screenshotStatus, setNodes]);

  const handleExport = useCallback(async () => {
    try {
      // @ts-ignore - html2canvas will be installed at runtime
      const { default: html2canvas } = await import("html2canvas");
      const rfElement = document.querySelector(".react-flow__viewport");
      if (!rfElement) return;

      const canvas = await html2canvas(rfElement as HTMLElement, {
        backgroundColor: "#f9fafb",
        scale: 2,
        allowTaint: true,
        useCORS: true,
      });

      canvas.toBlob((blob: Blob | null) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("download", `${project?.name || "sitemap"}.png`);
          link.setAttribute("href", url);
          link.click();
          URL.revokeObjectURL(url);
        }
      });
    } catch {
      // Export failed, silently continue
    }
  }, [project?.name]);

  const onNodeClick: NodeMouseHandler<Node<PageNodeData>> = useCallback((_event, node) => {
    const d = node.data;
    const newSelected: SelectedNode = {
      nodeKey: d.isCustom ? node.id : d.url,
      url: d.url,
      label: d.label,
      fullPath: d.fullPath,
      screenshotUrl: d.screenshotUrl,
      customImageUrl: d.customImageUrl,
      isCustom: d.isCustom,
    };

    if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
    setSelectedNode(newSelected);
    setDrawerVisible(true);
  }, []);

  function closeDrawer() {
    setDrawerVisible(false);
    drawerCloseTimerRef.current = setTimeout(() => {
      setSelectedNode(null);
    }, 300); // match transition duration
  }

  // Drag from handle to empty canvas → create new custom node
  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      // Only create a node if the connection wasn't completed (dropped on empty canvas)
      if (connectionState.isValid) return;

      const sourceNodeId = connectionState.fromNode?.id;
      if (!sourceNodeId) return;

      const clientX = (event as MouseEvent).clientX ?? (event as TouchEvent).touches?.[0]?.clientX;
      const clientY = (event as MouseEvent).clientY ?? (event as TouchEvent).touches?.[0]?.clientY;
      if (clientX === undefined || clientY === undefined) return;

      const position = screenToFlowPosition({ x: clientX, y: clientY });

      const newNodeId = uuidv4();
      const newCustomNode: CustomNode = {
        id: newNodeId,
        label: "Nueva página",
        parentNodeId: sourceNodeId,
        position,
      };

      // Add to React Flow state
      const newFlowNode: Node<PageNodeData> = {
        id: newNodeId,
        type: "pageNode",
        position,
        data: {
          nodeId: newNodeId,
          label: "Nueva página",
          url: "",
          fullPath: "",
          depth: 1,
          isVirtual: false,
          isCustom: true,
          onNameChange: stableNameChange, onDelete: stableDelete,
        },
      };
      const newEdge: Edge = {
        id: `edge-${sourceNodeId}-${newNodeId}`,
        source: sourceNodeId,
        target: newNodeId,
        type: "smoothstep",
        style: { stroke: "#94a3b8", strokeWidth: 2 },
      };

      setNodes((nds) => [...nds, newFlowNode]);
      setEdges((eds) => [...eds, newEdge]);

      // Persist to API
      fetch(`/api/projects/${projectId}/nodes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCustomNode),
      }).then(() => {
        setProject((prev) =>
          prev ? { ...prev, customNodes: [...(prev.customNodes ?? []), newCustomNode] } : prev
        );
      }).catch(() => {});

      // Select the new node and open drawer
      if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
      setSelectedNode({
        nodeKey: newNodeId,
        url: "",
        label: "Nueva página",
        fullPath: "",
        isCustom: true,
      });
      setDrawerVisible(true);
    },
    [projectId, screenToFlowPosition, setNodes, setEdges]
  );

  function handleAnnotationsChange(key: string, annotations: Annotation[]) {
    setProject((prev) => {
      if (!prev) return prev;
      return { ...prev, annotations: { ...prev.annotations, [key]: annotations } };
    });
  }

  function handleCustomImageChange(key: string, customImageUrl: string) {
    // Update node in flow
    setNodes((prev) =>
      prev.map((n) => {
        const nodeKey = n.data.isCustom ? n.id : n.data.url;
        if (nodeKey === key) {
          return { ...n, data: { ...n.data, customImageUrl } };
        }
        return n;
      })
    );
    // Update project state
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pageMeta: {
          ...prev.pageMeta,
          [key]: { ...(prev.pageMeta[key] ?? { title: "", description: "", screenshotPath: "" }), customImageUrl },
        },
      };
    });
    // Also update selectedNode so drawer image updates immediately
    setSelectedNode((prev) => prev ? { ...prev, customImageUrl } : prev);
  }

  function handleTagsChange(pageKey: string, tagIds: string[]) {
    setProject((prev) => {
      if (!prev) return prev;
      return { ...prev, pageTags: { ...prev.pageTags, [pageKey]: tagIds } };
    });
    // Update node visual
    const tags = (project?.tags ?? []).filter(t => tagIds.includes(t.id));
    setNodes((prev) =>
      prev.map((n) => {
        const nKey = n.data.isCustom ? n.id : n.data.url;
        if (nKey === pageKey) {
          return { ...n, data: { ...n.data, tags } };
        }
        return n;
      })
    );
  }

  function handleTagCreated(tag: Tag) {
    setProject((prev) => {
      if (!prev) return prev;
      return { ...prev, tags: [...(prev.tags ?? []), tag] };
    });
    // Update all nodes with the new available tags list
    const newAvailableTags = [...(project?.tags ?? []), tag];
    setNodes((prev) =>
      prev.map((n) => ({ ...n, data: { ...n.data, availableTags: newAvailableTags } }))
    );
  }

  function handleNameChange(pageKey: string, name: string) {
    // Update project state
    setProject((prev) => {
      if (!prev) return prev;
      const pageNames = { ...prev.pageNames };
      if (name) {
        pageNames[pageKey] = name;
      } else {
        delete pageNames[pageKey];
      }
      return { ...prev, pageNames };
    });
    // Update node visual
    setNodes((prev) =>
      prev.map((n) => {
        const nKey = n.data.isCustom ? n.id : n.data.url;
        if (nKey === pageKey) {
          return { ...n, data: { ...n.data, title: name || n.data.label } };
        }
        return n;
      })
    );
    // Update selected node label for drawer header
    setSelectedNode((prev) => prev && prev.nodeKey === pageKey ? { ...prev, label: name || prev.label } : prev);
  }

  function handleDeleteNode(nodeId: string) {
    // Find all descendant node IDs
    const descIds = getDescendantIds(nodeId);
    const allIdsToRemove = new Set([nodeId, ...descIds]);

    // Remove nodes
    setNodes((prev) => prev.filter((n) => !allIdsToRemove.has(n.id)));
    // Remove edges connected to any removed node
    setEdges((prev) => prev.filter((e) => !allIdsToRemove.has(e.source) && !allIdsToRemove.has(e.target)));

    // Close drawer if showing the deleted node
    if (selectedNode && allIdsToRemove.has(selectedNode.nodeKey)) {
      closeDrawer();
    }

    // Also remove the node we're looking at by its url key (for tree nodes the key is url)
    const nodeBeingDeleted = nodes.find((n) => n.id === nodeId);
    const pageKey = nodeBeingDeleted?.data.isCustom ? nodeId : (nodeBeingDeleted?.data.url || nodeId);

    // Persist to API
    fetch(`/api/projects/${projectId}/nodes`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: pageKey }),
    }).catch(() => {});

    // Update project state
    setProject((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        customNodes: prev.customNodes.filter((n) => !allIdsToRemove.has(n.id)),
      };
    });
  }

  function handleToggleTag(pageKey: string, tagId: string, selected: boolean) {
    const currentIds = project?.pageTags?.[pageKey] ?? [];
    const newIds = selected
      ? [...currentIds, tagId]
      : currentIds.filter((id) => id !== tagId);
    handleTagsChange(pageKey, newIds);

    // Persist to API
    fetch(`/api/projects/${projectId}/page-tags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pageKey, tagIds: newIds }),
    }).catch(() => {});

    // Update node data so context menu reflects the change
    setNodes((prev) =>
      prev.map((n) => {
        const nKey = n.data.isCustom ? n.id : n.data.url;
        if (nKey === pageKey) {
          return { ...n, data: { ...n.data, selectedTagIds: newIds } };
        }
        return n;
      })
    );
  }

  // Keep refs in sync
  nameChangeRef.current = handleNameChange;
  deleteRef.current = handleDeleteNode;
  toggleTagRef.current = handleToggleTag;

  async function handleRecapture(pageKey: string, url: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}/recapture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("Recapture failed");
      const data = await res.json();
      const meta = data.pageMeta;

      // Update project pageMeta
      setProject((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          pageMeta: { ...prev.pageMeta, [url]: meta },
          pageDrawings: (() => {
            const pd = { ...prev.pageDrawings };
            delete pd[url];
            return pd;
          })(),
        };
      });

      // Update node screenshot in canvas
      let seoScore: number | undefined;
      let a11yScore: number | undefined;
      if (meta.seo) {
        let score = 0;
        if (meta.seo.titleLength >= 30 && meta.seo.titleLength <= 60) score++;
        if (meta.seo.descriptionLength >= 120 && meta.seo.descriptionLength <= 160) score++;
        if (meta.seo.h1.length > 0) score++;
        if (meta.seo.h1.length === 1) score++;
        if (meta.seo.hasOgTitle) score++;
        if (meta.seo.hasOgDescription) score++;
        if (meta.seo.hasOgImage) score++;
        if (meta.seo.hasCanonical) score++;
        if (meta.seo.totalImages === 0 || meta.seo.imgWithoutAlt === 0) score++;
        if (meta.seo.wordCount > 300) score++;
        seoScore = score;
      }
      if (meta.a11y) {
        a11yScore = calculateA11yScore(meta.a11y);
      }

      // Cache-bust the screenshot URL
      const bustUrl = meta.screenshotPath ? `${meta.screenshotPath}?t=${Date.now()}` : undefined;

      setNodes((prev) =>
        prev.map((n) => {
          const nKey = n.data.isCustom ? n.id : n.data.url;
          if (nKey === pageKey) {
            return {
              ...n,
              data: {
                ...n.data,
                screenshotUrl: bustUrl,
                title: meta.title || n.data.label,
                seoScore,
                a11yScore,
              },
            };
          }
          return n;
        })
      );

      // Update selected node so drawer refreshes
      setSelectedNode((prev) =>
        prev && prev.nodeKey === pageKey
          ? { ...prev, screenshotUrl: bustUrl }
          : prev
      );
    } catch (err) {
      console.error("Recapture error:", err);
    }
  }

  async function handleDrawingSave(pageKey: string, drawingData: string | null) {
    try {
      await fetch(`/api/projects/${projectId}/drawing`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageKey, drawingData }),
      });
      setProject((prev) => {
        if (!prev) return prev;
        const pageDrawings = { ...prev.pageDrawings };
        if (drawingData) {
          pageDrawings[pageKey] = drawingData;
        } else {
          delete pageDrawings[pageKey];
        }
        return { ...prev, pageDrawings };
      });
    } catch {
      // silently fail
    }
  }

  function handleTagDeleted(tagId: string) {
    setProject((prev) => {
      if (!prev) return prev;
      const tags = (prev.tags ?? []).filter(t => t.id !== tagId);
      const pageTags = { ...prev.pageTags };
      for (const key of Object.keys(pageTags)) {
        pageTags[key] = (pageTags[key] ?? []).filter(id => id !== tagId);
      }
      return { ...prev, tags, pageTags };
    });
    // Remove tag from all nodes visually
    setNodes((prev) =>
      prev.map((n) => {
        if (n.data.tags) {
          return { ...n, data: { ...n.data, tags: n.data.tags.filter((t: any) => t.id !== tagId) } };
        }
        return n;
      })
    );
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#5a3bdd] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Cargando proyecto...</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Proyecto no encontrado</p>
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-[#E2F162] text-[#535c00] rounded-full hover:bg-[#d4e954] text-sm font-medium transition-all">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative bg-gray-50">
      {/* Top bar */}
      <div className="absolute z-10 flex items-center justify-between px-4 py-3" style={{ top: 20, left: 20, right: 20, background: "#fff", borderRadius: 60, boxShadow: "0 4px 24px rgba(26,28,30,0.06), 0 1px 4px rgba(26,28,30,0.04)" }}>
        {/* Left: Logo + close + project name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => router.push("/")}
            title="Volver a proyectos"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "var(--ec-surface-container-low)",
              border: "none", cursor: "pointer",
              color: "var(--ec-on-surface-variant)",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--ec-surface-container)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--ec-surface-container-low)"; }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="flex items-center gap-2 min-w-0 group">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
                  disabled={savingName} autoFocus
                  style={{ padding: "4px 12px", fontSize: 16, fontWeight: 600, color: "var(--ec-on-surface)", border: "none", borderRadius: 9999, background: "var(--ec-surface-container-low)", outline: "none", boxShadow: "0 0 0 2px rgba(90,59,221,0.25)" }}
                />
                {savingName && <div className="w-4 h-4 border-2 border-[#5a3bdd] border-t-transparent rounded-full animate-spin" />}
              </div>
            ) : (
              <>
                <span style={{ fontSize: 20, fontWeight: 600, color: "var(--ec-on-surface)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project?.name}</span>
                <button onClick={handleProjectNameClick}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ec-on-surface-variant)", flexShrink: 0 }}
                  title="Editar nombre"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                </button>
              </>
            )}
            <span style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              minWidth: 34, height: 34, borderRadius: 10, padding: "0 8px",
              background: "var(--ec-surface-container-low, #eff1f2)",
              fontSize: 12, fontWeight: 600, color: "var(--ec-on-surface-variant, #6b7072)",
              flexShrink: 0,
            }}>{nodes.length}</span>
          </div>
        </div>

        {/* Right: Search + Settings */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 rounded-xl px-3 py-1.5" style={{ background: "var(--ec-surface-container-low)" }}>
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--ec-on-surface-variant)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.35-4.35" /></svg>
            <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => handleSearchChange(e.target.value)}
              style={{ width: 110, padding: 0, fontSize: 12, border: "none", outline: "none", background: "transparent", color: "var(--ec-on-surface)", fontFamily: "inherit" }}
            />
            {searchTerm && (
              <button onClick={handleClearSearch} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ec-on-surface-variant)", padding: 0, display: "flex" }}>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
            {searchTerm && <span style={{ fontSize: 11, color: "var(--ec-on-surface-variant)", fontWeight: 600 }}>{countMatches()}/{nodes.length}</span>}
          </div>

          {/* Settings button */}
          <div style={{ position: "relative" }}>
            <button onClick={() => setSettingsOpen(!settingsOpen)}
              style={{ width: 36, height: 36, borderRadius: 12, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: settingsOpen ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: settingsOpen ? "#fff" : "var(--ec-on-surface-variant)", transition: "all 0.15s" }}
            >
              <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>

            {/* Settings dropdown */}
            {settingsOpen && (
              <>
                {/* Backdrop */}
                <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setSettingsOpen(false)} />
                {/* Panel */}
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50,
                  width: 260, background: "#fff", borderRadius: 16,
                  boxShadow: "0 12px 40px rgba(26,28,30,0.14), 0 2px 8px rgba(26,28,30,0.06)",
                  border: "1px solid var(--ec-surface-container-high)",
                  padding: "8px 0", overflow: "hidden",
                }}>
                  {/* Layout */}
                  <div style={{ padding: "10px 16px 6px" }}>
                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ec-on-surface-variant)", marginBottom: 8 }}>Disposición</p>
                    <div className="flex gap-2">
                      <button onClick={() => { onLayout("TB"); }}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s", background: direction === "TB" ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: direction === "TB" ? "#fff" : "var(--ec-on-surface-variant)" }}
                      >Vertical</button>
                      <button onClick={() => { onLayout("LR"); }}
                        style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, transition: "all 0.15s", background: direction === "LR" ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: direction === "LR" ? "#fff" : "var(--ec-on-surface-variant)" }}
                      >Horizontal</button>
                    </div>
                  </div>

                  {/* Actions list */}
                  <div style={{ padding: "4px 8px" }}>
                    <button onClick={() => { fitView({ padding: 0.2 }); setSettingsOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", fontSize: 13, color: "var(--ec-on-surface)", textAlign: "left", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ec-surface-container-low)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ec-on-surface-variant)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                      Centrar vista
                    </button>

                    <button onClick={() => { onLayout(direction); setSettingsOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", fontSize: 13, color: "var(--ec-on-surface)", textAlign: "left", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ec-surface-container-low)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ec-on-surface-variant)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                      Resetear posiciones
                    </button>

                    <button onClick={() => { handleRecaptureAll(); setSettingsOpen(false); }}
                      disabled={screenshotStatus?.status === "processing"}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", fontSize: 13, color: "var(--ec-on-surface)", textAlign: "left", transition: "background 0.1s", opacity: screenshotStatus?.status === "processing" ? 0.5 : 1 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ec-surface-container-low)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ec-on-surface-variant)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" /></svg>
                      {screenshotStatus?.status === "processing" ? `Capturando... ${screenshotStatus.completed}/${screenshotStatus.total}` : "Recapturar todo"}
                    </button>

                    <button onClick={() => { handleExport(); setSettingsOpen(false); }}
                      style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, border: "none", cursor: "pointer", background: "transparent", fontSize: 13, color: "var(--ec-on-surface)", textAlign: "left", transition: "background 0.1s" }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--ec-surface-container-low)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: "var(--ec-on-surface-variant)" }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Exportar como PNG
                    </button>
                  </div>

                  {/* Tag filter */}
                  {(project?.tags ?? []).length > 0 && (
                    <>
                      <div style={{ height: 1, background: "var(--ec-surface-container-high)", margin: "8px 0" }} />
                      <div style={{ padding: "6px 16px 10px" }}>
                        <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--ec-on-surface-variant)", marginBottom: 8 }}>Filtrar por etiqueta</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          <button onClick={() => {
                              setFilterTagId(null);
                              setNodes((prev) => prev.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
                            }}
                            style={{ padding: "5px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", background: !filterTagId ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: !filterTagId ? "#fff" : "var(--ec-on-surface-variant)", transition: "all 0.15s" }}
                          >Todas</button>
                          {(project?.tags ?? []).map((tag) => (
                            <button key={tag.id} onClick={() => {
                                const val = filterTagId === tag.id ? null : tag.id;
                                setFilterTagId(val);
                                setNodes((prev) =>
                                  prev.map((n) => {
                                    const nKey = n.data.isCustom ? n.id : n.data.url;
                                    const nTagIds = project?.pageTags?.[nKey] ?? [];
                                    const matches = !val || nTagIds.includes(val);
                                    return { ...n, style: { ...n.style, opacity: matches ? 1 : 0.3 } };
                                  })
                                );
                              }}
                              style={{ padding: "5px 10px", borderRadius: 9999, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, background: filterTagId === tag.id ? "var(--ec-secondary)" : "var(--ec-surface-container-low)", color: filterTagId === tag.id ? "#fff" : "var(--ec-on-surface-variant)", transition: "all 0.15s" }}
                            >
                              <span style={{ width: 8, height: 8, borderRadius: 4, background: tag.color, flexShrink: 0 }} />
                              {tag.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={onNodeClick}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        fitView
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ type: edgeStyle }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls
          position="bottom-right"
          orientation="vertical"
          showInteractive={false}
        >
          <button
            type="button"
            className="react-flow__controls-button"
            onClick={() => {
              setEdgeStyle("bezier");
              onLayout(direction, "bezier");
            }}
            style={
              edgeStyle === "bezier"
                ? { background: "var(--ec-secondary)", color: "#fff" }
                : undefined
            }
            title="Líneas curvas (Bezier)"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="vs-controls-icon">
              <path d="M4 20c0-8 4-16 16-16" />
            </svg>
          </button>
          <button
            type="button"
            className="react-flow__controls-button"
            onClick={() => {
              setEdgeStyle("cleanStep");
              onLayout(direction, "cleanStep");
            }}
            style={
              edgeStyle === "cleanStep"
                ? { background: "var(--ec-secondary)", color: "#fff" }
                : undefined
            }
            title="Líneas rectas (escalón)"
          >
            <svg viewBox="0 0 24 24" aria-hidden className="vs-controls-icon">
              <path d="M4 4v12h16" />
            </svg>
          </button>
        </Controls>
        <MiniMap nodeColor={() => "#93c5fd"} pannable zoomable position="top-right" style={{ marginTop: 100, marginRight: 20, borderRadius: 16, overflow: "hidden" }} />
      </ReactFlow>

      {screenshotStatus && (
        <ProgressOverlay
          completed={screenshotStatus.completed}
          total={screenshotStatus.total}
          status={screenshotStatus.status}
        />
      )}

      {/* Node drawer - always mounted when selectedNode exists, animated with visible prop */}
      {selectedNode && (
        <NodeDrawer
          projectId={projectId}
          nodeKey={selectedNode.nodeKey}
          url={selectedNode.url}
          label={selectedNode.label}
          fullPath={selectedNode.fullPath}
          screenshotUrl={selectedNode.screenshotUrl}
          customImageUrl={selectedNode.customImageUrl}
          pageMeta={project?.pageMeta?.[selectedNode.nodeKey]}
          annotations={project?.annotations?.[selectedNode.nodeKey] ?? []}
          visible={drawerVisible}
          onClose={closeDrawer}
          onAnnotationsChange={handleAnnotationsChange}
          onCustomImageChange={handleCustomImageChange}
          availableTags={project?.tags ?? []}
          selectedTagIds={project?.pageTags?.[selectedNode.nodeKey] ?? []}
          onTagsChange={handleTagsChange}
          onTagCreated={handleTagCreated}
          onTagDeleted={handleTagDeleted}
          customName={project?.pageNames?.[selectedNode.nodeKey]}
          onNameChange={handleNameChange}
          savedDrawing={project?.pageDrawings?.[selectedNode.nodeKey]}
          onDrawingSave={handleDrawingSave}
          onRecapture={handleRecapture}
        />
      )}
    </div>
  );
}

export default function SitemapCanvas({ projectId }: SitemapCanvasProps) {
  return (
    <ReactFlowProvider>
      <SitemapCanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
}
