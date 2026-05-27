import pool from '../../db/pool.js';
import { calculateAuditHash, verifyAuditChain } from '../../utils/auditChain.js';

export var AuditService = (function() {
  function AuditService() {}
  
  AuditService.prototype.log = async function(userId: any, action: string, resource: string, detail: string, ip?: string) {
    var c = await pool.connect();
    try {
      var last = await c.query("SELECT chain_hash FROM audit_logs ORDER BY created_at DESC LIMIT 1");
      var prevHash = last.rows.length > 0 ? last.rows[0].chain_hash : '';
      var now = new Date().toISOString();
      var chainHash = calculateAuditHash(prevHash, userId ? String(userId) : null, action, now, detail || '');
      await c.query("INSERT INTO audit_logs (user_id, action, resource, detail, ip_address, chain_hash) VALUES ($1,$2,$3,$4,$5,$6)", [userId, action, resource, detail, ip, chainHash]);
    } finally { c.release(); }
  };
  
  AuditService.prototype.getLogs = async function(filters: any) {
    var c = await pool.connect();
    try {
      var q = "SELECT a.*, u.name, u.email FROM audit_logs a LEFT JOIN users u ON a.user_id = u.id WHERE 1=1";
      var params: any[] = [];
      if (filters.userId) { q += " AND a.user_id = $" + (params.length+1); params.push(filters.userId); }
      if (filters.action) { q += " AND a.action = $" + (params.length+1); params.push(filters.action); }
      q += " ORDER BY a.created_at DESC LIMIT 100";
      var result = await c.query(q, params);
      var chainValid = verifyAuditChain(result.rows.reverse());
      return { data: result.rows, total: result.rows.length, chainValid: chainValid };
    } finally { c.release(); }
  };
  
  return AuditService;
})();

export var auditService = new AuditService();
