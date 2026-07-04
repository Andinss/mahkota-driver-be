export function extractRequestMeta(req: any): { ip_address: string; user_agent: string } {
  return {
    ip_address: req.headers['x-forwarded-for'] || req.connection?.remoteAddress || req.ip || '',
    user_agent: req.headers['user-agent'] || '',
  };
}
