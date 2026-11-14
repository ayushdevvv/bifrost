# Research Intelligence

The Research Intelligence workspace is the Tavily-facing web research surface.

## Modes

- **Demo** returns synthetic `.invalid` fixtures, does not call Tavily and labels every source as synthetic.
- **Live** calls `POST https://api.tavily.com/search` from FastAPI using the server-side `TAVILY_API_KEY` bearer credential.

## Evidence snapshots

Every search is persisted in `research_snapshots` with its query, mode, provider, response, creation time and SHA-256 evidence hash. Snapshot list and detail endpoints are available to the frontend. The hash detects changes to the stored source payload; it is not a publisher signature or a proof that a source is trustworthy.

## API

- `POST /api/research/search`
- `GET /api/research/snapshots`
- `GET /api/research/snapshots/{snapshot_id}`

Example request:

```json
{
  "query": "Compare current AI agent observability platforms",
  "mode": "live",
  "search_depth": "advanced",
  "max_results": 6
}
```

Relevance scores come from Tavily. They are not factuality or credibility guarantees. Source claims still need independent evaluation.
