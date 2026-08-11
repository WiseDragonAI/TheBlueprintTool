#!/usr/bin/env node
/**
 * WHAT: Downloads one complete webpage response body into an owned temporary document
 * WHY: Research prompts need a stable verbatim source artifact before parallel analysis
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const maximumDocumentBytes = 20 * 1024 * 1024
const requestDeadlineMs = 30_000
const requestHeaders = {
  accept: 'text/html,application/xhtml+xml;q=0.9',
  'accept-language': 'en-US,en;q=0.9',
  'user-agent': 'DecisionOS-WebpageResearch/1.0',
}

function usage() {
  return 'Usage: download-webpage <url>'
}

function parseUrl(value) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`Invalid URL: ${value}`)
  }
  // WHAT: admit only network webpage protocols
  // WHY: local file and executable schemes escape the bounded download contract
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${url.protocol}`)
  }
  return url
}

async function readBoundedBody(response) {
  const declaredLength = Number(response.headers.get('content-length'))
  // WHAT: reject a declared oversized response before reading its body
  // WHY: research capture must not consume unbounded process memory
  if (Number.isFinite(declaredLength) && declaredLength > maximumDocumentBytes) {
    throw new Error(`Webpage exceeds the ${maximumDocumentBytes} byte limit`)
  }
  // WHAT: reject a missing response stream
  // WHY: a successful capture requires document bytes
  if (!response.body) throw new Error('Webpage response has no body')

  const chunks = []
  let bytes = 0
  const reader = response.body.getReader()
  // WHAT: consume the response stream until its terminal chunk
  // WHY: the temporary document must contain the complete response body
  while (true) {
    const chunk = await reader.read()
    // WHAT: stop after the stream reports complete delivery
    // WHY: no further source bytes exist after the terminal chunk
    if (chunk.done) break
    bytes += chunk.value.byteLength
    // WHAT: abort capture when streamed bytes cross the fixed ceiling
    // WHY: an absent or false content length must not bypass memory bounds
    if (bytes > maximumDocumentBytes) {
      await reader.cancel()
      throw new Error(`Webpage exceeds the ${maximumDocumentBytes} byte limit`)
    }
    chunks.push(Buffer.from(chunk.value))
  }
  return Buffer.concat(chunks, bytes)
}

async function downloadWebpage(url) {
  const response = await fetch(url, {
    headers: requestHeaders,
    redirect: 'follow',
    signal: AbortSignal.timeout(requestDeadlineMs),
  })
  // WHAT: reject unsuccessful HTTP responses before creating an artifact
  // WHY: error pages cannot serve as confirmed source captures
  if (!response.ok) {
    throw new Error(`Request failed with HTTP ${response.status} ${response.statusText}`.trim())
  }
  const contentType = response.headers.get('content-type') ?? ''
  // WHAT: admit only HTML webpage responses
  // WHY: the command owns webpage capture rather than arbitrary binary download
  if (!/^text\/html\b|^application\/xhtml\+xml\b/i.test(contentType)) {
    throw new Error(`Unsupported webpage content type: ${contentType || 'missing'}`)
  }

  const body = await readBoundedBody(response)
  const directory = await mkdtemp(join(tmpdir(), 'decision-os-webpage-'))
  const document = join(directory, 'page.html')
  try {
    await writeFile(document, body, { flag: 'wx' })
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
  return {
    version: 1,
    requestedUrl: String(url),
    finalUrl: response.url,
    retrievedAt: new Date().toISOString(),
    contentType,
    bytes: body.length,
    document,
  }
}

async function main() {
  const args = process.argv.slice(2)
  // WHAT: print the command contract without performing a request
  // WHY: agents need a discoverable non-mutating help path
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage())
    return
  }
  // WHAT: require exactly one source URL
  // WHY: one invocation must own one isolated research document
  if (args.length !== 1) throw new Error(usage())
  const result = await downloadWebpage(parseUrl(args[0]))
  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
