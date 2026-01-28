
import http from 'http';
import { parse } from 'url';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';
import { pathToFileURL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3001;

const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    const parsedUrl = parse(req.url || '', true);
    const { pathname, query } = parsedUrl;

    if (!pathname || !pathname.startsWith('/api')) {
        res.statusCode = 404;
        res.end('Not Found');
        return;
    }

    // Map /api/foo to api/foo.ts
    const apiName = pathname.replace('/api/', '');
    const entryPath = join(process.cwd(), 'api', `${apiName}.ts`);

    if (!existsSync(entryPath)) {
        res.statusCode = 404;
        res.end(`API function not found: ${entryPath}`);
        return;
    }

    console.log(`🔌 Local API: ${req.method} ${pathname}`);

    try {
        // Read body for POST/PUT
        let body = '';
        await new Promise((resolve) => {
            req.on('data', chunk => body += chunk);
            req.on('end', resolve);
        });

        const jsonBody = body ? JSON.parse(body) : {};

        // Mock Vercel Request
        const vReq = {
            ...req,
            headers: req.headers,
            method: req.method,
            url: req.url,
            query,
            body: jsonBody,
            cookies: {}
        };

        // Mock Vercel Response
        const vRes = {
            status(code: number) {
                res.statusCode = code;
                return this;
            },
            json(data: any) {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(data));
                return this;
            },
            setHeader(p: string, v: string) {
                res.setHeader(p, v);
                return this;
            },
            send(data: any) {
                res.end(data);
                return this;
            },
            end() {
                res.end();
                return this;
            }
        };

        // Dynamically import the handler
        // We use a timestamp to avoid ESM caching if we edit the file
        const moduleUrl = `${pathToFileURL(entryPath).href}?t=${Date.now()}`;
        const module = await import(moduleUrl);

        if (typeof module.default === 'function') {
            await module.default(vReq, vRes);
        } else {
            res.statusCode = 500;
            res.end('Export default function not found in API file');
        }

    } catch (error: any) {
        console.error(`❌ API Execution Error (${apiName}):`, error);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: error.message, stack: error.stack }));
    }
});

server.listen(PORT, () => {
    console.log(`🚀 [Local API Server] Running at http://localhost:${PORT}`);
    console.log(`ℹ️ All requests to /api/* will be handled by files in ./api/*.ts`);
});
