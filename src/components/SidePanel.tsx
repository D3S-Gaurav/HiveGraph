"use client";

import { useEffect, useRef, useState } from "react";
import { useSwarm } from "@/lib/store";
import { AGENT_META } from "@/lib/swarm/types";
import { Markdown } from "./Markdown";
import {
  AgentIcon,
  CloseIcon,
  DownloadIcon,
  MaximizeIcon,
  SparklesIcon,
  WarningIcon,
} from "./ui/Icons";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="hivegraph-stat">
      <span className="hivegraph-stat-val">{value}</span>
      <span className="hivegraph-stat-label">{label}</span>
    </div>
  );
}

export function SidePanel() {
  const { agents, selected, planSummary, planThinking, final, stats, runStatus, error } = useSwarm();
  const agent = selected ? agents[selected] : null;
  const readerContent = agent?.agentType === "synthesizer" && agent.output ? agent.output : final;
  const readerTitle = agent?.agentType === "synthesizer" ? "Final synthesis" : "Final deliverable";
  const readerTriggerRef = useRef<HTMLButtonElement>(null);
  const readerDialogRef = useRef<HTMLDialogElement>(null);
  const readerCloseRef = useRef<HTMLButtonElement>(null);
  const copyResetRef = useRef<number | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied" | "error">("idle");

  function openReader() {
    if (!readerContent) return;
    setCopyStatus("idle");
    setReaderOpen(true);
  }

  function closeReader() {
    readerDialogRef.current?.close();
    setReaderOpen(false);
    window.setTimeout(() => readerTriggerRef.current?.focus(), 0);
  }

  async function copyReaderContent() {
    if (!readerContent) return;

    try {
      await navigator.clipboard.writeText(readerContent);
      setCopyStatus("copied");
      if (copyResetRef.current != null) window.clearTimeout(copyResetRef.current);
      copyResetRef.current = window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("error");
    }
  }

  function downloadPdf() {
    const previousTitle = document.title;
    const restoreTitle = () => {
      document.title = previousTitle;
      window.removeEventListener("afterprint", restoreTitle);
    };
    document.title = `${readerTitle} - HiveGraph`;
    window.addEventListener("afterprint", restoreTitle, { once: true });
    window.print();
    window.setTimeout(restoreTitle, 60_000);
  }

  useEffect(() => {
    const dialog = readerDialogRef.current;
    if (!readerOpen || !readerContent || !dialog || dialog.open) return;

    dialog.showModal();
    window.setTimeout(() => readerCloseRef.current?.focus(), 0);
  }, [readerContent, readerOpen]);

  useEffect(() => {
    if (!readerOpen || !readerContent) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [readerContent, readerOpen]);

  useEffect(() => useSwarm.subscribe((state, previousState) => {
    if (previousState.final && !state.final) {
      readerDialogRef.current?.close();
      setReaderOpen(false);
    }
  }), []);

  useEffect(() => () => {
    if (copyResetRef.current != null) window.clearTimeout(copyResetRef.current);
  }, []);

  return (
    <aside className="hivegraph-side">
      {error && <div className="hivegraph-error" role="alert"><WarningIcon size={17} /><span>{error}</span></div>}

      {agent ? (
        <>
          <div className="hivegraph-side-head">
            <div className="hivegraph-deliverable-heading-row">
              <span style={{ color: AGENT_META[agent.agentType].color }} className="hivegraph-side-label">
                <AgentIcon type={agent.agentType} size={15} /> {AGENT_META[agent.agentType].label}
              </span>
              {agent.agentType === "synthesizer" && agent.output ? (
                <button
                  ref={readerTriggerRef}
                  className="hivegraph-deliverable-open"
                  type="button"
                  onClick={openReader}
                  aria-haspopup="dialog"
                >
                  <MaximizeIcon size={14} />
                  Read full
                </button>
              ) : null}
            </div>
            <h3>{agent.title}</h3>
            {agent.score != null && (
              <div className="hivegraph-verdict">
                Validator: <strong>{agent.score}/10</strong>
                {agent.feedback && <p>{agent.feedback}</p>}
              </div>
            )}
          </div>
          <div className="hivegraph-scroll">
            {agent.output ? <Markdown>{agent.output}</Markdown> : (
              <div className="hivegraph-empty-output">
                <span><AgentIcon type={agent.agentType} size={20} /></span>
                <p>Waiting for this agent&apos;s first output…</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className={`hivegraph-side-head${final ? " hivegraph-deliverable-head" : ""}`}>
            <div className="hivegraph-deliverable-heading-row">
              <span className="hivegraph-side-label">
                <SparklesIcon size={15} />
                {runStatus === "running" ? "Swarm in progress" : runStatus === "done" ? "Final deliverable" : "Run briefing"}
              </span>
              {final ? (
                <button
                  ref={readerTriggerRef}
                  className="hivegraph-deliverable-open"
                  type="button"
                  onClick={openReader}
                  aria-haspopup="dialog"
                >
                  <MaximizeIcon size={14} />
                  Read full
                </button>
              ) : null}
            </div>
            {planSummary && <h3>{planSummary}</h3>}
          </div>

          {stats && (
            <div className="hivegraph-stats">
              <Stat label="agents" value={String(Object.keys(agents).length - 2)} />
              <Stat label="time" value={`${(stats.ms / 1000).toFixed(1)}s`} />
              <Stat label="tokens≈" value={`${((stats.tokensIn + stats.tokensOut) / 1000).toFixed(1)}k`} />
            </div>
          )}

          <div className={`hivegraph-scroll${final ? " hivegraph-deliverable-preview" : ""}`}>
            {final ? (
              <Markdown>{final}</Markdown>
            ) : runStatus === "running" ? (
              <div className="hivegraph-thinking">
                <p className="hivegraph-muted">Planner is decomposing the goal…</p>
                {planThinking && <p className="hivegraph-plan-think">{planThinking}</p>}
              </div>
            ) : (
              <div className="hivegraph-empty-output">
                <span><SparklesIcon size={20} /></span>
                <h4>Your result will land here</h4>
                <p>
                  Deploy a goal to generate a task graph. Select any node to inspect its live work,
                  or stay here for the synthesized deliverable.
                </p>
              </div>
            )}
          </div>

        </>
      )}

      {readerContent ? (
        <dialog
          ref={readerDialogRef}
          className="hivegraph-deliverable-dialog"
          aria-labelledby="hivegraph-deliverable-title"
          aria-describedby="hivegraph-deliverable-description"
          onCancel={(event) => {
            event.preventDefault();
            closeReader();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeReader();
          }}
          onClose={() => setReaderOpen(false)}
        >
          <section className="hivegraph-deliverable-reader">
            <header className="hivegraph-deliverable-reader-head">
              <div className="hivegraph-deliverable-reader-title">
                <span><SparklesIcon size={17} /></span>
                <div>
                  <h2 id="hivegraph-deliverable-title">{readerTitle}</h2>
                  <p id="hivegraph-deliverable-description">
                    Synthesized result from the completed swarm run.
                  </p>
                </div>
              </div>
              <div className="hivegraph-deliverable-reader-actions">
                <button type="button" onClick={downloadPdf} title="Open the print dialog and choose Save as PDF">
                  <DownloadIcon size={14} />
                  Download PDF
                </button>
                <button type="button" onClick={() => void copyReaderContent()}>
                  {copyStatus === "copied" ? "Copied" : copyStatus === "error" ? "Copy failed" : "Copy Markdown"}
                </button>
                <button
                  ref={readerCloseRef}
                  className="hivegraph-deliverable-close"
                  type="button"
                  onClick={closeReader}
                  aria-label={`Close ${readerTitle.toLowerCase()} reader`}
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </header>

            <div className="hivegraph-deliverable-reader-scroll">
              <article className="hivegraph-deliverable-document">
                <Markdown>{readerContent}</Markdown>
              </article>
            </div>

            <span className="hivegraph-deliverable-copy-status" aria-live="polite">
              {copyStatus === "copied"
                ? `${readerTitle} copied to the clipboard.`
                : copyStatus === "error"
                  ? "Clipboard access was blocked."
                  : ""}
            </span>
          </section>
        </dialog>
      ) : null}
    </aside>
  );
}
