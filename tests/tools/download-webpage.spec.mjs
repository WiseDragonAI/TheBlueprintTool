import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { createServer } from 'node:http'
import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const cli = resolve('bin/download-webpage.mjs')

function listen(server) {
  return new Promise((resolveListen) => {
    server.listen(0, '127.0.0.1', () => resolveListen(server.address()))
  })
}

test('download-webpage writes the complete HTML body to an owned temporary document', async () => {
  const body = '<!doctype html><html><body>verbatim source</body></html>'
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', connection: 'close' })
    response.end(body)
  })
  let directory = ''
  try {
    const address = await listen(server)
    const requestedUrl = `http://127.0.0.1:${address.port}/research`
    const { stdout } = await execFileAsync(process.execPath, [cli, requestedUrl], { encoding: 'utf8' })
    const result = JSON.parse(stdout)
    directory = resolve(result.document, '..')

    assert.equal(result.version, 1)
    assert.equal(result.requestedUrl, requestedUrl)
    assert.equal(result.finalUrl, requestedUrl)
    assert.equal(result.contentType, 'text/html; charset=utf-8')
    assert.equal(result.bytes, Buffer.byteLength(body))
    assert.equal(readFileSync(result.document, 'utf8'), body)
    assert.ok(result.document.startsWith(`${tmpdir()}${sep}decision-os-webpage-`))
    assert.match(result.retrievedAt, /^\d{4}-\d{2}-\d{2}T/)
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose))
    // WHAT: remove only the temporary directory returned by this test invocation
    // WHY: completed tests must not retain generated source artifacts
    if (directory) rmSync(directory, { recursive: true, force: true })
  }
})

test('download-webpage rejects non-web protocols', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [cli, 'file:///tmp/source.html'], { encoding: 'utf8' }),
    /Unsupported URL protocol: file:/,
  )
})

test('download-webpage rejects non-HTML responses', async () => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'application/octet-stream', connection: 'close' })
    response.end('binary')
  })
  try {
    const address = await listen(server)
    await assert.rejects(
      execFileAsync(process.execPath, [cli, `http://127.0.0.1:${address.port}/binary`], { encoding: 'utf8' }),
      /Unsupported webpage content type: application\/octet-stream/,
    )
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose))
  }
})
