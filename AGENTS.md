# GenAI Portal Notebook - Agent Development Guide

## Project Overview

This is a Next.js 15 web application using the App Router architecture. The application serves as an AI-powered portal providing various assistants and tools for different teams.

### Tech Stack
- **Framework**: Next.js 16.2.6 with App Router
- **UI Library**: Material-UI (MUI) v6
- **Database**: MongoDB 6.12
- **Authentication**: NextAuth v5 (beta)
- **AI/ML**: Azure OpenAI, LangChain, LangGraph
- **Cloud Services**: Azure (App Configuration, Search, Storage)
- **Secrets**: KP Config

### Architecture
- **Frontend**: React components with Material-UI styling
- **Backend**: Next.js API routes for server-side logic
- **External Services**: Integration with an orchestration service for AI workflows
- **State Management**: Context API with custom reducers

### Key Features
- Multi-tenant team structure with dynamic routing (`[teamName]/[assistantName]`)
- Admin portal for team and configuration management
- Smart notes and chat interactions
- Graph builder for workflow visualization
- Document processing and multiple external integrations (SharePoint, Jira, Confluence, etc.)

---

## Code Style Guidelines

### 1. Component Structure
- **Client Components**: Always declare `'use client';` at the top of files using React hooks or browser APIs
- **Server Components**: Default for page components and API routes (no directive needed)
- **File Naming**: Use PascalCase for component files (e.g., `AccountDialog.js`, `Header.js`)
- **Do NOT use `'use server'`** in service files or utility modules. `'use server'` is only for Next.js Server Actions (functions called directly from client components via Next.js's implicit RPC mechanism). Since this project uses explicit API routes (`/api/...`) for all client-server communication, `'use server'` is unnecessary and can expose unintended Server Action endpoints.

### 2. Function Declarations
- **Prefer named exports** for utility functions and services
  ```javascript
  export function calculateSummary(data) { }
  export function validateNodeDefinition(node) { }
  ```
- **Use default exports** for page components and main components
  ```javascript
  export default function AdminLayout({ children }) { }
  ```

### 3. Import Organization
- Group imports logically: external packages, then local modules
- Use absolute imports with `@/` prefix for app directory
- Use `@reducers/` alias for reducer imports
  ```javascript
  import { Dialog, Button } from '@mui/material';
  import { useAuth } from '@/app/context/OpenIdAuthContext';
  import { saveSmartNote } from '@/app/clientServices/smartNoteService';
  import { useSmartNote } from '@reducers/improved/SmartNoteContext';
  ```

### 4. Error Handling
- Always wrap database operations in try-catch blocks
- Return appropriate HTTP status codes in API routes
- Use NextResponse for API route responses
  ```javascript
  return NextResponse.json({ error: 'Message' }, { status: 400 });
  ```

### 5. Async/Await
- Use async/await for asynchronous operations
- Use callback-based patterns when operations are supposed to run in the background
- Handle promise rejections with try-catch

### 7. UI Considerations
- Use Material UI components only
- Avoid using features of Material UI that are deprecated

#### a. Buttons
- MUI Buttons have been customized with specific variants. Instead of using variant='contained' and color='primary' to create a primary button, use variant='prmary'. Use this pattern for all buttons:
    - primary actions: variant='primary'
    - secondary actions variant='secondary'
    - standard buttons for actions not specifically designed to grab attention: variant='action'
    - dangerous and destructive actions: variant='destructive'
    - positive and successful actions: variant='positive'
    - subtle buttons often meant for in-line actions: variant='text'

---

## Security Considerations

### 1. Secrets Management
- **NEVER hardcode secrets, API keys, or credentials in source code**
- Use environment variables for all sensitive configuration
- Store secrets in KP Config for production environments
- Use `.env.local` for local development (never commit to version control)

### 2. Protected Routes
- **All API routes under `/api/admin/` MUST be protected**
  - Verify application admin status using `isAppAdmin()` service
  - Return 403 Forbidden for unauthorized access
  
  ```javascript
  import { isAppAdmin } from "@/app/services/applicationRoleService";
  
  export async function GET(req) {
    const isAdmin = await isAppAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // ... protected logic
  }
  ```

- **All UI components under `/app/admin/` MUST be protected**
  - Use the `AdminLayout` wrapper component
  - Implement client-side checks for admin status
  - Redirect unauthorized users appropriately

### 3. Authentication
- Use NextAuth session management for user authentication
- Validate user sessions on protected API routes
- Support development mode with `AUTH_MODE=bypass` and DEV_USER configuration
- Never trust client-side data; always verify on the server

### 4. Input Validation
- Validate all user inputs in API routes
- Sanitize data before database operations
- Check for required fields and proper data types
- Return descriptive error messages for validation failures

---

## Logging Guidelines

### kpmsg Format
All log messages should use the standardized `kpmsg` (KP Message) JSON format for consistent log aggregation and monitoring.

#### Structure
```javascript
{
  kpmsg: {
    id: 'AI_PORTAL_NOTEBOOK',
    name: '<operation_name>',
    detail: {
      // relevant context
      error: 'error message' // for error cases (optional)
    },
  }
}
```

#### Success Logging
```javascript
console.log(JSON.stringify({
  kpmsg: {
    id: 'AI_PORTAL_NOTEBOOK',
    name: 'updateDocument',
    detail: { nuid, query, id: document.id }
  }
}));
```

#### Error Logging
```javascript
console.error(JSON.stringify({
  kpmsg: {
    id: 'AI_PORTAL_NOTEBOOK',
    name: 'deleteDocuments',
    detail: { nuid, query, error: error.message }
  }
}));
```

#### Best Practices
1. **Always use `JSON.stringify()`** to ensure valid JSON output
2. **Use descriptive operation names** that match the function being executed
3. **Include relevant context** in the `detail` field (queries, IDs, parameters)
4. **Log both success and failure** for critical operations
5. **Use `console.log()` for info/success**, `console.error()` for errors
6. **Keep `id` consistent**: Always use `'AI_PORTAL_NOTEBOOK'`
7. **Avoid logging sensitive data** (passwords, tokens, PII)

#### When to Log
- Database operations (CRUD operations)
- External API calls
- Authentication events
- Authorization failures
- System errors and exceptions
- Important business logic milestones

---

## Development Workflow

### Running the Application
Either run the application from the debugger with proper launch.json

or run from cmd by first setting proper environment variables.

// Dev
```cmd
env17.bat
npm run dev
```

// Prod
```bash
npm run build
npm start
```

### Environment Setup
1. Copy environment template to `.env.local`
2. Configure required variables:
   - Database connection strings
   - Azure service credentials
   - NextAuth configuration
   - Development user settings (if using AUTH_MODE=none)

### Database Operations
- Use provided utility functions in `/db/` directory
- Always use `prepDocument()` to prepare documents before insertion
- Follow the established patterns for queries and updates

---

## Additional Resources

- Next.js Documentation: https://nextjs.org/docs
- Material-UI: https://mui.com/
- NextAuth: https://next-auth.js.org/
- MongoDB Node Driver: https://www.mongodb.com/docs/drivers/node/

---

*This is a living document. Update it as the project evolves and new patterns emerge.*
