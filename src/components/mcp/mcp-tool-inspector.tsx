"use client";

import { Bot, CircleDollarSign, FileJson } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/surfaces";
import { loadRuntimeConfig } from "@/config/runtime";
import {
  findMcpTool,
  mcpServerMetadata,
  mcpToolContracts,
  type McpToolName
} from "@/services/mcp-tools";

export function McpToolInspector() {
  const config = loadRuntimeConfig();
  const [selectedTool, setSelectedTool] = useState<McpToolName>("search_paid_resources");
  const [maxAmount, setMaxAmount] = useState("1.0000000");
  const [maxCalls, setMaxCalls] = useState(10);
  const tool = useMemo(() => findMcpTool(selectedTool), [selectedTool]);

  if (!config.features.enableMcpInspector) {
    return (
      <EmptyState
        title="MCP inspector is disabled"
        description="Enable NEXT_PUBLIC_ENABLE_MCP_INSPECTOR=true to expose local paid-tool contracts."
      />
    );
  }

  if (tool === undefined) {
    return (
      <EmptyState
        title="MCP tool is unavailable"
        description="The selected MCP tool contract is not present in the local frontend build."
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Bot aria-hidden="true" className="h-5 w-5 text-teal-700" />
            MCP tool inspector
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Inspect agent-facing paid-resource contracts and deterministic error examples.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="info">{mcpServerMetadata.settlementAdapter}</Badge>
          <Badge tone="neutral">{mcpServerMetadata.version}</Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Metadata label="Server" value={mcpServerMetadata.name} />
          <Metadata label="Protocol" value={mcpServerMetadata.protocol} />
          <Metadata label="Discovery" value={mcpServerMetadata.resourceDiscovery} />
          <Metadata label="Settlement" value={mcpServerMetadata.settlementAdapter} />
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-4">
            <label className="space-y-1 text-sm">
              <span className="font-medium text-slate-700">Tool</span>
              <select
                className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                onChange={(event) => {
                  const nextTool = event.target.value as McpToolName;
                  const contract = findMcpTool(nextTool);

                  setSelectedTool(nextTool);
                  setMaxAmount(contract?.budget.defaultMaxAmount ?? maxAmount);
                  setMaxCalls(contract?.budget.maxCalls ?? maxCalls);
                }}
                value={selectedTool}
              >
                {mcpToolContracts.map((contract) => (
                  <option key={contract.name} value={contract.name}>
                    {contract.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-md border border-slate-200 p-4">
              <h3 className="flex items-center gap-2 font-medium text-slate-950">
                <CircleDollarSign aria-hidden="true" className="h-4 w-4 text-teal-700" />
                Budget controls
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Max amount</span>
                  <input
                    className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                    onChange={(event) => setMaxAmount(event.target.value)}
                    value={maxAmount}
                  />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Max calls</span>
                  <input
                    className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-slate-950"
                    min={1}
                    onChange={(event) => setMaxCalls(Number(event.target.value))}
                    type="number"
                    value={maxCalls}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Local controls model client-side spending limits before a paid resource call is
                attempted.
              </p>
            </div>

            <div className="rounded-md border border-slate-200 p-4">
              <h3 className="font-medium text-slate-950">Deterministic errors</h3>
              <div className="mt-3 space-y-2">
                {tool.deterministicErrors.map((error) => (
                  <div key={error.code} className="rounded border border-slate-200 px-3 py-2">
                    <Badge tone={error.code.includes("FAILED") ? "danger" : "warning"}>
                      {error.code}
                    </Badge>
                    <p className="mt-2 text-xs leading-5 text-slate-600">{error.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="flex items-center gap-2 font-medium text-slate-950">
                <FileJson aria-hidden="true" className="h-4 w-4 text-blue-700" />
                Input schema
              </h3>
              <JsonBlock value={tool.inputSchema} />
            </div>
            <div>
              <h3 className="flex items-center gap-2 font-medium text-slate-950">
                <FileJson aria-hidden="true" className="h-4 w-4 text-blue-700" />
                Output schema
              </h3>
              <JsonBlock value={tool.outputSchema} />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <p className="text-xs font-medium uppercase text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs leading-5 text-slate-100">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}
