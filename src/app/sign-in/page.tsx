import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { AuthForm } from "@/components/AuthForm";
import { AuthSwarmGraph } from "@/components/AuthSwarmGraph";
import { AmbientRelayVideo } from "@/components/AmbientRelayVideo";
import { auth } from "@/lib/auth";
import { HiveGraphBrand } from "@/components/ui/Brand";
import {
  ArrowUpRightIcon,
  CheckIcon,
  GitHubIcon,
  RadioIcon,
} from "@/components/ui/Icons";

export default async function SignInPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect("/");
  const mcpUrl = new URL("/api/mcp", process.env.APP_URL ?? "http://localhost:3000").toString();
  const codexConfig = `[mcp_servers.hivegraph]\nurl = "${mcpUrl}"\nbearer_token_env_var = "HIVEGRAPH_MCP_TOKEN"`;
  const claudeConfig = JSON.stringify({
    type: "http",
    url: mcpUrl,
    headers: { Authorization: "Bearer ${HIVEGRAPH_MCP_TOKEN}" },
  });

  return (
    <main className="hivegraph-auth-page">
      <section className="hivegraph-auth-showcase" aria-labelledby="hivegraph-auth-title">
        <div className="hivegraph-auth-video" aria-hidden="true">
          <AmbientRelayVideo />
        </div>
        <div className="hivegraph-auth-showcase-top">
          <HiveGraphBrand tagline="Live agent swarm orchestration" />
          <a
            className="hivegraph-auth-source"
            href="https://github.com/D3S-Gaurav/HiveGraph"
            target="_blank"
            rel="noreferrer"
          >
            <GitHubIcon size={17} />
            GitHub
            <ArrowUpRightIcon size={15} />
          </a>
        </div>

        <div className="hivegraph-auth-story">
          <div className="hivegraph-live-label">
            <RadioIcon size={15} />
            Durable orchestration, visible live
          </div>
          <h1 id="hivegraph-auth-title">One ambitious goal. A swarm that proves its work.</h1>
          <p>
            HiveGraph plans the work, runs specialists in parallel, validates their output, and
            synthesizes one usable result—while you watch the complete execution graph unfold.
          </p>
        </div>

        <AuthSwarmGraph />

        <ul className="hivegraph-auth-proof">
          <li><CheckIcon size={15} /> Temporal durability</li>
          <li><CheckIcon size={15} /> Redis replay</li>
          <li><CheckIcon size={15} /> Validated output</li>
        </ul>
      </section>

      <section className="hivegraph-auth-entry" aria-label="HiveGraph account access">
        <AuthForm />
        <p className="hivegraph-auth-footnote">Secure sessions powered by Better Auth. Payments stay on Stripe.</p>
        <aside className="hivegraph-auth-terminal" aria-label="Connect Codex or Claude Code through MCP">
          <header>
            <span className="hivegraph-terminal-lights" aria-hidden="true"><i /><i /><i /></span>
            <strong>HiveGraph MCP</strong>
            <span>Sign in to create token</span>
          </header>
          <div className="hivegraph-terminal-body">
            <div>
              <b>Token</b>
              <code>export HIVEGRAPH_MCP_TOKEN=&quot;&lt;token from Connect MCP&gt;&quot;</code>
            </div>
            <div>
              <b>Codex</b>
              <code>{codexConfig}</code>
            </div>
            <div>
              <b>Claude Code</b>
              <code>claude mcp add-json --scope user hivegraph &apos;{claudeConfig}&apos;</code>
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}
