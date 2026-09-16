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
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { getEntityColor, RELATION_LABELS } from '../utils/colors';
import { logAuditAction } from '../services/api';

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
  onRefresh,
  onOpenIngest,
  onLoadDemo,
  theme = 'midnight'
}) {
  const [autoRotate, setAutoRotate] = useState(true);
  const [showPulses, setShowPulses] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('ALL');

  // Custom dragged/pinned 3D node coordinates: { [nodeId]: { x, y, z } }
  const [customPositions, setCustomPositions] = useState({});

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
      if (l.source === selectedEntityId) {
        neighborIds.add(l.target);
        if (!neighborRelMap.has(l.target)) {
          neighborRelMap.set(l.target, l.relation_type);
        }
        connectedLinks.push(l);
      } else if (l.target === selectedEntityId) {
        neighborIds.add(l.source);
        if (!neighborRelMap.has(l.source)) {
          neighborRelMap.set(l.source, l.relation_type);
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
    const topNode = [...nodes].sort((a, b) => (b.centrality?.betweenness || 0) - (a.centrality?.betweenness || 0))[0];
    if (topNode) {
      onSelectEntity(topNode.id);
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

        const isMatchSearch = hasSearch && (
          node.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          node.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (node.attributes?.role && node.attributes.role.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (node.attributes?.model && node.attributes.model.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (node.attributes?.phone && node.attributes.phone.toLowerCase().includes(searchQuery.toLowerCase()))
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
        const p1 = projectedMap[link.source];
        const p2 = projectedMap[link.target];
        if (!p1 || !p2) return;

        const isDirectToSelected = selectedEntityId && (link.source === selectedEntityId || link.target === selectedEntityId);
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

        if (isDirectToSelected) {
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
          const pulseT = (pulsePhaseRef.current + (parseInt(link.source.replace(/\D/g, '') || 1) * 0.2)) % 1;
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

                    {/* Zoom Controls & Level Indicator */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px] font-mono shadow-inner">
            <button
              onClick={() => setCameraZ((prev) => Math.max(160, prev - 50))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title="Zoom In (or mouse scroll up)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setCameraZ(460)}
              className="px-1.5 py-0.5 rounded hover:bg-slate-800 text-[10px] text-cyan-400 font-bold hover:text-white transition"
              title="Reset Zoom to 100%"
            >
              {Math.round((460 / cameraZ) * 100)}%
            </button>
            <button
              onClick={() => setCameraZ((prev) => Math.min(850, prev + 50))}
              className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition"
              title="Zoom Out (or mouse scroll down)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Kingpin Focus Button */}
          <button
            onClick={handleLocateKingpin}
            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition shadow-sm"
            title="Automatically home in on the highest betweenness broker"
          >
            <Crown className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Focus Kingpin</span>
          </button>

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
          </select>

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

        {/* INTERACTIVE 1-HOP NEIGHBORHOOD HUD CARD */}
        {selectedNode && (
          <div className={`absolute top-4 ${isDrawerOpen ? 'right-4 lg:right-[405px]' : 'right-4'} z-20 max-w-sm bg-slate-950/95 backdrop-blur-xl border border-cyan-500/50 rounded-2xl p-4 shadow-2xl shadow-cyan-950/50 animate-fadeIn font-sans transition-all duration-300`}>
            <div className="flex items-start justify-between border-b border-slate-800 pb-2.5">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                    {selectedNode.type}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Betweenness: {Number(selectedNode.centrality?.betweenness || 0).toFixed(3)}
                  </span>
                </div>
                <h4 className="text-base font-black text-white mt-1 flex items-center space-x-1.5">
                  <span>{selectedNode.name}</span>
                  {customPositions[selectedNode.id] && (
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      Pinned
                    </span>
                  )}
                </h4>
                {selectedNode.attributes?.role && (
                  <p className="text-xs text-cyan-400 font-medium">{selectedNode.attributes.role}</p>
                )}
              </div>

              {/* Close / Deselect */}
              <button
                onClick={() => onSelectEntity(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Deselect and un-dim other nodes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Attached Connected Nodes */}
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mb-1.5">
                <span>Directly Attached Nodes ({neighborObjects.length})</span>
                <span className="text-[10px] text-cyan-400 font-mono font-normal">Highlighted Bold</span>
              </div>

              {neighborObjects.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No direct connections recorded.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                  {neighborObjects.map(nb => (
                    <button
                      key={nb.id}
                      onClick={() => onSelectEntity(nb.id)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-xl bg-slate-900/90 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-200 border border-slate-700/80 hover:border-cyan-500/40 text-xs font-bold transition shadow-sm"
                      title={`Click to focus on ${nb.name}`}
                    >
                      {getTypeIcon(nb.type)}
                      <span className="truncate max-w-[130px]">{nb.name}</span>
                      <span className="text-[9px] font-mono text-cyan-400 opacity-80">({nb.relType})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Position Reset if moved */}
            {customPositions[selectedNode.id] && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[11px] text-purple-300">Repositioned in 3D</span>
                <button
                  onClick={() => handleResetNodePosition(selectedNode.id)}
                  className="text-[11px] text-purple-400 hover:text-purple-200 font-bold inline-flex items-center space-x-1"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Unpin Position</span>
                </button>
              </div>
            )}

            {/* Quick Drawer Hint */}
            <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
              <span className="text-slate-500">Inspect 1-hop neighborhood & evidence</span>
              <button
                onClick={() => {
                  if (onOpenDrawer) {
                    onOpenDrawer(selectedNode.id);
                  } else {
                    onSelectEntity(selectedNode.id);
                  }
                }}
                className={`font-bold inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl transition shadow-sm cursor-pointer ${
                  isDrawerOpen
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-cyan-500/10 hover:bg-cyan-500/25 text-cyan-300 hover:text-white border border-cyan-500/30'
                }`}
                title="Open forensic dossier side drawer"
              >
                <span>{isDrawerOpen ? 'Drawer Open' : 'Open Drawer'}</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isDrawerOpen ? 'rotate-90 text-cyan-400' : ''}`} />
              </button>
            </div>
          </div>
        )}

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

    </div>
  );
}