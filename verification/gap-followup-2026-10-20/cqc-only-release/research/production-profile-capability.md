# Read-only production-profile capability check

Checked installed Wrangler 4.151.1 help, package exports and declarations/source; no capture, Worker request, authentication check, install, credential-file read, credential change or infrastructure change was performed. The established private XDG configuration was named only for Wrangler help. `WRANGLER_SEND_METRICS=false` was set.

The retained official guide, updated 10 October 2026, documents:

- `cf workers versions profile EXACT_VERSION --worker-id WORKER --duration-ms 5000 --profile-type cpu` (binary pprof stdout).
- `POST /client/v4/accounts/{account}/workers/workers/{worker}/versions/{EXACT_VERSION}/profile` with `{"duration_ms":5000,"profile_type":"cpu"}` (gzip pprof), requiring Workers Scripts Read or the Content Read-Only Workers role.
- An already-loaded, recently active exact version and traffic during capture. Capture does not invoke the Worker. `latest` means newest-created, which may not be running.
- Dashboard: Worker → Observability → Flamegraph → CPU → exact active-deployment version → Capture profile. Dashboard authentication was not checked.

Installed capability findings:

1. `cf` is not on PATH. Installed `cf-wrangler` is Wrangler's build/dev bridge, not the Cloudflare CLI profiling command.
2. `wrangler versions --help` exposes view/list/upload/deploy/secret only. No profile command or generic API command appears in top-level help.
3. Wrangler's public package exports do not expose its authenticated raw HTTP client. `experimental_getWranglerCommands` is a command registry for documentation, not a supported authenticated request API.
4. HandlerContext's `fetchResult` is JSON `success/result` only. Its implementation parses API JSON, so it cannot return the profile's raw gzip/binary pprof response. Raw authenticated fetch/client helpers are internal, not public exports; no unsupported bundle alteration or credential extraction was attempted.
5. Presence checks only found no `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_API_KEY` or `CLOUDFLARE_EMAIL` in this execution environment. No values were read or printed and no credential file was opened. This does not question the independently established Wrangler login; it means direct public API authentication is not already exposed through these standard environment inputs.

Conclusion: no supported installed-command/public-export path was identified that can capture the binary production profile using the existing private Wrangler login under the current no-install/no-credential-read/no-auth-change constraints. The documented dashboard is an alternative only if an authenticated dashboard is independently available; that readiness is unverified. Current profiling capability should not be represented as tested or available, and no new action is needed if the staged CPU gate passes.

Source: https://developers.cloudflare.com/workers/observability/profiling-in-production/
Local guide: /tmp/mr-cloudflare-production-profiling-guide.md
Installed package: /workspace/.morning-rows-tools/node_modules/wrangler/package.json
Public declaration: /workspace/.morning-rows-tools/node_modules/wrangler/wrangler-dist/cli.d.ts
