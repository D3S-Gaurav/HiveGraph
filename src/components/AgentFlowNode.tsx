"use client";

import { Handle, Position, type NodeProps } from "reactflow";
import { AGENT_META, type AgentStatus, type AgentType } from "@/lib/swarm/types";
import type { CSSProperties } from "react";
import { AgentIcon } from "./ui/Icons";

export interface FlowNodeData {
  agentType: AgentType;
  title: string;
  status: AgentStatus;
  score?: number;
  preview: string;
  selected: boolean;
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: "idle",
  thinking: "thinking",
  streaming: "working",
  validating: "in review",
  retrying: "revising",
  done: "done",
  failed: "failed",
};

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: "#52525b",
  thinking: "#fbbf24",
  streaming: "#38bdf8",
  validating: "#fb7185",
  retrying: "#f59e0b",
  done: "#34d399",
  failed: "#ef4444",
};

const active = (s: AgentStatus) =>
  s === "thinking" || s === "streaming" || s === "validating" || s === "retrying";

export function AgentFlowNode({ data }: NodeProps<FlowNodeData>) {
  const meta = AGENT_META[data.agentType];
  const live = active(data.status);
  return (
    <div
      className={`hivegraph-node${live ? " is-live" : ""}${data.selected ? " is-selected" : ""}`}
      style={{ "--agent-color": meta.color } as CSSProperties}
    >
      <Handle type="target" position={Position.Top} className="hivegraph-handle" />
      <div className="hivegraph-node-head">
        <span className="hivegraph-agent-glyph">
          <AgentIcon type={data.agentType} size={16} />
        </span>
        <div className="hivegraph-node-titles">
          <span className="hivegraph-node-type">{meta.label}</span>
          <span className="hivegraph-node-title">{data.title}</span>
        </div>
        {data.score != null && (
          <span className="hivegraph-score" title="Validator score">
            {data.score}/10
          </span>
        )}
      </div>

      <div className="hivegraph-status">
        <span
          className="hivegraph-dot"
          style={{
            background: STATUS_DOT[data.status],
          }}
        />
        {STATUS_LABEL[data.status]}
      </div>

      {data.preview && <div className="hivegraph-preview">{data.preview}</div>}
      <Handle type="source" position={Position.Bottom} className="hivegraph-handle" />
    </div>
  );
}
