"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Box,
  Database,
  Globe,
  HardDrive,
  Layers,
  Server,
  Shield,
  Radio,
  BarChart3,
  Waypoints,
  Container,
  Gauge,
} from "lucide-react";
import useCanvasStore, {
  type InfraNodeData,
  type InfraNodeType,
} from "@/store/useCanvasStore";
import { getProviderLabel, CLOUD_LABELS } from "@/lib/cloudProviders";

const ICON_MAP: Record<InfraNodeType, React.ElementType> = {
  docker: Container,
  kubernetes: Layers,
  "load-balancer": Waypoints,
  database: Database,
  storage: HardDrive,
  server: Server,
  firewall: Shield,
  cdn: Globe,
  queue: Radio,
  cache: Gauge,
  "api-gateway": BarChart3,
  monitoring: Box,
};

const TYPE_LABEL: Record<InfraNodeType, string> = {
  docker: "DOCKER",
  kubernetes: "K8S",
  "load-balancer": "LB",
  database: "DB",
  storage: "S3",
  server: "SRV",
  firewall: "FW",
  cdn: "CDN",
  queue: "QUEUE",
  cache: "CACHE",
  "api-gateway": "APIGW",
  monitoring: "MON",
};

function TerminalNode({ data }: NodeProps) {
  const nodeData = data as unknown as InfraNodeData;
  const chaos = nodeData.chaosAffected;
  const Icon = ICON_MAP[nodeData.type] || Box;
  const typeTag = TYPE_LABEL[nodeData.type] || "NODE";

  const activeCloud = useCanvasStore((s) => s.activeCloud);
  const cloudFlash = useCanvasStore((s) => s.cloudFlash);

  const providerLabel = getProviderLabel(
    activeCloud,
    nodeData.type,
    nodeData.label
  );
  const cloudTag = CLOUD_LABELS[activeCloud];

  const borderColor = chaos ? "#FF5F1F" : "#39FF14";
  const textColor = chaos ? "#FF5F1F" : "#39FF14";
  const glowColor = chaos ? "0 0 8px #FF5F1F44" : "0 0 8px #39FF1422";

  // Flash effect: brief white border + glow when cloud changes
  const flashBorder = cloudFlash && !chaos ? "#ffffff" : borderColor;
  const flashGlow = cloudFlash && !chaos ? "0 0 12px #ffffff66" : glowColor;

  return (
    <div
      className={`${chaos ? "animate-shake" : ""} ${cloudFlash ? "animate-glitch" : ""}`}
      style={{
        background: "#000000",
        border: `1px solid ${flashBorder}`,
        minWidth: 190,
        fontFamily: "var(--font-jetbrains), monospace",
        boxShadow: flashGlow,
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "4px 8px",
          borderBottom: `1px solid ${flashBorder}`,
          background: chaos ? "#FF5F1F0D" : cloudFlash ? "#ffffff0D" : "#39FF140D",
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Icon size={12} color={textColor} />
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: textColor,
              textTransform: "uppercase",
            }}
          >
            {typeTag}
          </span>
        </div>
        {/* Cloud badge */}
        <span
          style={{
            fontSize: 7,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#000",
            background: textColor,
            padding: "1px 4px",
            textTransform: "uppercase",
          }}
        >
          {cloudTag}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "8px 10px" }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#FFFFFF",
            marginBottom: 2,
            wordBreak: "break-word",
          }}
        >
          {providerLabel}
        </div>
        <div
          style={{
            fontSize: 8,
            color: "#555",
            marginBottom: 2,
            wordBreak: "break-word",
          }}
        >
          {nodeData.label}
        </div>
        {nodeData.sourceRepo && (
          <div
            style={{
              fontSize: 8,
              color: textColor,
              opacity: 0.6,
              marginBottom: 2,
              wordBreak: "break-word",
              display: "flex",
              alignItems: "center",
              gap: 3,
            }}
          >
            <span style={{ fontSize: 7 }}>&#9656;</span>
            {nodeData.sourceRepo}
          </div>
        )}
        <div
          style={{
            fontSize: 9,
            color: "#888888",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              background: chaos ? "#FF5F1F" : "#39FF14",
              display: "inline-block",
            }}
          />
          {chaos ? "FAILURE" : "RUNNING"}
        </div>
      </div>

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          width: 8,
          height: 8,
          background: "#000000",
          border: `1.5px solid ${borderColor}`,
          borderRadius: 0,
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          width: 8,
          height: 8,
          background: "#000000",
          border: `1.5px solid ${borderColor}`,
          borderRadius: 0,
        }}
      />
    </div>
  );
}

export default memo(TerminalNode);
