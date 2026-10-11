# Nepal in the Path

Static website companion to *Managing the crisis is not the same as solving it: Nepal's floods and the limits of solutions*.

Serve this directory with an HTTP server that supports range requests, because the interactive map reads PMTiles archives:

```bash
npx http-server -p 8899 -c-1
```

Open `http://localhost:8899/` for the story or `http://localhost:8899/map.html` for the map explorer.

This is a screening dataset, not an official hazard map.
