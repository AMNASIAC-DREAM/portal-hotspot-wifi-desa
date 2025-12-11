// ═══════════════════════════════════════════════════════════════════════════
// MIKROTIK HOTSPOT DNA CHALLENGE WORKER
// Version: 1.0.0
// Description: Device DNA binding for voucher validation
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CORS HEADERS
// ═══════════════════════════════════════════════════════════════════════════
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════════════════
export default {
  async fetch(request, env, ctx) {
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
          return new Response(null, { headers: corsHeaders });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      try {
          // ═══════════════════════════════════════════════════════════
          // ROUTE: GET /tls-info
          // ═══════════════════════════════════════════════════════════
          if (path === '/tls-info' && request.method === 'GET') {
              return handleTLSInfo(request);
          }

          // ═══════════════════════════════════════════════════════════
          // ROUTE: POST /api/validate
          // ═══════════════════════════════════════════════════════════
          if (path === '/api/validate' && request.method === 'POST') {
              return handleValidate(request, env);
          }

          // ═══════════════════════════════════════════════════════════
          // ROUTE: GET /api/check/:voucher
          // ═══════════════════════════════════════════════════════════
          if (path.startsWith('/api/check/') && request.method === 'GET') {
              const voucher = path.replace('/api/check/', '');
              return handleCheck(voucher, env);
          }

          // ═══════════════════════════════════════════════════════════
          // ROUTE: GET /api/list
          // ═══════════════════════════════════════════════════════════
          if (path === '/api/list' && request.method === 'GET') {
              return handleList(env);
          }

          // ═══════════════════════════════════════════════════════════
          // ROUTE: DELETE /api/delete/:voucher
          // ═══════════════════════════════════════════════════════════
          if (path.startsWith('/api/delete/') && request.method === 'DELETE') {
              const voucher = path.replace('/api/delete/', '');
              return handleDelete(voucher, env);
          }

          // ═══════════════════════════════════════════════════════════
          // ROUTE: GET / (Info page)
          // ═══════════════════════════════════════════════════════════
          if (path === '/' || path === '') {
              return handleInfo();
          }

          // 404
          return jsonResponse({ error: 'Not Found', path: path }, 404);

      } catch (error) {
          return jsonResponse({ error: error.message }, 500);
      }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER: TLS INFO
// ═══════════════════════════════════════════════════════════════════════════
function handleTLSInfo(request) {
  const cf = request.cf || {};
  
  const tlsInfo = {
      tlsVersion: cf.tlsVersion || 'N/A',
      tlsCipher: cf.tlsCipher || 'N/A',
      tlsClientAuth: cf.tlsClientAuth || 'N/A',
      helloLength: cf.tlsClientHelloLength || 'N/A',
      clientIP: request.headers.get('CF-Connecting-IP') || 'N/A',
      country: cf.country || 'N/A',
      city: cf.city || 'N/A',
      asn: cf.asn || 'N/A',
      colo: cf.colo || 'N/A',
      timestamp: new Date().toISOString()
  };

  return jsonResponse(tlsInfo);
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER: VALIDATE VOUCHER + DNA
// ═══════════════════════════════════════════════════════════════════════════
async function handleValidate(request, env) {
  const body = await request.json();
  const { voucher, dna, tls, timestamp } = body;

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION: Required fields
  // ─────────────────────────────────────────────────────────────────
  if (!voucher) {
      return jsonResponse({
          success: false,
          error: 'MISSING_VOUCHER',
          message: 'Voucher code is required'
      }, 400);
  }

  if (!dna) {
      return jsonResponse({
          success: false,
          error: 'MISSING_DNA',
          message: 'Device DNA is required'
      }, 400);
  }

  // ─────────────────────────────────────────────────────────────────
  // VALIDATION: Check Firefox (REJECT)
  // ─────────────────────────────────────────────────────────────────
  if (dna.browserType === 'Firefox') {
      return jsonResponse({
          success: false,
          error: 'BROWSER_NOT_SUPPORTED',
          message: 'Firefox is not supported. Please use Chrome or WebView.'
      }, 403);
  }

  // ─────────────────────────────────────────────────────────────────
  // Generate DNA Hash
  // ─────────────────────────────────────────────────────────────────
  const dnaHash = await generateDNAHash(dna);

  // ─────────────────────────────────────────────────────────────────
  // Check KV for existing voucher
  // ─────────────────────────────────────────────────────────────────
  const kvKey = `voucher:${voucher}`;
  const existing = await env.HOTSPOT_KV.get(kvKey, { type: 'json' });

  // ─────────────────────────────────────────────────────────────────
  // CASE 1: New voucher - BIND DNA
  // ─────────────────────────────────────────────────────────────────
  if (!existing) {
      const newRecord = {
          voucher: voucher,
          dnaHash: dnaHash,
          dna: {
              model: dna.model,
              gpuVendor: dna.gpuVendor,
              gpu: dna.gpu,
              audioLatency: dna.audioLatency,
              screen: dna.screen,
              pixelRatio: dna.pixelRatio,
              touchPoints: dna.touchPoints,
              maxTexture: dna.maxTexture,
              glExtensions: dna.glExtensions
          },
          device: {
              model: dna.model,
              firstBrowser: dna.browserType || 'Unknown'
          },
          status: 'active',
          firstLoginAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          loginCount: 1,
          loginHistory: [{
              time: new Date().toISOString(),
              browser: dna.browserType,
              model: dna.model,
              ip: tls?.clientIP || 'N/A'
          }]
      };

      await env.HOTSPOT_KV.put(kvKey, JSON.stringify(newRecord));

      return jsonResponse({
          success: true,
          action: 'BIND_NEW',
          message: 'Device bound successfully. Proceed to Mikrotik auth.',
          voucher: voucher,
          device: dna.model,
          matchScore: '100%',
          isNewDevice: true
      });
  }

  // ─────────────────────────────────────────────────────────────────
  // CASE 2: Existing voucher - CHECK DNA
  // ─────────────────────────────────────────────────────────────────
  
  // Quick hash match first
  if (existing.dnaHash === dnaHash) {
      // Update login history
      existing.lastLoginAt = new Date().toISOString();
      existing.loginCount = (existing.loginCount || 0) + 1;
      existing.loginHistory = existing.loginHistory || [];
      existing.loginHistory.push({
          time: new Date().toISOString(),
          browser: dna.browserType,
          model: dna.model,
          ip: tls?.clientIP || 'N/A',
          matchType: 'hash'
      });

      await env.HOTSPOT_KV.put(kvKey, JSON.stringify(existing));

      return jsonResponse({
          success: true,
          action: 'HASH_MATCH',
          message: 'Device verified (exact match). Proceed to Mikrotik auth.',
          voucher: voucher,
          device: existing.device?.model || dna.model,
          matchScore: '100%',
          isNewDevice: false,
          loginCount: existing.loginCount
      });
  }

  // Fallback: DNA field matching
  const matchResult = calculateDNAMatch(existing.dna, dna);

  if (matchResult.score >= 80) {
      // Update login history
      existing.lastLoginAt = new Date().toISOString();
      existing.loginCount = (existing.loginCount || 0) + 1;
      existing.loginHistory = existing.loginHistory || [];
      existing.loginHistory.push({
          time: new Date().toISOString(),
          browser: dna.browserType,
          model: dna.model,
          ip: tls?.clientIP || 'N/A',
          matchType: 'dna',
          matchScore: matchResult.score
      });

      await env.HOTSPOT_KV.put(kvKey, JSON.stringify(existing));

      return jsonResponse({
          success: true,
          action: 'DNA_MATCH',
          message: 'Device verified (DNA match). Proceed to Mikrotik auth.',
          voucher: voucher,
          device: existing.device?.model || 'Unknown',
          matchScore: `${matchResult.score}%`,
          matchDetails: matchResult.details,
          isNewDevice: false,
          loginCount: existing.loginCount
      });
  }

  // ─────────────────────────────────────────────────────────────────
  // CASE 3: Different device - REJECT
  // ─────────────────────────────────────────────────────────────────
  return jsonResponse({
      success: false,
      error: 'DEVICE_MISMATCH',
      message: 'Voucher ini telah didaftarkan pada device lain.',
      voucher: voucher,
      registeredDevice: existing.device?.model || 'Unknown',
      currentDevice: dna.model,
      matchScore: `${matchResult.score}%`,
      matchDetails: matchResult.details,
      requiredScore: '80%'
  }, 403);
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER: CHECK VOUCHER STATUS
// ═══════════════════════════════════════════════════════════════════════════
async function handleCheck(voucher, env) {
  const kvKey = `voucher:${voucher}`;
  const record = await env.HOTSPOT_KV.get(kvKey, { type: 'json' });

  if (!record) {
      return jsonResponse({
          exists: false,
          voucher: voucher,
          message: 'Voucher not registered in Worker'
      });
  }

  return jsonResponse({
      exists: true,
      voucher: voucher,
      device: record.device,
      status: record.status,
      firstLoginAt: record.firstLoginAt,
      lastLoginAt: record.lastLoginAt,
      loginCount: record.loginCount,
      dna: record.dna
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER: LIST ALL VOUCHERS
// ═══════════════════════════════════════════════════════════════════════════
async function handleList(env) {
  const list = await env.HOTSPOT_KV.list({ prefix: 'voucher:' });
  
  const vouchers = [];
  for (const key of list.keys) {
      const record = await env.HOTSPOT_KV.get(key.name, { type: 'json' });
      if (record) {
          vouchers.push({
              voucher: record.voucher,
              device: record.device?.model || 'Unknown',
              status: record.status,
              loginCount: record.loginCount,
              lastLoginAt: record.lastLoginAt
          });
      }
  }

  return jsonResponse({
      total: vouchers.length,
      vouchers: vouchers
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER: DELETE VOUCHER
// ═══════════════════════════════════════════════════════════════════════════
async function handleDelete(voucher, env) {
  const kvKey = `voucher:${voucher}`;
  await env.HOTSPOT_KV.delete(kvKey);

  return jsonResponse({
      success: true,
      message: `Voucher ${voucher} deleted`,
      voucher: voucher
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER: INFO PAGE
// ═══════════════════════════════════════════════════════════════════════════
function handleInfo() {
  const info = {
      name: 'Mikrotik Hotspot DNA Challenge Worker',
      version: '1.0.0',
      endpoints: {
          'GET /': 'This info page',
          'GET /tls-info': 'Get TLS fingerprint info',
          'POST /api/validate': 'Validate voucher + DNA',
          'GET /api/check/:voucher': 'Check voucher status',
          'GET /api/list': 'List all registered vouchers',
          'DELETE /api/delete/:voucher': 'Delete voucher binding'
      },
      dnaFields: [
          'model', 'gpuVendor', 'gpu', 'audioLatency',
          'screen', 'pixelRatio', 'touchPoints', 'maxTexture', 'glExtensions'
      ],
      matchThreshold: '80%',
      rejectedBrowsers: ['Firefox']
  };

  return jsonResponse(info);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Generate DNA Hash
// ═══════════════════════════════════════════════════════════════════════════
async function generateDNAHash(dna) {
  const dnaString = JSON.stringify({
      model: dna.model,
      gpuVendor: dna.gpuVendor,
      gpu: dna.gpu,
      audioLatency: dna.audioLatency,
      screen: dna.screen,
      pixelRatio: dna.pixelRatio,
      touchPoints: dna.touchPoints,
      maxTexture: dna.maxTexture,
      glExtensions: dna.glExtensions
  });

  const encoder = new TextEncoder();
  const data = encoder.encode(dnaString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: Calculate DNA Match Score
// ═══════════════════════════════════════════════════════════════════════════
function calculateDNAMatch(stored, current) {
  const weights = {
      gpuVendor: 20,      // Primary - very unique
      gpu: 15,            // Primary - very unique  
      audioLatency: 20,   // Primary - very unique
      model: 0,           // Skip if hidden
      screen: 10,         // Secondary
      pixelRatio: 10,     // Secondary
      touchPoints: 10,    // Secondary
      maxTexture: 8,      // Secondary
      glExtensions: 7     // Secondary
  };

  let score = 0;
  let maxScore = 0;
  const details = {};

  for (const [field, weight] of Object.entries(weights)) {
      // Skip model comparison if current is hidden
      if (field === 'model' && 
          (current.model === 'hidden-by-chrome' || current.model === 'unknown')) {
          details[field] = { match: 'skipped', reason: 'hidden' };
          continue;
      }

      maxScore += weight;

      // Handle audioLatency with tolerance
      if (field === 'audioLatency') {
          const storedVal = parseFloat(stored[field]) || 0;
          const currentVal = parseFloat(current[field]) || 0;
          
          if (storedVal === currentVal) {
              score += weight;
              details[field] = { match: true, stored: storedVal, current: currentVal };
          } else if (Math.abs(storedVal - currentVal) < 0.001) {
              // Small tolerance for floating point
              score += weight * 0.8;
              details[field] = { match: 'partial', stored: storedVal, current: currentVal };
          } else {
              details[field] = { match: false, stored: storedVal, current: currentVal };
          }
          continue;
      }

      // Handle pixelRatio with tolerance
      if (field === 'pixelRatio') {
          const storedVal = parseFloat(stored[field]) || 0;
          const currentVal = parseFloat(current[field]) || 0;
          
          if (Math.abs(storedVal - currentVal) <= 0.3) {
              score += weight;
              details[field] = { match: true, stored: storedVal, current: currentVal };
          } else {
              details[field] = { match: false, stored: storedVal, current: currentVal };
          }
          continue;
      }

      // Exact match for other fields
      if (stored[field] === current[field]) {
          score += weight;
          details[field] = { match: true, value: current[field] };
      } else {
          details[field] = { match: false, stored: stored[field], current: current[field] };
      }
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  return {
      score: percentage,
      rawScore: score,
      maxScore: maxScore,
      details: details
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: JSON Response
// ═══════════════════════════════════════════════════════════════════════════
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
      status: status,
      headers: corsHeaders
  });
}
