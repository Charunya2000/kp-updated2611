# Prod Support MCP Tool

## What this is

This MCP tool exposes the Prod Support SCTask keyword search as a model-callable tool over JSON-RPC at the following endpoint:

`/api/mcp/prod-support`

The tool name is:

`get_sctasks_by_keyword`

It searches the `dbo.SCTaskDetailHistory` table in the `SM_DW` database and always applies this filter:

`AssignmentGroup = 'KPMC Prod Sup Core'`

It is intended for prompts like:

- Find tickets similar to this defect description.
- Show production defect tasks mentioning delinquency.
- Find SCTasks related to MACL5519, excluding SCTASK12345678.

## How the input should be interpreted

The tool is designed around focused keyword search, not arbitrary SQL generation.

In most cases, user intent should be mapped to the `Description` column.

Examples:

- "Find tickets similar to this issue about delinquency payments failing under load" should become `Description` keywords.
- "Find tasks in deployed status mentioning delinquency" should use one criterion for `State` and one for `Description`.
- "Exclude the current ticket" should add that SCTask number to `scTaskExclusions`.

Search behavior:

- `keywords` within the same criterion are combined with `OR`.
- multiple criteria are combined with `AND`.
- `scTaskExclusions` is applied to `ScTaskIDSource`.
- `limit` is capped at `10`.

## Preferred MCP arguments

```json
{
  "searchCriteria": [
    {
      "column": "Description",
      "keywords": ["delinquency", "payment failure"]
    },
    {
      "column": "State",
      "keywords": ["Deployed"]
    }
  ],
  "scTaskExclusions": ["SCTASK12345678"],
  "limit": 5
}
```

This is interpreted as:

- assignment group must be `KPMC Prod Sup Core`
- description contains `delinquency` or `payment failure`
- state contains `Deployed`
- exclude `SCTASK12345678`
- return up to `5` rows

## Backward-compatible argument shape

The server also accepts the legacy helper shape:

```json
{
  "columnKeywords": [
    {
      "Description": ["delinquency", "payment failure"]
    },
    {
      "State": ["Deployed"]
    }
  ],
  "scTaskExclusions": ["SCTASK12345678"],
  "limit": 5
}
```

## Allowed search columns

- `ScTaskIDSource`
- `State`
- `AssignmentGroup`
- `AssignedToName`
- `OpenedAt`
- `RequestedForName`
- `OpenedByName`
- `Priority`
- `Description`

Use `Description` by default unless the user explicitly asks to search another field.

## MCP usage example

### Initialize

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {}
}
```

### List tools

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list",
  "params": {}
}
```

### Call the tool

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_sctasks_by_keyword",
    "arguments": {
      "searchCriteria": [
        {
          "column": "Description",
          "keywords": ["MACL5519", "delinquency"]
        }
      ],
      "scTaskExclusions": ["SCTASK12345678"],
      "limit": 5
    }
  }
}
```

## How to configure it in the app

Create an MCP server configuration for the assistant with:

- `serverUrl`: the full URL to `/api/mcp/prod-support`
- `allowedTools`: `get_sctasks_by_keyword`
- `requireApproval`: `never` or `always` based on your risk tolerance

If the environment variable `MCP_SHARED_SECRET` is set, the caller must send:

`Authorization: Bearer <MCP_SHARED_SECRET>`

## Returned result

The tool returns:

- `interpretedInput`: how the server normalized the request
- `resultCount`: number of records returned
- `records`: the matching SCTasks

This makes it easier for the model and the operator to verify that the user prompt was translated into the intended search criteria.