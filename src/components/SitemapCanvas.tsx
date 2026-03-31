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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";

import PageNodeComponent from "./PageNode";
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
  const drawerCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thumbnailSentRef = useRef(false);
  const pageMetaSentRef = useRef(false);
  const router = useRouter();

  // Expose projectId globally for PageNode inline editing
  useEffect(() => {
    window.__VS_PROJECT_ID__ = projectId;
  }, [projectId]);

  // Ref for name change callback (used by PageNode via node data)
  const nameChangeRef = useRef<(pageKey: string, name: string) => void>(() => {});
  const stableNameChange = useCallback((pageKey: string, name: string) => nameChangeRef.current(pageKey, name), []);

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
                onNameChange: stableNameChange,
              },
            };
          }
          const customName = proj.pageNames?.[n.data.url];
          return { ...n, data: { ...n.data, tags, title: customName || n.data.label, onNameChange: stableNameChange } };
        });

        // Enrich custom nodes with pageMeta
        const enrichedCustomNodes = customNodes.map((n) => {
          const meta = proj.pageMeta?.[n.id];
          if (meta) {
            return { ...n, data: { ...n.data, customImageUrl: meta.customImageUrl || undefined, onNameChange: stableNameChange } };
          }
          return { ...n, data: { ...n.data, onNameChange: stableNameChange } };
        });

        const { nodes: layouted, edges: layoutedEdges } = getLayoutedElements(
          enrichedTreeNodes, treeEdges, "TB"
        );

        setNodes([...layouted, ...enrichedCustomNodes]);
        setEdges([...layoutedEdges, ...customEdges]);
        setLoading(false);
        setTimeout(() => fitView({ padding: 0.2 }), 100);

        if (proj.screenshotJobId) {
          startPolling(proj.screenshotJobId, proj.id);
        }
      } catch {
        setNotFound(true);
        setLoading(false);
      }
    }
    load();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (drawerCloseTimerRef.current) clearTimeout(drawerCloseTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function startPolling(jobId: string, projId: string) {
    // Always clear any existing interval before starting a new one
    if (pollingRef.current) clearInterval(pollingRef.current);

    let consecutiveErrors = 0;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/screenshots/${jobId}`);
        if (!res.ok) {
          // 404 = job lost (server restart). Stop polling to avoid infinite loop.
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            clearInterval(pollingRef.current!);
            setScreenshotStatus(null);
          }
          return;
        }
        consecutiveErrors = 0;
        const job: ScreenshotJob = await res.json();
        setScreenshotStatus(job);

        setNodes((prev) =>
          prev.map((node) => {
            const result = job.results.find((r) => r.url === node.data.url);
            if (result) {
              return {
                ...node,
                data: {
                  ...node.data,
                  screenshotUrl: result.screenshotPath || undefined,
                  title: result.title || node.data.label,
                  hasError: !!result.error,
                },
              };
            }
            return node;
          })
        );

        // Save thumbnail from first result
        if (!thumbnailSentRef.current && job.results.length > 0) {
          const first = job.results.find((r) => r.screenshotPath && !r.error);
          if (first) {
            thumbnailSentRef.current = true;
            fetch(`/api/projects/${projId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ thumbnailUrl: first.screenshotPath }),
            }).catch(() => {});
          }
        }

        // Save all page meta when job completes
        if (job.status === "complete" && !pageMetaSentRef.current) {
          pageMetaSentRef.current = true;
          const pageMeta: Record<string, PageMeta> = {};
          job.results.forEach((r) => {
            if (r.screenshotPath && !r.error) {
              pageMeta[r.url] = {
                title: r.title,
                description: r.description || "",
                screenshotPath: r.screenshotPath,
                seo: r.seo,
                a11y: r.a11y,
              };
            }
          });
          if (Object.keys(pageMeta).length > 0) {
            fetch(`/api/projects/${projId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ pageMeta }),
            }).then(() => {
              setProject((prev) =>
                prev ? { ...prev, pageMeta: { ...prev.pageMeta, ...pageMeta } } : prev
              );
            }).catch(() => {});
          }
        }

        if (job.status === "complete" || job.status === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      } catch {
        // Retry on next poll
      }
    }, 2000);
  }

  const onLayout = useCallback(
    (dir: "TB" | "LR") => {
      setDirection(dir);
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
      setEdges([...layoutedEdges, ...customEdges]);
      setTimeout(() => fitView({ padding: 0.2 }), 50);
    },
    [nodes, edges, setNodes, setEdges, fitView]
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
    // Stop any existing polling before launching a new job
    if (pollingRef.current) clearInterval(pollingRef.current);
    try {
      const res = await fetch(`/api/projects/${projectId}/recapture-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const { jobId } = data as { jobId: string };

      // Reset thumbnails and polling refs
      thumbnailSentRef.current = false;
      pageMetaSentRef.current = false;

      // Update project with new jobId
      setProject((prev) => prev ? { ...prev, screenshotJobId: jobId, pageDrawings: {} } : prev);

      // Start polling
      startPolling(jobId, projectId);
    } catch (err) {
      console.error("Recapture all error:", err);
    }
  }, [projectId, screenshotStatus]);

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
          onNameChange: stableNameChange,
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

  // Keep ref in sync
  nameChangeRef.current = handleNameChange;

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
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
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
          <button onClick={() => router.push("/")} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen relative bg-gray-50">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2 items-center">
        <button
          onClick={() => router.push("/")}
          className="px-3 py-2 text-sm rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Proyectos
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <button
          onClick={() => onLayout("TB")}
          className={`px-3 py-2 text-sm rounded-lg border transition-all ${direction === "TB" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          Vertical
        </button>
        <button
          onClick={() => onLayout("LR")}
          className={`px-3 py-2 text-sm rounded-lg border transition-all ${direction === "LR" ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
        >
          Horizontal
        </button>
        <button
          onClick={() => fitView({ padding: 0.2 })}
          className="px-3 py-2 text-sm rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-all"
        >
          Centrar
        </button>
        <div className="w-px h-6 bg-gray-200" />
        <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200">
          <input
            type="text"
            placeholder="Buscar página..."
            value={searchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="px-3 py-2 text-sm border-0 focus:outline-none bg-transparent"
          />
          {searchTerm && (
            <button
              onClick={handleClearSearch}
              className="px-2 py-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Limpiar búsqueda"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          {searchTerm && (
            <span className="px-2 py-2 text-xs text-gray-500 font-medium">
              {countMatches()}/{nodes.length}
            </span>
          )}
        </div>

        {/* Tag filter */}
        {(project?.tags ?? []).length > 0 && (
          <div className="relative">
            <select
              value={filterTagId || ""}
              onChange={(e) => {
                const val = e.target.value || null;
                setFilterTagId(val);
                // Apply filter
                setNodes((prev) =>
                  prev.map((n) => {
                    const nKey = n.data.isCustom ? n.id : n.data.url;
                    const nTagIds = project?.pageTags?.[nKey] ?? [];
                    const matches = !val || nTagIds.includes(val);
                    return {
                      ...n,
                      style: {
                        ...n.style,
                        opacity: matches ? 1 : 0.3,
                      },
                    };
                  })
                );
              }}
              className="px-3 py-2 text-sm rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 outline-none cursor-pointer"
            >
              <option value="">Todas las etiquetas</option>
              {(project?.tags ?? []).map((tag) => (
                <option key={tag.id} value={tag.id}>{tag.name}</option>
              ))}
            </select>
          </div>
        )}
        <button
          onClick={handleRecaptureAll}
          disabled={screenshotStatus?.status === "processing"}
          className={`px-3 py-2 text-sm rounded-lg border transition-all flex items-center gap-1.5 ${
            screenshotStatus?.status === "processing"
              ? "bg-amber-50 text-amber-600 border-amber-300 cursor-not-allowed"
              : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
          }`}
          title="Recapturar todas las páginas"
        >
          {screenshotStatus?.status === "processing" ? (
            <>
              <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              {screenshotStatus.completed}/{screenshotStatus.total}
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Recapturar todo
            </>
          )}
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-2 text-sm rounded-lg border bg-white text-gray-600 border-gray-200 hover:bg-gray-50 transition-all flex items-center gap-1.5"
          title="Exportar sitemap como PNG"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar
        </button>
      </div>

      {/* Project info */}
      <div className="absolute top-4 right-4 z-10 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 flex items-center gap-3 group">
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              disabled={savingName}
              autoFocus
              className="px-2 py-1 border border-blue-300 rounded bg-white text-gray-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {savingName && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
          </div>
        ) : (
          <>
            <span className="font-medium text-gray-800">{project?.name}</span>
            <button
              onClick={handleProjectNameClick}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-600"
              title="Editar nombre del proyecto"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          </>
        )}
        <span className="text-gray-400">·</span>
        <span>{nodes.length} páginas</span>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onConnectEnd={onConnectEnd}
        fitView
        minZoom={0.05}
        maxZoom={2}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls position="bottom-right" />
        <MiniMap nodeColor={() => "#93c5fd"} pannable zoomable position="top-right" style={{ marginTop: "3rem" }} />
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
