import express from 'express';
import type { Request, Response } from 'express';

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import cors from 'cors';

// Create an MCP server with implementation details
const getServer = () => {
  const server = new McpServer({
    name: 'json-response-streamable-http-server',
    version: '1.0.0',
  }, {
    capabilities: {
      logging: {},
    }
  });

  // Register a simple greeting tool
  server.tool(
    'greet',
    'A simple greeting tool',
    {
      name: z.string().describe('Name to greet'),
    },
    async ({ name }): Promise<CallToolResult> => {
      return {
        content: [
          {
            type: 'text',
            text: `Hello, ${name}!`,
          },
        ],
      };
    }
  );

  // Register a multi-greet tool with notifications
  server.tool(
    'multi-greet',
    'A tool that sends different greetings with delays between them',
    {
      name: z.string().describe('Name to greet'),
    },
    async ({ name }, { sendNotification }): Promise<CallToolResult> => {
      const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      await sendNotification({
        method: "notifications/message",
        params: { level: "debug", data: `Starting multi-greet for ${name}` }
      });

      await sleep(1000);

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending first greeting to ${name}` }
      });

      await sleep(1000);

      await sendNotification({
        method: "notifications/message",
        params: { level: "info", data: `Sending second greeting to ${name}` }
      });

      return {
        content: [
          {
            type: 'text',
            text: `Good morning, ${name}!`,
          }
        ],
      };
    }
  );

  return server;
};

const app = express();
app.use(express.json());

// Configure CORS to expose MCP headers
app.use(cors({
  origin: '*',
  exposedHeaders: ['Mcp-Session-Id']
}));

// Store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

app.post('/mcp', async (req: Request, res: Response) => {
  console.log('\n📥 Received MCP POST request');
  console.log(`🔗 URL: ${req.url}`);
  console.log('📦 Payload:', JSON.stringify(req.body, null, 2));

  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    console.log(`🔍 Extracted session ID from headers: ${sessionId || 'None'}`);

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      console.log(`✅ Found existing transport for session ID: ${sessionId}`);
      transport = transports[sessionId];
    } else if (isInitializeRequest(req.body)) {
      console.log('🆕 Valid initialize request detected. Creating new transport...');

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => {
          const generatedId = sessionId || randomUUID();
          console.log(`🛠️ Generated session ID: ${generatedId}`);
          return generatedId;
        },
        enableJsonResponse: true,
        onsessioninitialized: (initializedSessionId) => {
          console.log(`🎉 Session initialized with ID: ${initializedSessionId}`);
          transports[initializedSessionId] = transport;
        }
      });

      const server = getServer();
      console.log('🔗 Connecting server to transport...');
      await server.connect(transport);

      console.log('📨 Handling initialize request...');
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      console.warn('⚠️ Invalid request: No valid session ID and not an initialize request.');
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    console.log('📨 Handling request with existing transport...');
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('❌ Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// Respond to unsupported GET requests
app.get('/mcp', (req: Request, res: Response) => {
  console.log('\n📥 Received MCP GET request');
  console.log(`🔗 URL: ${req.url}`);
  res.status(405).set('Allow', 'POST').send('Method Not Allowed');
});

// Start the server
const PORT = 3000;
app.listen(PORT, (error) => {
  if (error) {
    console.error('🚫 Failed to start server:', error);
    process.exit(1);
  }
  console.log(`✅ MCP Streamable HTTP Server listening at http://localhost:${PORT}/mcp`);
});


// Graceful shutdown
process.on('SIGINT', () => {
  console.log('👋 Shutting down server...');
  process.exit(0);
});
