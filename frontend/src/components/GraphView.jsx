import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Globe, 
  Search, 
  Radio, 
  Crosshair, 
  Crown, 
  UploadCloud,
  PlayCircle,
  X,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight,
  User,
  Car,
  Phone,
  Building2,
  MapPin,
  Move,
  RotateCcw,
  Pin,
  ArrowLeft,
  History,
  Target,
  Users,
  Award,
  Flame,
  ChevronUp,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { getEntityColor, RELATION_LABELS } from '../utils/colors';
import { logAuditAction } from '../services/api';
import { inferCrimeFallback, getSeverityStyle } from '../utils/crimeInference';

// Helper to draw clean rounded rectangles on 2D canvas with cross-browser support
function drawRoundedPill(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
}

export default function GraphView({ 
  graphData, 
  selectedEntityId, 
  onSelectEntity, 
  isDrawerOpen = false,
  onOpenDrawer,
  onDeepInspect = null,
  crimeProfile = null,
  onRefresh,
  onOpenIngest,
  onLoadDemo,
  theme = 'midnight',
  highlightedCommunity = null,
  onClearCommunityHighlight = null,
  highlightedPath = null,
  onClearPathHighlight = null
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showPulses, setShowPulses] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [inspectedRelationship, setInspectedRelationship] = useState(null);
  const [showCommunityHalos, setShowCommunityHalos] = useState(true);
  const [filterByCrimeProfile, setFilterByCrimeProfile] = useState(false);

  // Custom dragged/pinned 3D node coordinates: { [nodeId]: { x, y, z } }
  const [customPositions, setCustomPositions] = useState({});

  // History tracking for visited suspects / criminals
  const [historyCriminals, setHistoryCriminals] = useState([]);
  const [isRightHudOpen, setIsRightHudOpen] = useState(true);
  const [rightHudTab, setRightHudTab] = useState('targets'); // 'targets' | 'selected' | 'history'

  // 3D Camera Controls
  const [rotX, setRotX] = useState(0.35); // pitch
  const [rotY, setRotY] = useState(0.85); // yaw
  const [cameraZ, setCameraZ] = useState(460); // distance
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [isDraggingNode, setIsDraggingNode] = useState(false);

  // Interaction Refs
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const animFrameRef = useRef(null);
  const isDraggingRef = useRef(false);
  const isDraggingNodeRef = useRef(false);
  const isDraggingCameraRef = useRef(false);
  const rotXRef = useRef(0.35);
  const rotYRef = useRef(0.85);
  const hasMovedRef = useRef(false);
  const lookLogTimerRef = useRef(null);
  const draggedNodeIdRef = useRef(null);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const dragStartPosRef = useRef({ x: 0, y: 0 });
  const pulsePhaseRef = useRef(0);

  const nodes = graphData?.nodes || [];
  const links = graphData?.links || [];

  // ---------------------------------------------------------
  // Compute 1-Hop Connected Neighborhood for the Selected Node
  // ---------------------------------------------------------
  const selectedNeighborhood = useMemo(() => {
    if (!selectedEntityId) {
      return { neighborIds: new Set(), neighborRelMap: new Map(), connectedLinks: [] };
    }

    const neighborIds = new Set();
    const neighborRelMap = new Map();
    const connectedLinks = [];

    links.forEach(l => {
      const sId = typeof l.source === 'object' && l.source !== null ? l.source.id : l.source;
      const tId = typeof l.target === 'object' && l.target !== null ? l.target.id : l.target;
      if (sId === selectedEntityId) {
        neighborIds.add(tId);
        if (!neighborRelMap.has(tId)) {
          neighborRelMap.set(tId, l.relation_type);
        }
        connectedLinks.push(l);
      } else if (tId === selectedEntityId) {
        neighborIds.add(sId);
        if (!neighborRelMap.has(sId)) {
          neighborRelMap.set(sId, l.relation_type);
        }
        connectedLinks.push(l);
      }
    });

    return { neighborIds, neighborRelMap, connectedLinks };
  }, [selectedEntityId, links]);

  // Selected node object
  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedEntityId) || null;
  }, [nodes, selectedEntityId]);

  // List of neighbor objects for the interactive HUD
  const neighborObjects = useMemo(() => {
    if (!selectedEntityId) return [];
    return Array.from(selectedNeighborhood.neighborIds).map(nid => {
      const nNode = nodes.find(n => n.id === nid);
      return {
        id: nid,
        name: nNode?.name || nid,
        type: nNode?.type || 'Entity',
        relType: selectedNeighborhood.neighborRelMap.get(nid) || 'CONNECTED',
      };
    });
  }, [selectedNeighborhood, nodes, selectedEntityId]);

  // ---------------------------------------------------------
  // Visited Criminals History & Main Syndicate Targets
  // ---------------------------------------------------------
  useEffect(() => {
    if (!selectedEntityId) return;
    const node = nodes.find(n => n.id === selectedEntityId);
    if (!node) return;

    // Auto switch right HUD to 'selected' tab when user inspects an entity
    setRightHudTab('selected');

    // If inspected entity is a Person (criminal suspect), append to history
    if (node.type === 'Person') {
      setHistoryCriminals(prev => {
        const filtered = prev.filter(p => p.id !== node.id);
        return [{
          id: node.id,
          name: node.name,
          role: node.attributes?.role || 'Suspect',
          betweenness: node.centrality?.betweenness || 0,
          degree: node.centrality?.degree || 0,
          timestamp: Date.now()
        }, ...filtered].slice(0, 30);
      });
    }
  }, [selectedEntityId, nodes]);

  // Previous Criminal from history (most recently visited person prior to current)
  const previousCriminal = useMemo(() => {
    return historyCriminals.find(h => h.id !== selectedEntityId) || null;
  }, [historyCriminals, selectedEntityId]);

  // Ranked Main Criminals (Key Syndicate Targets) by Betweenness & Degree Centrality
  const mainCriminals = useMemo(() => {
    return nodes
      .filter(n => n.type === 'Person')
      .map(p => {
        const bw = Number(p.centrality?.betweenness || 0);
        const deg = Number(p.centrality?.degree || 0);
        // Composite criminal prominence score
        const score = bw * 0.7 + (deg / Math.max(nodes.length, 1)) * 0.3;
        return {
          ...p,
          score,
          betweenness: bw,
          degree: deg,
          role: p.attributes?.role || 'Suspect'
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [nodes]);

  // ---------------------------------------------------------
  // Base 3D Spherical Coordinates (Fibonacci Sphere)
  // ---------------------------------------------------------
  const baseNodePositions3D = useMemo(() => {
    if (!nodes.length) return {};
    const pos = {};
    const count = nodes.length;
    const baseRadius = 240;

    const phi = Math.PI * (3 - Math.sqrt(5));
    nodes.forEach((node, i) => {
      const y = 1 - (i / Math.max(count - 1, 1)) * 2;
      const radiusAtY = Math.sqrt(1 - y * y);
      const theta = phi * i;

      const betweenness = node.centrality?.betweenness || 0;
      const r = baseRadius * (1 - betweenness * 0.4);

      pos[node.id] = {
        x: Math.cos(theta) * radiusAtY * r,
        y: y * r,
        z: Math.sin(theta) * radiusAtY * r,
      };
    });
    return pos;
  }, [nodes]);

  // ---------------------------------------------------------
  // Effective 3D Positions (Merges Base + User Dragged Positions)
  // ---------------------------------------------------------
  const nodePositions3D = useMemo(() => {
    const merged = { ...baseNodePositions3D };
    Object.keys(customPositions).forEach(id => {
      if (customPositions[id]) {
        merged[id] = customPositions[id];
      }
    });
    return merged;
  }, [baseNodePositions3D, customPositions]);

  // Reset single node back to spherical orbit
  const handleResetNodePosition = (nodeId) => {
    setCustomPositions(prev => {
      const copy = { ...prev };
      delete copy[nodeId];
      return copy;
    });
  };

  // Reset all custom dragged positions
  const handleResetAllPositions = () => {
    setCustomPositions({});
  };

  const movedNodeCount = Object.keys(customPositions).length;

  // ---------------------------------------------------------
  // Smooth Camera Centering on Selected Entity
  // ---------------------------------------------------------
  useEffect(() => {
    if (selectedEntityId && nodePositions3D[selectedEntityId] && !isDraggingRef.current) {
      const pos = nodePositions3D[selectedEntityId];
      const targetY = -Math.atan2(pos.x, pos.z);
      const targetX = Math.atan2(pos.y, Math.sqrt(pos.x * pos.x + pos.z * pos.z)) * 0.6;
      setRotY(targetY);
      setRotX(targetX);
      setCameraZ(380);
      setAutoRotate(false);
    }
  }, [selectedEntityId, nodePositions3D]);

  // ---------------------------------------------------------
  // Target Key Syndicate Kingpin (Highest Betweenness Broker)
  // ---------------------------------------------------------
  const handleLocateKingpin = () => {
    if (!nodes.length) return;
    const topPerson = mainCriminals[0];
    if (topPerson) {
      onSelectEntity(topPerson.id, false);
      setRightHudTab('selected');
      setIsRightHudOpen(true);
      return;
    }
    const topNode = [...nodes].sort((a, b) => (b.centrality?.betweenness || 0) - (a.centrality?.betweenness || 0))[0];
    if (topNode) {
      onSelectEntity(topNode.id, false);
      setRightHudTab('selected');
      setIsRightHudOpen(true);
    }
  };

  // ---------------------------------------------------------
  // 3D Camera Preset Angles
  // ---------------------------------------------------------
  const setCameraPreset = (preset) => {
    setAutoRotate(false);
    switch (preset) {
      case 'iso':
        rotXRef.current = 0.45;
        rotYRef.current = 0.78;
        setRotX(0.45);
        setRotY(0.78);
        setCameraZ(460);
        break;
      case 'top':
        rotXRef.current = 1.35;
        rotYRef.current = 0;
        setRotX(1.35);
        setRotY(0);
        setCameraZ(520);
        break;
      case 'side':
        rotXRef.current = 0.05;
        rotYRef.current = 1.57;
        setRotX(0.05);
        setRotY(1.57);
        setCameraZ(440);
        break;
      case 'core':
        rotXRef.current = 0.2;
        rotYRef.current = 0.4;
        setRotX(0.2);
        setRotY(0.4);
        setCameraZ(320);
        break;
      default:
        rotXRef.current = 0.35;
        rotYRef.current = 0.85;
        setRotX(0.35);
        setRotY(0.85);
        setCameraZ(460);
        setAutoRotate(true);
    }
  };

  // ---------------------------------------------------------
  // 3D Canvas Rendering Loop (60 FPS + Bold Labels + Dynamic Dragged Links)
  // ---------------------------------------------------------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = canvas.parentElement?.clientWidth || 800;
    let height = canvas.height = canvas.parentElement?.clientHeight || 550;

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    const isLight = theme === 'light';

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Increment Pulse Phase for live wiretap data packet animation
      pulsePhaseRef.current = (pulsePhaseRef.current + 0.018) % 1;

      // -------------------------------------------------------
      // 1. Draw 3D Perspective Ground Grid (Floor Plane)
      // -------------------------------------------------------
      ctx.save();
      const gridFloorY = 160;
      const gridSize = 320;
      const gridSteps = 8;
      const stepSize = gridSize / gridSteps;

      ctx.strokeStyle = isLight ? 'rgba(148, 163, 184, 0.25)' : 'rgba(6, 182, 212, 0.07)';
      ctx.lineWidth = 1;

      const curRotY = rotYRef.current;
      const curRotX = rotXRef.current;
      const cosY = Math.cos(curRotY);
      const sinY = Math.sin(curRotY);
      const cosX = Math.cos(curRotX);
      const sinX = Math.sin(curRotX);

      for (let i = -gridSteps; i <= gridSteps; i += 2) {
        const xVal = i * stepSize;
        const pA_x = xVal * cosY - (-gridSize) * sinY;
        const pA_z = -gridSize * cosY + xVal * sinY;
        const pA_y2 = gridFloorY * cosX - pA_z * sinX;
        const pA_z2 = pA_z * cosX + gridFloorY * sinX;
        const sA = cameraZ / (cameraZ + pA_z2);

        const pB_x = xVal * cosY - gridSize * sinY;
        const pB_z = gridSize * cosY + xVal * sinY;
        const pB_y2 = gridFloorY * cosX - pB_z * sinX;
        const pB_z2 = pB_z * cosX + gridFloorY * sinX;
        const sB = cameraZ / (cameraZ + pB_z2);

        if (pA_z2 > -cameraZ && pB_z2 > -cameraZ) {
          ctx.beginPath();
          ctx.moveTo(cx + pA_x * sA, cy + pA_y2 * sA);
          ctx.lineTo(cx + pB_x * sB, cy + pB_y2 * sB);
          ctx.stroke();
        }
      }
      ctx.restore();

      // -------------------------------------------------------
      // 2. Project 3D Nodes into Screen Coordinates
      // -------------------------------------------------------
      const projected = [];
      const hasSearch = searchQuery.trim().length > 0;

      nodes.forEach((node) => {
        const raw = nodePositions3D[node.id];
        if (!raw) return;

        const q = searchQuery.toLowerCase();
        const aliasMatch = Array.isArray(node.aliases)
          ? node.aliases.some(a => String(a).toLowerCase().includes(q))
          : (node.aliases && String(node.aliases).toLowerCase().includes(q));
        const isMatchSearch = hasSearch && (
          node.name.toLowerCase().includes(q) || 
          node.id.toLowerCase().includes(q) ||
          (node.attributes?.role && String(node.attributes.role).toLowerCase().includes(q)) ||
          (node.attributes?.model && String(node.attributes.model).toLowerCase().includes(q)) ||
          (node.attributes?.phone && String(node.attributes.phone).toLowerCase().includes(q)) ||
          (node.attributes?.plate && String(node.attributes.plate).toLowerCase().includes(q)) ||
          (node.attributes?.category && String(node.attributes.category).toLowerCase().includes(q)) ||
          (node.attributes?.jurisdiction && String(node.attributes.jurisdiction).toLowerCase().includes(q)) ||
          Boolean(aliasMatch)
        );

        const matchesType = activeFilter === 'ALL' || node.type === activeFilter;
        if (!matchesType) return;

        // 3D Matrix Transformations
        const x1 = raw.x * cosY - raw.z * sinY;
        const z1 = raw.z * cosY + raw.x * sinY;

        const y2 = raw.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + raw.y * sinX;

        const distance = cameraZ + z2;
        const scale = distance > 10 ? cameraZ / distance : 1;

        const screenX = cx + x1 * scale;
        const screenY = cy + y2 * scale;

        const betweenness = node.centrality?.betweenness || 0;
        const baseRadius = (16 + betweenness * 24) * scale;

        const isSelected = selectedEntityId === node.id;
        const isNeighbor = selectedNeighborhood.neighborIds.has(node.id);
        const isHovered = hoveredNodeId === node.id;
        const isPinned = Boolean(customPositions[node.id]);

        projected.push({
          node,
          x: screenX,
          y: screenY,
          z: z2,
          scale,
          radius: Math.max(baseRadius, 8),
          color: getEntityColor(node.type),
          isMatchSearch,
          isSelected,
          isNeighbor,
          isHovered,
          isPinned,
          relType: selectedNeighborhood.neighborRelMap.get(node.id) || null,
        });
      });

      // Sort by Z-depth (Back to Front) for realistic 3D occlusion
      projected.sort((a, b) => a.z - b.z);

      const projectedMap = {};
      projected.forEach((p) => { projectedMap[p.node.id] = p; });

      // -------------------------------------------------------
      // 3. Draw 3D Connection Beams & Moving Signal Pulses
      //    (Maintains dynamic connection even when node is moved!)
      // -------------------------------------------------------
      links.forEach((link) => {
        if (minConfidence > 0 && link.confidence !== undefined && link.confidence < minConfidence) {
          return;
        }
        const sId = typeof link.source === 'object' && link.source !== null ? link.source.id : link.source;
        const tId = typeof link.target === 'object' && link.target !== null ? link.target.id : link.target;
        const p1 = projectedMap[sId];
        const p2 = projectedMap[tId];
        if (!p1 || !p2) return;

        const isPathLink = highlightedPath && highlightedPath.length >= 2 && (
          highlightedPath.some((nodeId, idx) => {
            if (idx === highlightedPath.length - 1) return false;
            const nextNodeId = highlightedPath[idx + 1];
            return (sId === nodeId && tId === nextNodeId) || (sId === nextNodeId && tId === nodeId);
          })
        );

        const isDirectToSelected = selectedEntityId && (sId === selectedEntityId || tId === selectedEntityId);
        const avgZ = (p1.z + p2.z) / 2;
        let depthAlpha = Math.max(0.18, Math.min(0.95, (avgZ + 280) / 500));

        // Dim non-neighborhood links when an entity is selected
        if (selectedEntityId && !isDirectToSelected) {
          depthAlpha *= 0.12;
        } else if (hasSearch && !p1.isMatchSearch && !p2.isMatchSearch) {
          depthAlpha *= 0.2;
        }

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);

        if (isPathLink) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 4.5 * ((p1.scale + p2.scale) / 2);
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 20;
        } else if (isDirectToSelected) {
          ctx.strokeStyle = isLight ? '#0284c7' : '#38bdf8';
          ctx.lineWidth = 3.8 * ((p1.scale + p2.scale) / 2);
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = 16;
        } else {
          ctx.strokeStyle = isLight 
            ? `rgba(100, 116, 139, ${depthAlpha * 0.5})` 
            : `rgba(56, 189, 248, ${depthAlpha * 0.45})`;
          ctx.lineWidth = 1.4 * ((p1.scale + p2.scale) / 2);
        }
        ctx.stroke();

        // Moving Wiretap Pulse along the line
        if (showPulses && (isDirectToSelected || (!selectedEntityId && (!hasSearch || p1.isMatchSearch || p2.isMatchSearch)))) {
          const rawSourceStr = typeof sId === 'string' ? sId : String(sId || '1');
          const pulseSeed = parseInt(rawSourceStr.replace(/\D/g, '') || '1', 10);
          const pulseT = (pulsePhaseRef.current + (pulseSeed * 0.2)) % 1;
          const pulseX = p1.x + (p2.x - p1.x) * pulseT;
          const pulseY = p1.y + (p2.y - p1.y) * pulseT;
          const pulseScale = (p1.scale + p2.scale) / 2;

          ctx.beginPath();
          ctx.arc(pulseX, pulseY, (isDirectToSelected ? 3.5 : 2.5) * pulseScale, 0, 2 * Math.PI);
          ctx.fillStyle = isDirectToSelected ? '#ffffff' : (isLight ? '#0284c7' : '#38bdf8');
          ctx.shadowColor = '#38bdf8';
          ctx.shadowBlur = isDirectToSelected ? 14 : 8;
          ctx.fill();
        }

        // Midpoint 3D relationship tag
        if (isDirectToSelected || (p1.scale > 0.8 && p2.scale > 0.8 && !selectedEntityId)) {
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          
          ctx.font = isDirectToSelected ? 'bold 10px ui-monospace, monospace' : 'bold 8px ui-monospace, monospace';
          const text = link.relation_type;
          const textWidth = ctx.measureText(text).width;

          if (isDirectToSelected) {
            ctx.fillStyle = 'rgba(2, 6, 23, 0.9)';
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1;
            drawRoundedPill(ctx, midX - textWidth / 2 - 4, midY - 14, textWidth + 8, 14, 4);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#38bdf8';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, midX, midY - 7);
          }
        }
        ctx.restore();
      });

      // -------------------------------------------------------
      // 4. Draw 3D Spheres with Specular Reflection & Reticles
      // -------------------------------------------------------
      projected.forEach((p) => {
        const betweenness = p.node.centrality?.betweenness || 0;

        ctx.save();
        let depthAlpha = Math.max(0.35, Math.min(1.0, (p.z + 280) / 500));

        if (selectedEntityId && !p.isSelected && !p.isNeighbor) {
          depthAlpha *= 0.18;
        } else if (hasSearch && !p.isMatchSearch) {
          depthAlpha *= 0.2;
        }
        ctx.globalAlpha = depthAlpha;

        // Search Highlighting Beacon Ring
        if (p.isMatchSearch) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 14 * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2.5;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 15;
          ctx.stroke();
        }

        // Community Halo
        if (showCommunityHalos && p.node.community_id) {
          const isTargetCommunity = highlightedCommunity && p.node.community_id === highlightedCommunity;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + (isTargetCommunity ? 16 : 7) * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = isTargetCommunity ? '#818cf8' : 'rgba(129, 140, 248, 0.35)';
          ctx.lineWidth = isTargetCommunity ? 3 : 1.2;
          if (isTargetCommunity) {
            ctx.shadowColor = '#818cf8';
            ctx.shadowBlur = 18;
          }
          ctx.stroke();
        }

        // Connection Finder Path Highlight Beacon
        if (highlightedPath && highlightedPath.includes(p.node.id)) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 12 * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#f59e0b';
          ctx.shadowBlur = 20;
          ctx.stroke();
        }

        // Highlight Ring for Attached Neighbor Nodes
        if (p.isNeighbor) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 7 * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = p.color.fill;
          ctx.lineWidth = 2.5;
          ctx.shadowColor = p.color.fill;
          ctx.shadowBlur = 18;
          ctx.stroke();
        }

        // Custom Pin Indicator Ring (Node has been moved by user)
        if (p.isPinned) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 5 * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = '#a855f7'; // Purple pin aura
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 2]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Pulsing Threat Rings for Kingpins / High-Risk Brokers
        if (betweenness > 0.4) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 9 * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
          ctx.lineWidth = 1.8;
          ctx.stroke();
        }

        // 3D Targeting Reticle for Selected Entity
        if (p.isSelected) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius + 9 * p.scale, 0, 2 * Math.PI);
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#06b6d4';
          ctx.shadowBlur = 20;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // 3D Specular Radial Gradient for Node Sphere
        const grad = ctx.createRadialGradient(
          p.x - p.radius * 0.35,
          p.y - p.radius * 0.35,
          p.radius * 0.1,
          p.x,
          p.y,
          p.radius
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, p.color.fill);
        grad.addColorStop(1, isLight ? '#334155' : '#070b14');

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
        ctx.fillStyle = grad;
        ctx.shadowColor = p.color.fill;
        ctx.shadowBlur = p.isHovered || p.isSelected || p.isNeighbor || p.isMatchSearch ? 24 : 10;
        ctx.fill();

        ctx.strokeStyle = p.isSelected ? '#ffffff' : (p.isNeighbor ? '#ffffff' : p.color.fill);
        ctx.lineWidth = p.isSelected || p.isNeighbor ? 2.5 : 1;
        ctx.stroke();

        // Node Type Initial
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(10 * p.scale, 8)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const letter = p.node.type === 'Person' ? 'P' : p.node.type === 'Vehicle' ? 'V' : p.node.type === 'Location' ? 'L' : p.node.type === 'PhoneNumber' ? 'Ph' : 'O';
        ctx.fillText(letter, p.x, p.y);

        // -----------------------------------------------------
        // 5. BOLD LABELS & ATTACHED NEIGHBOR HIGHLIGHTING
        // -----------------------------------------------------
        const isBoldCandidate = p.isSelected || p.isNeighbor || p.isHovered || p.isMatchSearch || p.scale > 0.65;

        if (isBoldCandidate) {
          ctx.save();

          let fontSize = 11;
          let fontWeight = 'bold';
          let textColor = '#cbd5e1';
          let borderColor = 'rgba(51, 65, 85, 0.6)';
          let bgColor = 'rgba(3, 7, 18, 0.85)';
          let yOffset = p.radius + 6;

          // SELECTED NODE: EXTRA LARGE & EXTRA BOLD (900 weight)
          if (p.isSelected) {
            fontSize = Math.max(14 * p.scale, 13);
            fontWeight = '900';
            textColor = '#ffffff';
            borderColor = '#06b6d4';
            bgColor = 'rgba(2, 6, 23, 0.95)';
          }
          // ATTACHED NEIGHBOR NODES: EXTRA BOLD (800 weight) AND MORE PROMINENT
          else if (p.isNeighbor) {
            fontSize = Math.max(12.5 * p.scale, 11);
            fontWeight = '800';
            textColor = '#ffffff';
            borderColor = p.color.fill;
            bgColor = 'rgba(3, 7, 18, 0.92)';
          }
          // HOVERED OR SEARCH MATCH
          else if (p.isHovered || p.isMatchSearch) {
            fontSize = Math.max(12 * p.scale, 11);
            fontWeight = '800';
            textColor = p.isMatchSearch ? '#f59e0b' : '#38bdf8';
            borderColor = p.isMatchSearch ? '#f59e0b' : '#38bdf8';
            bgColor = 'rgba(3, 7, 18, 0.92)';
          }
          // NORMAL UNSELECTED NODES (BOLD DEFAULT)
          else {
            fontSize = Math.max(10 * p.scale, 9);
            fontWeight = '700';
            textColor = isLight ? '#1e293b' : '#94a3b8';
            borderColor = 'rgba(51, 65, 85, 0.4)';
            bgColor = isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(15, 23, 42, 0.75)';
          }

          ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
          const text = p.node.name;
          const textMetrics = ctx.measureText(text);
          const textW = textMetrics.width;
          const pillH = fontSize + 8;
          const pillW = textW + 14;
          const pillX = p.x - pillW / 2;
          const pillY = p.y + yOffset;

          ctx.fillStyle = bgColor;
          ctx.strokeStyle = borderColor;
          ctx.lineWidth = p.isSelected || p.isNeighbor ? 2 : 1;
          if (p.isSelected || p.isNeighbor) {
            ctx.shadowColor = borderColor;
            ctx.shadowBlur = p.isSelected ? 14 : 8;
          }
          drawRoundedPill(ctx, pillX, pillY, pillW, pillH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.shadowBlur = 0;
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(text, p.x, pillY + pillH / 2);

          // Subtitle or Connection Chip
          if (p.isSelected) {
            const subText = `${p.node.type.toUpperCase()}${p.node.attributes?.role ? ` • ${p.node.attributes.role}` : ''}${p.isPinned ? ' [PINNED]' : ''}`;
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.fillStyle = '#38bdf8';
            ctx.fillText(subText, p.x, pillY + pillH + 8);
          } else if (p.isNeighbor && p.relType) {
            ctx.font = 'bold 9px ui-monospace, monospace';
            ctx.fillStyle = p.color.fill;
            ctx.fillText(`↳ ${p.relType}`, p.x, pillY + pillH + 7);
          }

          ctx.restore();
        }

        ctx.restore();
      });

      // Auto-Orbit camera in animation ref without triggering React state updates or infinite loops
      if (autoRotate && !isDraggingRef.current) {
        rotYRef.current += 0.0035;
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [cameraZ, nodePositions3D, nodes, links, selectedEntityId, selectedNeighborhood, hoveredNodeId, customPositions, autoRotate, showPulses, searchQuery, activeFilter, theme]);

  // ---------------------------------------------------------
  // Screen Coordinate Hit-Testing Helper
  // ---------------------------------------------------------
  const findNodeAtScreen = useCallback((mx, my) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const curRotY = rotYRef.current;
    const curRotX = rotXRef.current;
    const cosY = Math.cos(curRotY);
    const sinY = Math.sin(curRotY);
    const cosX = Math.cos(curRotX);
    const sinX = Math.sin(curRotX);

    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const raw = nodePositions3D[node.id];
      if (!raw) continue;

      const x1 = raw.x * cosY - raw.z * sinY;
      const z1 = raw.z * cosY + raw.x * sinY;
      const y2 = raw.y * cosX - z1 * sinX;
      const z2 = z1 * cosX + raw.y * sinX;

      const distance = cameraZ + z2;
      const scale = distance > 10 ? cameraZ / distance : 1;
      const sx = cx + x1 * scale;
      const sy = cy + y2 * scale;

      const betweenness = node.centrality?.betweenness || 0;
      const radius = Math.max((16 + betweenness * 24) * scale, 14);

      const dist = Math.hypot(mx - sx, my - sy);
      if (dist <= radius) {
        return node;
      }
    }
    return null;
  }, [nodes, nodePositions3D, rotY, rotX, cameraZ]);

  // ---------------------------------------------------------
  // Mouse & Touch Interactivity: Node Dragging & Camera Orbit
  // ---------------------------------------------------------
  const handleMouseDown = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;

    const hit = findNodeAtScreen(mx, my);
    if (hit) {
      // User clicked on a node -> Drag the node!
      draggedNodeIdRef.current = hit.id;
      isDraggingNodeRef.current = true;
      isDraggingCameraRef.current = false;
      setIsDraggingNode(true);
      setAutoRotate(false);
    } else {
      // User clicked on empty space -> Orbit camera!
      draggedNodeIdRef.current = null;
      isDraggingNodeRef.current = false;
      isDraggingCameraRef.current = true;
      setIsDraggingNode(false);
    }
    isDraggingRef.current = true;
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dist = Math.hypot(e.clientX - dragStartPosRef.current.x, e.clientY - dragStartPosRef.current.y);
      if (dist > 5) {
        hasMovedRef.current = true;
      }

      const deltaX = e.clientX - lastMousePosRef.current.x;
      const deltaY = e.clientY - lastMousePosRef.current.y;
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };

      if (isDraggingNodeRef.current && draggedNodeIdRef.current) {
        // Move the node in 3D world space parallel to camera view plane!
        const nodeId = draggedNodeIdRef.current;
        setCustomPositions(prev => {
          const currentPos = prev[nodeId] || baseNodePositions3D[nodeId] || { x: 0, y: 0, z: 0 };
          
          const cosY = Math.cos(rotY);
          const sinY = Math.sin(rotY);
          const cosX = Math.cos(rotX);
          const sinX = Math.sin(rotX);

          // Estimate scale of the dragged node
          const z1 = currentPos.z * cosY + currentPos.x * sinY;
          const z2 = z1 * cosX + currentPos.y * sinX;
          const distance = cameraZ + z2;
          const scale = distance > 10 ? cameraZ / distance : 1;
          const factor = 1 / Math.max(scale, 0.15);

          const dx2 = deltaX * factor;
          const dy2 = deltaY * factor;

          // Inverse 3D projection to world delta
          const dWorldX = dx2 * cosY - dy2 * sinX * sinY;
          const dWorldY = dy2 * cosX;
          const dWorldZ = -dx2 * sinY - dy2 * sinX * cosY;

          return {
            ...prev,
            [nodeId]: {
              x: currentPos.x + dWorldX,
              y: currentPos.y + dWorldY,
              z: currentPos.z + dWorldZ,
            }
          };
        });
      } else if (isDraggingCameraRef.current) {
        // Orbit camera directly in refs for silky smooth 60fps interaction
        rotYRef.current += deltaX * 0.008;
        rotXRef.current = Math.max(-1.4, Math.min(1.4, rotXRef.current + deltaY * 0.008));
        setAutoRotate(false);

        // Debounce audit logging of camera look
        if (lookLogTimerRef.current) clearTimeout(lookLogTimerRef.current);
        lookLogTimerRef.current = setTimeout(() => {
          logAuditAction('look3d graph', `Rotated 3D camera to yaw=${rotYRef.current.toFixed(2)}, pitch=${rotXRef.current.toFixed(2)}`);
        }, 1200);
      }
    } else {
      const hit = findNodeAtScreen(mx, my);
      setHoveredNodeId(hit ? hit.id : null);
    }
  };

  const handleMouseUp = (e) => {
    if (isDraggingRef.current) {
      if (hasMovedRef.current && draggedNodeIdRef.current) {
        // Node was moved/dragged:
        // REQUIREMENT: "when i move that that info after drag off not show"
        // Intentionally DO NOT call onSelectEntity or pop open info drawer!
        const movedNode = nodes.find(n => n.id === draggedNodeIdRef.current);
        const nodeName = movedNode?.name || draggedNodeIdRef.current;
        logAuditAction('drag node', `Repositioned node "${nodeName}" in 3D network space`);
      }
    }

    isDraggingRef.current = false;
    isDraggingNodeRef.current = false;
    isDraggingCameraRef.current = false;
    draggedNodeIdRef.current = null;
    hasMovedRef.current = false;
    setIsDraggingNode(false);
  };

  // Double-click to show node info dossier:
  // REQUIREMENT: "doubble click throw node info show"
  const handleDoubleClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = findNodeAtScreen(mx, my);
    if (hit) {
      onSelectEntity(hit.id);
      logAuditAction('double_click node info', `Inspected full dossier for "${hit.name}" (${hit.type})`);
    }
  };

  // Global window mouseup listener to catch releases outside canvas or viewport
  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      if (isDraggingRef.current) {
        handleMouseUp(e);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [nodes]);

  // Native non-passive wheel listener on canvas & container to prevent page zoom/scroll
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas) return;

    const handleNativeWheel = (e) => {
      // Unconditionally stop browser page zoom (Ctrl+wheel / pinch) and page scroll
      e.preventDefault();
      e.stopPropagation();

      // Normalize delta across mice and trackpads
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 30; // DOM_DELTA_LINE
      else if (e.deltaMode === 2) delta *= 100; // DOM_DELTA_PAGE

      // Trackpad pinch-to-zoom sets e.ctrlKey = true
      const speed = e.ctrlKey ? 0.75 : 0.45;

      setCameraZ((prev) => {
        const next = prev + delta * speed;
        return Math.max(160, Math.min(850, next));
      });
    };

    const handlePreventGesture = (e) => {
      e.preventDefault();
    };

    // Use passive: false so preventDefault() stops browser page zoom/scroll
    canvas.addEventListener('wheel', handleNativeWheel, { passive: false });
    canvas.addEventListener('gesturestart', handlePreventGesture, { passive: false });
    canvas.addEventListener('gesturechange', handlePreventGesture, { passive: false });

    if (container) {
      container.addEventListener('wheel', handleNativeWheel, { passive: false });
    }

    return () => {
      canvas.removeEventListener('wheel', handleNativeWheel);
      canvas.removeEventListener('gesturestart', handlePreventGesture);
      canvas.removeEventListener('gesturechange', handlePreventGesture);
      if (container) {
        container.removeEventListener('wheel', handleNativeWheel);
      }
    };
  }, []);

  // Touch Support for Mobile / Tablets
  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      handleMouseDown({ clientX: t.clientX, clientY: t.clientY });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      handleMouseMove({ clientX: t.clientX, clientY: t.clientY });
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'Person': return <User className="w-3.5 h-3.5 text-cyan-400" />;
      case 'Vehicle': return <Car className="w-3.5 h-3.5 text-amber-400" />;
      case 'Location': return <MapPin className="w-3.5 h-3.5 text-emerald-400" />;
      case 'PhoneNumber': return <Phone className="w-3.5 h-3.5 text-purple-400" />;
      case 'Organization': return <Building2 className="w-3.5 h-3.5 text-teal-400" />;
      default: return <Globe className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="space-y-4">
      
      {/* 3D Viewport Controls & Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800 shadow-xl">
        
        {/* Left: 3D Tactical Orbit Indicator & Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Dedicated 3D Mode Badge */}
          <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-tr from-cyan-600/25 to-blue-600/25 text-cyan-200 border border-cyan-500/40 text-xs font-bold shadow-md shadow-cyan-500/10">
            <Globe className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
            <span>3D Tactical Orbit</span>
          </div>

          {/* Quick Insert Data Button directly inside 3D Canvas */}
          {onOpenIngest && (
            <button
              onClick={onOpenIngest}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white border border-cyan-300/50 text-xs font-black transition-all shadow-md shadow-cyan-500/20 hover:scale-105"
              title="Open Data Ingestion Center to insert or upload crime case data"
            >
              <UploadCloud className="w-3.5 h-3.5 text-white" />
              <span>+ Insert Data</span>
            </button>
          )}

          {/* 3D Camera Angles */}
          <div className="hidden sm:flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
            <button
              onClick={() => setCameraPreset('iso')}
              className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title="Isometric 3D View"
            >
              ISO
            </button>
            <button
              onClick={() => setCameraPreset('top')}
              className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title="Top-Down Satellite View"
            >
              TOP
            </button>
            <button
              onClick={() => setCameraPreset('core')}
              className="px-2 py-0.5 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title="Focus on Core High-Risk Nodes"
            >
              CORE
            </button>
            <button
              onClick={() => setCameraPreset('orbit')}
              className={`px-2 py-0.5 rounded transition ${autoRotate ? 'bg-cyan-500/20 text-cyan-300' : 'hover:bg-slate-800 text-slate-300'}`}
              title="Toggle Continuous 3D Orbiting"
            >
              Auto-Orbit
            </button>
          </div>

          

          {/* Quick Centrality Focus Button */}
          <button
            onClick={handleLocateKingpin}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition shadow-sm"
            title="Automatically home in on the highest betweenness broker entity"
          >
            <Crown className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Focus Central Entity</span>
          </button>

          {/* Previous Criminal Quick Navigation */}
          {previousCriminal && (
            <button
              onClick={() => {
                onSelectEntity(previousCriminal.id, false);
                setRightHudTab('selected');
              }}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-bold transition shadow-md hover:scale-105 animate-fadeIn"
              title={`Return to previous suspect: ${previousCriminal.name}`}
            >
              <ArrowLeft className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden lg:inline">Prev Suspect:</span>
              <span className="text-white font-mono truncate max-w-[100px]">{previousCriminal.name}</span>
            </button>
          )}

          {/* Main Criminals Target Registry Navigation Button */}
          {mainCriminals.length > 0 && (
            <button
              onClick={() => {
                document.getElementById('syndicate-targets-section')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-rose-300 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Jump to Syndicate Target Registry below the 3D graph"
            >
              <Target className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Criminal Targets</span>
              <span className="px-1.5 py-0.2 rounded-full bg-rose-500/20 text-[10px] font-mono font-bold text-rose-300">
                {mainCriminals.length}
              </span>
            </button>
          )}

          {/* Reset Dragged Nodes Button (Visible when nodes have been moved) */}
          {movedNodeCount > 0 && (
            <button
              onClick={handleResetAllPositions}
              className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-xs font-bold transition shadow-sm animate-fadeIn"
              title="Reset all dragged nodes back to default 3D orbit"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Positions ({movedNodeCount})</span>
            </button>
          )}
        </div>

        {/* Right: In-Canvas Search & Entity Filter */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          
          {/* Quick Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Highlight node in 3D..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 font-mono font-bold"
            />
          </div>

          {/* Entity Type Filter */}
          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className="text-xs bg-slate-950 border border-slate-800 text-slate-300 py-1 px-2.5 rounded-xl focus:outline-none focus:border-cyan-500/50 font-mono font-bold"
          >
            <option value="ALL">All Types</option>
            <option value="Person">Person</option>
            <option value="Vehicle">Vehicle</option>
            <option value="Location">Location</option>
            <option value="PhoneNumber">Phone</option>
            <option value="Organization">Organization</option>
            <option value="Event">Event</option>
          </select>

          {/* Crime Profile Priority Filter */}
          {crimeProfile && (
            <button
              onClick={() => setFilterByCrimeProfile(!filterByCrimeProfile)}
              className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-bold transition flex items-center space-x-1.5 ${
                filterByCrimeProfile
                  ? 'bg-rose-500/25 border-rose-500/50 text-rose-300 shadow-sm shadow-rose-950/40'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title={`Prioritize vectors for ${crimeProfile.name}`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden xl:inline">Profile Focus:</span>
              <span className="truncate max-w-[120px]">{crimeProfile.name}</span>
            </button>
          )}

          {/* Confidence Threshold Slider */}
          <div className="hidden lg:flex items-center space-x-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-xl text-[10px] font-mono">
            <span className="text-slate-400">Min Conf:</span>
            <input
              type="range"
              min="0"
              max="0.9"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="w-16 accent-cyan-400 cursor-pointer"
              title="Filter links below confidence threshold"
            />
            <span className="text-cyan-400 font-bold w-6 text-right">
              {minConfidence > 0 ? `${(minConfidence * 100).toFixed(0)}%` : 'All'}
            </span>
          </div>

          {/* Halos Toggle */}
          <button
            onClick={() => setShowCommunityHalos(!showCommunityHalos)}
            className={`px-2.5 py-1 rounded-xl border text-[11px] font-mono font-bold transition ${
              showCommunityHalos
                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
            title="Toggle Modularity Community Halos"
          >
            Halos
          </button>

          {/* Pulse Toggle */}
          <button
            onClick={() => setShowPulses(!showPulses)}
            className={`p-1.5 rounded-xl border transition ${
              showPulses 
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-sm shadow-cyan-500/20' 
                : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
            title={showPulses ? 'Disable Wiretap Pulses' : 'Enable Wiretap Pulses'}
          >
            <Radio className="w-4 h-4" />
          </button>
        </div>

      </div>

      {/* Active Highlighting Banners */}
      {(highlightedCommunity || highlightedPath) && (
        <div className="flex items-center justify-between px-4 py-2 bg-indigo-950/70 border border-indigo-500/40 rounded-2xl text-xs font-mono">
          <div className="flex items-center space-x-2 text-indigo-200">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span>
              {highlightedCommunity
                ? `Highlighting Cluster: ${highlightedCommunity}`
                : `Highlighting Shortest Path (${highlightedPath.length} nodes)`}
            </span>
          </div>
          <button
            onClick={() => {
              if (onClearCommunityHighlight) onClearCommunityHighlight();
              if (onClearPathHighlight) onClearPathHighlight();
            }}
            className="px-2 py-0.5 rounded bg-indigo-900/60 hover:bg-indigo-800 text-indigo-300 text-[10px] cursor-pointer"
          >
            Clear Highlight ✕
          </button>
        </div>
      )}

      {/* 3D Viewport Canvas Container */}
      <div ref={containerRef} style={{ overscrollBehavior: "contain", touchAction: "none" }} className="relative w-full h-[620px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#020617] via-[#050b1d] to-[#02040d] border border-slate-800/80 shadow-2xl">
        
        {/* Hologram Reticle Overlays */}
        <div className="absolute top-4 left-4 pointer-events-none flex flex-col space-y-1 font-mono text-[10px] text-cyan-500/80 z-10">
          <div className="flex items-center space-x-1">
            <Crosshair className="w-3.5 h-3.5 animate-spin-slow text-cyan-400" />
            <span>OPTICAL 3D SENSOR MATRIX</span>
          </div>
          <div className="text-slate-500">
            CAM_Z: {Math.round(cameraZ)} • ROT_Y: {rotY.toFixed(2)} • ROT_X: {rotX.toFixed(2)}
          </div>
          <div className="text-cyan-400/90 font-sans flex items-center space-x-1 mt-1">
            <Move className="w-3 h-3 text-cyan-400" />
            <span>Click & hold any node to drag • Relations stay attached</span>
          </div>
        </div>

        {/* 3D Orbit Canvas with Node Dragging Support */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleMouseUp}
          onDoubleClick={handleDoubleClick}
                    style={{ overscrollBehavior: "contain", touchAction: "none" }}
          className={`w-full h-full block select-none ${
            isDraggingNode ? 'cursor-grabbing' : (hoveredNodeId ? 'cursor-grab' : 'cursor-default')
          }`}
        />

                {/* Empty Diagram State Overlay */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto z-20 p-6 text-center bg-slate-950/75 backdrop-blur-sm animate-fadeIn">
            <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4 shadow-xl shadow-cyan-500/10">
              <Globe className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white font-mono">Graph Memory is Empty</h3>
            <p className="text-xs text-slate-400 max-w-md mt-1 mb-5">
              All entities, relations, and memory data have been removed. The 3D diagram is completely clear. Insert investigation data or load the sample syndicate to reconstruct the network.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {onOpenIngest && (
                <button
                  onClick={onOpenIngest}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs transition shadow-lg shadow-cyan-500/25 hover:scale-105"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>+ Insert Case Data</span>
                </button>
              )}
              {onLoadDemo && (
                <button
                  onClick={onLoadDemo}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/30 font-bold text-xs transition shadow hover:scale-105"
                >
                  <PlayCircle className="w-4 h-4 text-cyan-400" />
                  <span>Load Sample Demo</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Floating Node Badge when hovering in 3D */}
        {hoveredNodeId && !selectedNode && (
          <div className="absolute bottom-4 left-4 bg-slate-950/90 backdrop-blur-md border border-cyan-500/40 rounded-xl p-3 text-xs shadow-2xl pointer-events-none font-mono">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="font-bold text-white">
                {nodes.find(n => n.id === hoveredNodeId)?.name || hoveredNodeId}
              </span>
            </div>
            <div className="text-[11px] text-cyan-300 mt-1">
              Type: {nodes.find(n => n.id === hoveredNodeId)?.type} • Betweenness: {Number(nodes.find(n => n.id === hoveredNodeId)?.centrality?.betweenness || 0).toFixed(3)} • Click & drag to move
            </div>
          </div>
        )}

        {/* Bottom Legend */}
        <div className="absolute bottom-4 right-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 p-2.5 rounded-2xl flex items-center space-x-3 text-[10px] font-mono text-slate-400 shadow-xl">
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
            <span className="font-bold">Person</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
            <span className="font-bold">Vehicle</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
            <span className="font-bold">Phone</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span className="font-bold">Location</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400 shadow-sm shadow-teal-400/50" />
            <span className="font-bold">Org</span>
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* SYNDICATE TARGET REGISTRY & OPERATIONAL FOCUS (BELOW 3D VIEWPORT)          */}
      {/* ========================================================================= */}
      {nodes.length > 0 && (
        <div id="syndicate-targets-section" className="space-y-4 pt-2 animate-fadeIn">
          
          {/* Section Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 backdrop-blur-md p-4 rounded-3xl border border-slate-800 shadow-xl">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-500/20 to-amber-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-inner">
                <Target className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-black text-white tracking-wide font-sans">
                    Syndicate Target Registry & Operational Focus
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-[10px] font-mono font-bold text-rose-300">
                    {mainCriminals.length} Identified
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Algorithmic hierarchy based on NetworkX Betweenness Centrality & Bridge Brokerage. Click any suspect card to focus camera and center in 3D above.
                </p>
              </div>
            </div>

            {/* Quick Actions & View Filters */}
            <div className="flex items-center space-x-2">
              <button
                onClick={handleLocateKingpin}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
                title="Automatically center 3D camera on #1 Highest Centrality Entity"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Focus #1 Centrality</span>
              </button>

              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
                <button
                  onClick={() => setRightHudTab('targets')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                    rightHudTab === 'targets'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>All Targets ({mainCriminals.length})</span>
                </button>

                <button
                  onClick={() => setRightHudTab('selected')}
                  className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                    rightHudTab === 'selected'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>
                    {selectedNode ? `Active: ${selectedNode.name}` : 'Active Focus'}
                  </span>
                  {selectedNode && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping ml-0.5" />}
                </button>

                {historyCriminals.length > 0 && (
                  <button
                    onClick={() => setRightHudTab('history')}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-lg transition cursor-pointer ${
                      rightHudTab === 'history'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Trail ({historyCriminals.length})</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Target Registry Grid & Active Focus Section */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            
            {/* PRIMARY COLUMN: KEY SYNDICATE TARGETS (MAIN CRIMINALS) */}
            <div className={`space-y-3 ${rightHudTab === 'targets' ? 'lg:col-span-7' : rightHudTab === 'selected' ? 'lg:col-span-5' : 'lg:col-span-6'}`}>
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Flame className="w-4 h-4 text-rose-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                      Syndicate Target Registry
                    </h4>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    Ranked by Betweenness & Influence
                  </span>
                </div>

                {mainCriminals.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs italic">
                    No suspect entities classified as Person found in graph.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[540px] overflow-y-auto pr-1 scrollbar-thin">
                    {mainCriminals.map((criminal, index) => {
                      const isCurrent = selectedEntityId === criminal.id;
                      const isTopKingpin = index === 0;

                      return (
                        <div
                          key={criminal.id}
                          onClick={() => {
                            onSelectEntity(criminal.id, false);
                            setRightHudTab('selected');
                          }}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-2 hover:scale-[1.01] ${
                            isCurrent
                              ? 'bg-cyan-500/15 border-cyan-500/60 shadow-lg shadow-cyan-950/60 ring-1 ring-cyan-500/40'
                              : isTopKingpin
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/40 shadow-sm'
                              : 'bg-slate-950/80 hover:bg-slate-900/90 border-slate-800/90 hover:border-slate-700'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1.5">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center space-x-1.5 mb-1">
                                {isTopKingpin ? (
                                  <span className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-[10px] font-mono font-black text-amber-300">
                                    <Crown className="w-3 h-3 text-amber-400" />
                                    <span>#1 CENTRALITY</span>
                                  </span>
                                ) : index === 1 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-sky-500/20 border border-sky-500/40 text-[10px] font-mono font-black text-sky-300">
                                    #2 CENTRALITY
                                  </span>
                                ) : index === 2 ? (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-700/20 border border-amber-600/40 text-[10px] font-mono font-black text-amber-200">
                                    #3 CENTRALITY
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-mono font-bold text-slate-400">
                                    #{index + 1}
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                    <span>Active In 3D</span>
                                  </span>
                                )}
                              </div>
                              <h5 className="font-bold text-sm text-white truncate">
                                {criminal.name}
                              </h5>
                              <p className="text-xs text-slate-400 truncate mt-0.5">
                                {criminal.role}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-xs font-mono font-bold text-cyan-400 block">
                                {criminal.betweenness.toFixed(3)}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500">
                                {criminal.degree} links
                              </span>
                            </div>
                          </div>

                          {/* Centrality Threat Bar */}
                          <div className="space-y-1">
                            <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isTopKingpin
                                    ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-red-500'
                                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(12, criminal.betweenness * 100))}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                              <span>Betweenness Centrality</span>
                              <span className="text-cyan-400/90 hover:text-cyan-300 font-sans font-semibold">
                                Focus in 3D ↗
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* SECOND COLUMN: ACTIVE TARGET INVESTIGATION & 1-HOP RING */}
            <div className={`space-y-3 ${rightHudTab === 'targets' ? 'lg:col-span-5' : rightHudTab === 'selected' ? 'lg:col-span-7' : 'lg:col-span-6'}`}>
              <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                  <div className="flex items-center space-x-2">
                    <Crosshair className="w-4 h-4 text-cyan-400" />
                    <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                      Operational Focus & 1-Hop Ring
                    </h4>
                  </div>
                  {selectedNode && (
                    <button
                      onClick={() => onSelectEntity(null)}
                      className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded-lg hover:bg-slate-800 transition font-mono cursor-pointer"
                      title="Clear selection and restore un-dimmed view"
                    >
                      Clear Selection ✕
                    </button>
                  )}
                </div>

                {selectedNode ? (
                  <div className="space-y-4 font-sans">
                    
                    {/* Previous Suspect Quick Return Link */}
                    {previousCriminal && previousCriminal.id !== selectedNode.id && (
                      <button
                        onClick={() => onSelectEntity(previousCriminal.id, false)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-2xl bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-500/40 text-xs text-indigo-200 transition shadow-sm cursor-pointer"
                        title={`Return to previous suspect: ${previousCriminal.name}`}
                      >
                        <span className="flex items-center space-x-2 truncate">
                          <ArrowLeft className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="truncate">
                            ← Return to Previous Suspect: <strong className="text-white">{previousCriminal.name}</strong>
                          </span>
                        </span>
                        <span className="text-[10px] text-indigo-400 font-mono shrink-0 ml-2">Quick Return ↵</span>
                      </button>
                    )}

                    {/* Active Suspect Profile Card */}
                    <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-cyan-500/40 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                              {selectedNode.type}
                            </span>
                            {customPositions[selectedNode.id] && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                                3D Pinned
                              </span>
                            )}
                          </div>
                          <h4 className="text-lg font-black text-white mt-1">
                            {selectedNode.name}
                          </h4>
                          {selectedNode.attributes?.role && (
                            <p className="text-xs text-cyan-400 font-medium">
                              {selectedNode.attributes.role}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] font-mono text-slate-400">Betweenness</div>
                          <div className="text-base font-mono font-black text-cyan-300">
                            {Number(selectedNode.centrality?.betweenness || 0).toFixed(3)}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">
                            Degree: {Number(selectedNode.centrality?.degree || 0)}
                          </div>
                        </div>
                      </div>

                      {customPositions[selectedNode.id] && (
                        <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                          <span className="text-xs text-purple-300">Custom Position Active</span>
                          <button
                            onClick={() => handleResetNodePosition(selectedNode.id)}
                            className="text-xs text-purple-400 hover:text-purple-200 font-bold inline-flex items-center space-x-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset to Orbit</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Directly Attached 1-Hop Nodes */}
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                        <span>Directly Attached Nodes ({neighborObjects.length})</span>
                        <span className="text-[10px] text-cyan-400 font-mono font-normal">
                          Click to focus in 3D
                        </span>
                      </div>

                      {neighborObjects.length === 0 ? (
                        <p className="text-xs text-slate-500 italic p-3 bg-slate-950/60 rounded-xl">
                          No direct connections recorded for this node.
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin p-1">
                          {neighborObjects.map(nb => (
                            <button
                              key={nb.id}
                              onClick={() => onSelectEntity(nb.id, false)}
                              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-200 border border-slate-800 hover:border-cyan-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
                              title={`Click to focus on ${nb.name}`}
                            >
                              {getTypeIcon(nb.type)}
                              <span className="truncate max-w-[130px]">{nb.name}</span>
                              <span className="text-[9px] font-mono text-cyan-400 opacity-90">({nb.relType})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Relationship Evidence & Lineage */}
                    {selectedNeighborhood.connectedLinks.length > 0 && (
                      <div className="pt-2 border-t border-slate-800">
                        <div className="flex items-center justify-between text-xs font-bold text-slate-300 mb-2">
                          <span>Relationship Evidence Citations ({selectedNeighborhood.connectedLinks.length})</span>
                          <span className="text-[10px] text-cyan-400 font-mono">Traceability</span>
                        </div>
                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                          {selectedNeighborhood.connectedLinks.map((l, lIdx) => {
                            const sId = typeof l.source === 'object' ? l.source?.id : l.source;
                            const tId = typeof l.target === 'object' ? l.target?.id : l.target;
                            const otherId = sId === selectedEntityId ? tId : sId;
                            const otherNode = nodes.find(n => n.id === otherId);
                            const confScore = l.confidence !== undefined ? l.confidence : 0.5;

                            return (
                              <div
                                key={l.id || lIdx}
                                onClick={() => setInspectedRelationship(l)}
                                className="p-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-cyan-500/40 rounded-xl flex items-center justify-between cursor-pointer transition shadow-sm"
                                title="Click to view full relationship lineage and citation breakdown"
                              >
                                <div className="truncate mr-2">
                                  <span className="text-[11px] font-mono font-bold text-cyan-400">
                                    {l.relation_type}
                                  </span>
                                  <span className="text-xs text-slate-300 ml-1.5 truncate">
                                    → {otherNode?.name || otherId}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-cyan-300 font-semibold shrink-0">
                                  {(confScore * 100).toFixed(0)}% • Inspect Lineage 🔍
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Forensic Dossier & Deep Inspect Actions */}
                    <div className="pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-slate-400">Deep forensic intelligence & dossier</span>
                      
                      <div className="flex items-center space-x-2">
                        {onDeepInspect && (
                          <button
                            type="button"
                            onClick={() => onDeepInspect(selectedNode.id)}
                            className="font-black inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs transition shadow-md shadow-cyan-500/25 hover:scale-105 cursor-pointer"
                            title="Open full-screen Deep Entity Inspection Dossier"
                          >
                            <Crosshair className="w-4 h-4 text-slate-950" />
                            <span>DEEP INSPECT</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            if (onOpenDrawer) {
                              onOpenDrawer(selectedNode.id);
                            } else {
                              onSelectEntity(selectedNode.id, true);
                            }
                          }}
                          className={`font-bold inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl transition shadow-md cursor-pointer ${
                            isDrawerOpen
                              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          }`}
                        >
                          <span>{isDrawerOpen ? 'Drawer Open' : 'Open Drawer'}</span>
                          <ChevronRight className={`w-4 h-4 transition-transform ${isDrawerOpen ? 'rotate-90 text-cyan-400' : ''}`} />
                        </button>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-8 text-center space-y-3 bg-slate-950/50 rounded-2xl border border-dashed border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
                      <Crosshair className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <h5 className="text-sm font-bold text-slate-200">No Target Suspect Inspected</h5>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Select any suspect from the Syndicate Target Registry or click any node in the 3D canvas above to inspect their 1-hop ring, attached evidence citations, and confidence lineage.
                      </p>
                    </div>
                    {mainCriminals.length > 0 && (
                      <button
                        onClick={handleLocateKingpin}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5 text-amber-400" />
                        <span>Inspect #1 Centrality Entity ({mainCriminals[0]?.name})</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* SUSPECT INSPECTION TRAIL (HISTORY AUDIT) */}
          {historyCriminals.length > 0 && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3 font-sans">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-black text-white uppercase tracking-wider font-mono">
                    Suspect Inspection Trail ({historyCriminals.length})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-500">
                    Chronological audit of visited suspects
                  </span>
                </div>
                <button
                  onClick={() => setHistoryCriminals([])}
                  className="text-xs text-slate-500 hover:text-rose-400 font-mono transition cursor-pointer"
                >
                  Clear Trail ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {historyCriminals.map((item, idx) => {
                  const isCurrent = selectedEntityId === item.id;
                  return (
                    <button
                      key={`${item.id}_${idx}`}
                      onClick={() => {
                        onSelectEntity(item.id, false);
                        setRightHudTab('selected');
                      }}
                      className={`p-2.5 rounded-2xl border text-left transition flex items-center justify-between cursor-pointer ${
                        isCurrent
                          ? 'bg-indigo-500/20 border-indigo-500/60 shadow-md shadow-indigo-950/50'
                          : 'bg-slate-950/80 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono font-bold text-indigo-400 shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate text-white">
                            {item.name}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {item.role}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-1">
                        <span className="text-[10px] font-mono text-cyan-400 block">
                          BW: {Number(item.betweenness).toFixed(3)}
                        </span>
                        {isCurrent ? (
                          <span className="text-[9px] font-bold text-cyan-300">Active</span>
                        ) : (
                          <span className="text-[9px] text-indigo-400 hover:underline">Focus →</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      )}


      {/* RELATIONSHIP EVIDENCE & TRACEABILITY INSPECTOR MODAL */}
      {inspectedRelationship && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 font-sans animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase font-bold text-cyan-400">
                  RELATIONSHIP TRACEABILITY INSPECTOR
                </span>
                <h3 className="text-base font-black text-slate-100 mt-0.5">
                  {inspectedRelationship.relation_type} Connection Lineage
                </h3>
              </div>
              <button
                onClick={() => setInspectedRelationship(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Why does this relationship exist? */}
            <div className="p-3.5 bg-cyan-950/30 border border-cyan-500/30 rounded-2xl space-y-1">
              <div className="text-[11px] font-mono font-bold text-cyan-400 uppercase">
                Why does this relationship exist?
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                Documented link between{' '}
                <span className="font-bold text-cyan-300">
                  {nodes.find(n => n.id === (typeof inspectedRelationship.source === 'object' ? inspectedRelationship.source.id : inspectedRelationship.source))?.name || inspectedRelationship.source}
                </span>{' '}
                and{' '}
                <span className="font-bold text-cyan-300">
                  {nodes.find(n => n.id === (typeof inspectedRelationship.target === 'object' ? inspectedRelationship.target.id : inspectedRelationship.target))?.name || inspectedRelationship.target}
                </span>.
              </p>
            </div>

            {/* 🚨 Suspected Criminal Offense / Activity Inference */}
            {(() => {
              const crime = inferCrimeFallback(inspectedRelationship);
              if (!crime) return null;
              const severityStyle = getSeverityStyle(crime.crime_severity);
              return (
                <div className={`p-4 rounded-2xl border ${severityStyle.card} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🚨</span>
                      <span className="text-[10.5px] font-mono font-bold uppercase tracking-wider text-rose-400">
                        Suspected Criminal Offense / Nexus
                      </span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${severityStyle.badge}`}>
                        {crime.crime_severity} Severity
                      </span>
                      {crime.indictment_readiness && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900/90 text-slate-300 border border-slate-700">
                          {crime.indictment_readiness}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                      {crime.suspected_crime}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                      Category: <span className={severityStyle.accent}>{crime.crime_category}</span>
                    </span>
                  </div>

                  {crime.legal_statutes && crime.legal_statutes.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Applicable Legal Statutes & Acts:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {crime.legal_statutes.map((statute, sIdx) => (
                          <span
                            key={sIdx}
                            className="text-[10px] font-mono bg-slate-900/90 text-amber-300 px-2 py-0.5 rounded-md border border-amber-500/30"
                          >
                            ⚖️ {statute}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {crime.crime_rationale && (
                    <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed font-sans">
                      <span className="font-semibold text-slate-200">Forensic Nexus: </span>
                      {crime.crime_rationale}
                    </div>
                  )}

                  {crime.actionable_recommendations && crime.actionable_recommendations.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-bold block">
                        Recommended Investigative Directives:
                      </span>
                      <div className="space-y-1 text-[11px] text-slate-300">
                        {crime.actionable_recommendations.map((rec, rIdx) => (
                          <div key={rIdx} className="flex items-start gap-1.5">
                            <span className="text-emerald-400 font-bold text-xs mt-0.5">→</span>
                            <span className="leading-snug">{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Confidence Score Bar & Breakdown */}
            <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">Evidence Confidence Score:</span>
                <span className="font-bold text-cyan-300">
                  {((inspectedRelationship.confidence !== undefined ? inspectedRelationship.confidence : 0.5) * 100).toFixed(0)}% • {inspectedRelationship.confidence_label || 'Moderate'}
                </span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all"
                  style={{ width: `${(inspectedRelationship.confidence !== undefined ? inspectedRelationship.confidence : 0.5) * 100}%` }}
                />
              </div>
              {inspectedRelationship.confidence_reasons && inspectedRelationship.confidence_reasons.length > 0 && (
                <div className="pt-2 text-[11px] text-slate-400 space-y-1 font-mono">
                  <div className="text-slate-500 text-[10px] uppercase font-bold">Scoring Factors:</div>
                  {inspectedRelationship.confidence_reasons.map((r, rIdx) => (
                    <div key={rIdx} className="text-slate-300">• {r}</div>
                  ))}
                </div>
              )}
            </div>

            {/* Forensic Evidence Lineage & Chain of Custody */}
            <div className="p-3.5 bg-slate-950/90 rounded-2xl border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span className="font-bold text-cyan-400 uppercase flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-cyan-400" /> Evidence Lineage & Provenance
                </span>
                {inspectedRelationship.evidentiary_sufficiency && (
                  <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] border border-cyan-800">
                    Sufficiency: {inspectedRelationship.evidentiary_sufficiency}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-300 space-y-1 font-sans leading-relaxed">
                <div>
                  <span className="text-slate-500 font-mono text-[10px] uppercase block">Lineage Path:</span>
                  <span className="text-cyan-200 font-mono text-xs">
                    {nodes.find(n => n.id === (typeof inspectedRelationship.source === 'object' ? inspectedRelationship.source.id : inspectedRelationship.source))?.name || inspectedRelationship.source}
                    {' '}&rarr; [{inspectedRelationship.relation_type}]{' '}&rarr;{' '}
                    {nodes.find(n => n.id === (typeof inspectedRelationship.target === 'object' ? inspectedRelationship.target.id : inspectedRelationship.target))?.name || inspectedRelationship.target}
                  </span>
                </div>
                <div className="text-slate-400 text-xs">
                  Derived from source evidence <span className="text-slate-200 font-mono">{inspectedRelationship.source_file || inspectedRelationship.evidence_id || 'Primary Ingestion'}</span> with confirmed endpoint entities and non-repudiation logging.
                </div>
              </div>
            </div>

            {/* Evidence Quotes / Citations */}
            {inspectedRelationship.evidence && inspectedRelationship.evidence.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-[11px] font-mono uppercase font-semibold text-slate-400">Evidence Citations</div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-1 max-h-28 overflow-y-auto">
                  {inspectedRelationship.evidence.map((ev, evIdx) => (
                    <div key={evIdx} className="italic text-slate-200">"{ev}"</div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata (File, Evidence ID, Validation Status) */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-1">
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase">Source Artifact</span>
                <span className="text-slate-200 truncate block">{inspectedRelationship.source_file || 'Ingested Stream'}</span>
              </div>
              <div className="p-2 bg-slate-950 rounded-lg border border-slate-800">
                <span className="text-slate-500 block text-[9px] uppercase">Validation Status</span>
                <span className="text-emerald-400 font-bold block">{inspectedRelationship.validation_status || 'Valid'}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setInspectedRelationship(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}