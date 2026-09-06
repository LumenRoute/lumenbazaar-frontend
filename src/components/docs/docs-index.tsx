import { ExternalLink } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { McpToolInspector } from "@/components/mcp/mcp-tool-inspector";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { canonicalDocsRepo, docsLinks } from "@/services/docs-links";

export function DocsIndex() {
  return (
    <>
      <PageHeader
        description="Jump to canonical seller, buyer, agent, operator, API, contract, and security documentation."
        title="Documentation"
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-slate-950">Canonical source</h2>
            <p className="mt-1 break-all text-sm text-slate-600">{canonicalDocsRepo}</p>
          </CardHeader>
          <CardBody className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {docsLinks.map((link) => {
              const Icon = link.icon;

              return (
                <a
                  className="block rounded-md border border-slate-200 p-4 hover:border-teal-300 hover:bg-teal-50/40"
                  href={link.href}
                  key={link.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
                      <h3 className="font-medium text-slate-950">{link.label}</h3>
                    </div>
                    <ExternalLink aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{link.description}</p>
                  <Badge className="mt-3" tone="neutral">
                    lumenbazaar-docs
                  </Badge>
                </a>
              );
            })}
          </CardBody>
        </Card>

        <McpToolInspector />
      </div>
    </>
  );
}
