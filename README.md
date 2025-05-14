# Local MCP Manager

Local MCP Manager is a desktop application designed to simplify managing Model Context Protocol (MCP) servers. If you use multiple AI coding assistants or tools that rely on MCP (like Cursor, VS Code extensions, Claude Desktop, etc.), this application helps you configure and control them all from one place, avoiding repetitive setup in each tool.

## Core Problem Solved

- **Eliminates Configuration Fragmentation**: Manage all your MCP server configurations in a single application.
- **Centralized Control**: Easily start, stop, and monitor your MCP servers.
- **Enhanced Tooling**: Control which MCP tools are available to your clients via a built-in proxy, without altering original server code.
- **Streamlined Client Setup**: Automatically detects and configures supported MCP clients.

## Key Features

- **Unified Server Configuration**: Add, edit, and manage connection details for all your MCP servers.
- **Client-Specific Setup**: Automatically generates and updates configuration files (e.g., `mcp.json`) for clients like VS Code and Cursor.
- **Process Management**: Start, stop, and view logs for your MCP servers directly from the app.
- **MCP Proxy Server**: Intercepts client requests to filter MCP tools, giving you fine-grained control over tool availability.
- **User-Friendly Interface**: A dashboard to view server statuses, manage configurations, and access logs.

## Current Status & Development Progress

_This project is under active development. Here's a snapshot of our progress:_ 

**Completed:**
*   **Core Architecture:** Initial Electron + React/Vite setup, UI framework (shadcn/UI), IPC communication.
*   **Configuration Management:** Backend and UI for CRUD operations on server configurations, database schema.
*   **Basic Client Detection:** Initial logic for detecting installed MCP clients.

**Work in Progress / Upcoming:**
*   **Advanced Client Integration:**
    *   Generating client-specific `mcp.json` files for various clients (VS Code, Cursor, etc.).
    *   Automated management of client configuration files.
*   **Full Server Process Management:** Starting/stopping servers, status monitoring, log collection and display.
*   **MCP Proxy Server Implementation:** Core proxy logic, UI for tool filtering rules.
*   **UI Refinements:** Main dashboard development, settings panels, theme support, onboarding.
*   **Testing & Packaging:** Comprehensive testing across platforms, installer creation, documentation.

## Technical Stack

- **Framework**: Electron (for cross-platform desktop application)
- **UI**: React with Vite
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: Zustand
- **Database**: SQLite (via better-sqlite3) for persistent configuration
- **Build/Packaging**: Electron Forge

## Roadmap (High-Level)

The project is being developed in phases:

1.  Project Setup & Core Architecture *(Largely Complete)*
2.  Configuration Management *(Largely Complete)*
3.  Client Integration & Configuration Generation *(In Progress)*
4.  Process Management *(Planned)*
5.  MCP Proxy Server Implementation *(Planned)*
6.  User Interface Refinement *(Planned)*
7.  Testing & Packaging *(Planned)*