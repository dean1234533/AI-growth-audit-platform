import { handleAudit, type AuditEnv } from './routes/audit';
import { handleLead, type LeadEnv } from './routes/lead';

interface Env extends AuditEnv, LeadEnv {
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/api/audit') {
      return handleAudit(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/lead') {
      return handleLead(request, env);
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
