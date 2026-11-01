# AWS static media preparation

Status: **prepared, not applied or migrated**. Checkboxes owns this stack,
manifest and tooling; it has no shared bucket or runtime dependency on another
repository. No AWS resources, IAM grants, credentials, DNS, certificate, public
URLs, tracked images or production deployments have changed.

## Scope

At main `74f060d6eb1c4c380d7319fe33e67d86bc8dabb2`, three existing public media
files account for 55,734 bytes:

| Path | Bytes | Intended content type |
| --- | ---: | --- |
| `/favicon.ico` | 4,286 | `image/x-icon` |
| `/favicon.svg` | 826 | `image/svg+xml` |
| `/og-image.jpg` | 50,622 | `image/jpeg` |

The manifest generator confirms actual media references in built HTML and pins
source bytes, full SHA-256, immutable key and content type. Build checks refuse
missing references, changed bytes and unclassified new public image files. A
new file requires deliberate publication review; it is never uploaded merely
because it appears under `public/`.

The 11 SVGs under `src/assets/logos/` total 37,676 bytes. They remain versioned
authoring inputs because the Astro components import their `ImageMetadata`.
Their generated build output belongs to the product/measurement compiler
contract. Framework demos, vendored Datastar, fonts, generated JS/CSS,
measurement payloads and release/update artifacts remain with their current
owners. Do not move these as ordinary image uploads or alter benchmark results.

## Stack and immutable object contract

`config/aws/static-assets/template.json` defines the independently owned
`checkboxes-static-assets` stack in `us-east-1`. It contains encrypted, versioned
S3 with all public-access blocks enabled and ACLs disabled, a CloudFront
regional S3 origin with OAC signing, and permission for only that distribution
to read `sha256/*`. TLS is required. The bucket and its policy retain on
replacement/deletion; the supplied stack policy also protects them during
updates. There are no IAM roles, public bucket ACLs, lifecycle deletion rules,
custom domains, DNS, certificates or shared-infrastructure imports.

Each immutable key is `sha256/<full SHA-256>/<public filename>`. Uploads require
`If-None-Match: *`, the measured image type, and
`Cache-Control: public, max-age=31536000, immutable`. Existing mismatched objects
stop the uploader. No object is overwritten or deleted by these tools.

`verify` performs real GETs through the stack's HTTPS CloudFront URL and checks
every byte, length, SHA-256 and content/cache header. ETags alone are not proof.
The uploader checks all local bytes before its first write, resumes matching
objects, retries transient failures within a bound and waits through the brief
CloudFront negative cache after a new PUT. Authorization failures stop the run.
Signed URL maps must name the exact reviewed bucket and manifest keys; they
stay outside Git and never enter logs. Node uses the inherited session proxy
and CA trust.

## Review locally

```bash
npm run build
npm run assets -- inventory
npm run assets -- check
npm run test:assets
npm run gate
```

`build` checks the committed manifest after the existing product and measurement
builds finish. `inventory` deliberately updates it from a reviewed built site.
The existing `npm test` includes the new Vitest suite, and `check:ts` includes a
strict TypeScript project for the new tools. No new dependency or scripting
runtime was added: commands use the repository's existing Node, tsx and Vitest.
Tests use fake/offline transports and temporary fixtures; they do not contact AWS.
The CloudFormation template passed native AWS `ValidateTemplate` on November 1,
2026; this is not an apply or runtime-access check.

## Human-owned apply and upload

John owns infrastructure apply and upload authority. Review the template,
stack policy, manifest and costs before using his approved AWS access. These
are handoff commands; agents must not install credentials or switch identities
to obtain write access.

```bash
aws cloudformation create-stack --region us-east-1 \
  --stack-name checkboxes-static-assets \
  --template-body file://config/aws/static-assets/template.json \
  --stack-policy-body file://config/aws/static-assets/stack-policy.json
aws cloudformation wait stack-create-complete --region us-east-1 \
  --stack-name checkboxes-static-assets
aws cloudformation describe-stacks --region us-east-1 \
  --stack-name checkboxes-static-assets --query 'Stacks[0].Outputs'
```

Retain the exact `BucketName`, `DeliveryOrigin` and `DistributionId` outputs.
Wait until CloudFront finishes deployment. Review the conditional upload plan:

```bash
npm run assets -- plan BUCKET_NAME
```

That command prints one AWS CLI PUT per manifest object and executes none.
John can run the reviewed commands with his approved existing write access.
An existing-key precondition failure requires verification, never overwrite or
`sync --delete`. Alternatively, an approved operator can supply an external
JSON map of immutable keys to short-lived regional S3 PUT URLs signed for the
exact bucket, image type, cache header and `If-None-Match: *`.

```bash
npm run assets -- upload DELIVERY_ORIGIN BUCKET_NAME /absolute/private/put-urls.json
npm run assets -- verify DELIVERY_ORIGIN /absolute/external/checkboxes-media-proof.json
```

The optional external, create-only receipt pins the exact manifest file hash,
origin, verified object count and time. A changed manifest during verification
refuses the receipt. Retain proof and an independent original-source snapshot.
There is currently no applied bucket or authorized upload path to this proposed
stack. No upload has been attempted, and verification is still pending.

## Cutover remains separate

The intended follow-up materializes verified immutable AWS bytes into local
and same-origin build output before the existing build runs. AWS then becomes
the durable source while Vercel continues serving `/favicon.ico`, `/favicon.svg`
and `/og-image.jpg`. This preserves OG URLs, browser metadata, same-origin
behavior and the product/measurement split without introducing browser CORS,
runtime redirects, a new domain or changes to retained generated assets.

Before removing tracked copies, implement and prove a repository-owned hydration
step in a fresh checkout using only the committed manifest and authorized AWS
objects. Verify all three objects and usable URLs; retain a recovery snapshot;
confirm direct unauthenticated S3 access is denied; test missing/corrupt objects
and atomic materialization; run the full gate and independent review. Only then
remove the exact verified public files in a reviewable follow-up commit with
exact-path ignores. Keep imported SVG authoring sources and old release keys.
No temporary cache or another checkout may become the source of truth.

Current rollback is the untouched tracked media and serving behavior. After
cutover, restore the previous manifest and rehydrate retained keys or restore the
independent snapshot. Versioning is extra recovery protection, not permission
to expire previous objects. No history rewrite, destructive sync or production
cutover is part of this draft.

## Cost before apply

The initial payload is only 55.7 KB and three objects. At an illustrative
$0.03/GB-month storage rate, one retained copy would be around $0.000002/month;
use actual current regional rates before apply. PUTs, GETs, CloudFront requests,
transfer and retained versions are separately metered. One verification reads
all three objects; an uncached hydrated build would fetch 55.7 KB. Existing
Vercel delivery costs remain. This stack uses PriceClass_100 and does not create
a flat-rate subscription, logging bucket or image-processing service. Account
free allowances may already be consumed; do not promise zero cost. Check
[S3 pricing](https://aws.amazon.com/s3/pricing/) and
[CloudFront pricing](https://aws.amazon.com/cloudfront/pricing/) with expected
build/traffic volume before applying.
