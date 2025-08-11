Steps to Run the Project

1. Clone the repository
   git clone https://github.com/BharathanBtech/jsonResponseStreamableHttp.git

2. Navigate to the project directory
   cd jsonResponseStreamableHttp

3. Install dependencies
   npm install

4. Build the TypeScript files
   npx tsc

5. Start the MCP server
   node build/index.js

6. Open a new terminal and start the MCP Inspector
   npx @modelcontextprotocol/inspector build/index.js

7. Connect the MCP Inspector to the server
   - In the MCP Inspector page, enter the following URL in the URL field:
     http://localhost:3000/mcp
   - Click Connect.

8. List available tools
   - Click on List Tools to see all available MCP tools.

9. Run a tool
   - Select any tool from the list.
   - Provide the required inputs in the right-hand pane.
   - Click Run Tool to view the server's response.