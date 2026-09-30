const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || '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';
const NVIDIA_MODEL = process.env.NVIDIA_MODEL || 'stepfun-ai/step-3.7-flash';

const server = http.createServer((req, res) => {
  // Global CORS Headers so browser fetch works from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy API endpoint to bypass Browser CORS
  if (req.method === 'POST' && (req.url === '/api/chat' || req.url.endsWith('/api/chat'))) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsedBody = {};
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {}

      const question = parsedBody.question || (parsedBody.messages && parsedBody.messages[parsedBody.messages.length - 1]?.content) || '';
      const model = parsedBody.model || NVIDIA_MODEL;
      const apiKey = parsedBody.apiKey || NVIDIA_API_KEY;

      const payload = JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are an intelligent, concise classroom AI copilot. Provide a direct, clear, and accurate answer to the user question in 2-3 sentences max.'
          },
          {
            role: 'user',
            content: question
          }
        ],
        temperature: 0.6,
        max_tokens: 300
      });

      const options = {
        hostname: 'integrate.api.nvidia.com',
        port: 443,
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 60000 // Generous 60s timeout for model reasoning
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let resData = '';
        proxyRes.on('data', chunk => resData += chunk);
        proxyRes.on('end', () => {
          res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
          res.end(resData);
        });
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy(new Error('NVIDIA API request timed out (60s limit reached)'));
      });

      proxyReq.on('error', (err) => {
        console.error('NVIDIA API Proxy Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(payload);
      proxyReq.end();
    });
    return;
  }

  // Serve static Question Detector.html
  const filePath = path.join(__dirname, 'Question Detector.html');
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Error loading Question Detector.html');
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🎓 Classroom Copilot Server Running!`);
  console.log(`👉 Open http://localhost:3000 in your browser`);
  console.log(`==================================================\n`);
});
