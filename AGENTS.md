<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep TanStack Start as the application bootstrap; mount the imported standalone studio at `/` and `/$generation` to preserve project URLs without a second router.
- Lazy-load imported studio screens behind ClientOnly because their browser storage, recording, and media tools are browser-dependent.
- Preserve imported studio controls, assets and local-first storage during the source migration; do not bundle the repository's Python services or Node/Vite plugins, which require a separately hosted compatible service.
- Newsroom uses TanStack HTTP routes and server functions, with a shared HTTPS publisher allowlist, redirect checks and streamed response limits; arbitrary hosts stay denied until pinned-address egress is available, preventing DNS-rebinding exposure.
- Fact extraction and section writing reject invalid AI results and preserve successful sections for retries; never substitute fabricated filler to satisfy duration targets.
- Script generation uses the built-in AI gateway (server-side) unless a deployment OLLAMA_URL is configured; the route keeps Ollama's { response } shape so client code stays unchanged.
