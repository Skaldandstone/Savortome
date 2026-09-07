# Deploying Second Breakfast

The admin portal has its own runbook: [ADMIN_DEPLOY.md](ADMIN_DEPLOY.md).

## Deploying

The public AWS-hosted site responded HTTP 200 on 30 August 2026. The current deployed revision and rollback task definition could not be read because the AWS session expired. Do not infer either from an HTTP response.

The woodland private beta is not deployed. Its current evidence and release gates are recorded in [beta/README.md](beta/README.md). The statements below about earlier Clerk checks are historical; invited/non-invited and expired-session checks must be repeated for this candidate.

**Clerk is mandatory in production.** The single local development account is
refused when `NODE_ENV=production`, deliberately: a shared implicit account on
a public URL would be a security hole, not a convenience. Without Clerk keys
every authenticated endpoint answers `501` and says which variables are
missing. With them, signed-out requests get `401 Sign in to do that.` and
protected pages `307` to `/sign-in?redirect_url=...`. Discovery and `/r/<id>`
stay readable signed out, by design.

**`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` has to be set at build time**, not just
at runtime. `NEXT_PUBLIC_*` values are inlined into the client bundle by
`next build`; setting one only in the running environment ships a client with
no Clerk in it. Verified both ways - the key is absent from the bundle when
unset at build, present when set. Platforms that build and run in one step
(Vercel, Netlify) do the right thing automatically; a split build/run pipeline
needs the variable in both halves.

**Run the migrations against the production database** before first boot:

```bash
DATABASE_URL=<production> pnpm db:migrate
```

**Video imports shell out to `yt-dlp`.** This is the constraint most likely to
bite when choosing a host. The import route runs on the Node runtime and spawns
`yt-dlp` (and, for ASR only, `ffmpeg`), so the binary has to exist on the
machine serving the request. A container or VM host - Fly, Railway, Render, a
plain VPS - can just install it. Function-based platforms generally cannot, and
there a YouTube import will silently degrade to description extraction at
around 0.2 confidence, and Instagram will fail outright. `YT_DLP_PATH` and
`FFMPEG_PATH` exist so you can point at wherever your host puts them.

The private-beta container deliberately omits both media binaries and uses a
nonroot distroless Node runtime after the first reviewed image scan found
critical and high findings in the optional Debian media stack. Article, pasted
text and directly published caption paths remain available. Video paths that
need `yt-dlp` or audio extraction return the existing explicit import guidance.
Do not add the binaries back with an unpinned package-manager install. Restore
them only from reviewed artifacts after their container scan is acceptable.

**Imports are slow by web standards.** The Jacques PÃ©pin video took 52 seconds
end to end - fetch, subtitles, one model call. `maxDuration` on the import
route is 300s, which exceeds the function timeout on several platforms' cheaper
tiers. Worth checking before assuming a video import will survive.

**Kroger's redirect URI must match the deployed origin** exactly, and be
registered in the Kroger developer console. The state cookie is set `secure` in
production, so the callback only works over HTTPS.

**Mobile** points at whatever `EXPO_PUBLIC_API_BASE_URL` says, which is the
deployed web origin - the two apps share one server.

---


## Deploying to AWS

> **Not currently deployable (2026-09-07).** AWS account `051722405355` is the
> sole current target; accounts `734702670689` and `574921529762` are retired
> for new work. The reviewed candidate image is present in the immutable
> `secondbreakfast-web` ECR repository and has a zero-finding BASIC scan. The
> rollback image, source bucket, CodeBuild project, runtime secrets, Cloudflare
> prefix list, database and ECS service are missing. `scripts/deploy-aws.ps1` is repointed at
> `--profile skaldandstone-admin` / `051722405355` and now preflights for the
> missing resources, so it stops with a clear message instead of half-deploying.
> The shared `skaldandstone-production` cluster already exists. Provision the
> source bucket, CodeBuild project and reviewed private runtime before
> using it.

The live app (secondbreakfast.skaldandstone.com) previously ran on ECS in AWS
account `574921529762`, now retired; the intended home is `051722405355`
(`us-east-2`, profile `skaldandstone-admin`).
`scripts/deploy-aws.ps1` ships whatever is on origin/main:
it zips the branch, uploads to the CodeBuild source bucket, builds the
Docker image, and rolls the ECS service. Schema changes additionally need
the one-off `secondbreakfast-migrate` ECS task after the deploy.
