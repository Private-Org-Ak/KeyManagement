import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { createHome, localStack, login, nav, uniqueEmail } from './support/supabase'
import { seedViaApi } from './support/seed'

test.skip(!localStack(), 'needs local Supabase (npx supabase start)')
test.setTimeout(300_000)

type Style =
  | 'brass'
  | 'engraved-dark'
  | 'tilted-noisy'
  | 'upside-down'
  // Harder, closer to a phone photo of a real stamped key: no ink, small digits, glare, blur.
  | 'stamped'
  | 'stamped-small-glare'
  | 'nickel-grooves'
interface Sample {
  number: string
  style: Style
}

const NUMBERS = [
  '4417',
  'KF-1021',
  'B-208',
  '7781',
  'A112',
  '3365',
  '90512',
  'K-77',
  '2209',
  '6618',
  'DL-410',
  '1054',
]
const STYLES: Style[] = ['brass', 'engraved-dark', 'tilted-noisy', 'upside-down']
const SYNTHETIC: Sample[] = NUMBERS.map((number, i) => ({
  number,
  style: STYLES[i % STYLES.length] ?? 'brass',
}))
const HARD_STYLES: Style[] = ['stamped', 'stamped-small-glare', 'nickel-grooves']
const HARD: Sample[] = NUMBERS.map((number, i) => ({
  number,
  style: HARD_STYLES[i % HARD_STYLES.length] ?? 'stamped',
}))

/** Renders a key-like image of `number` in the page (real browser canvas text rendering). */
async function render(page: Page, s: Sample): Promise<Buffer> {
  const b64 = await page.evaluate(({ number, style }) => {
    const c = document.createElement('canvas')
    c.width = 900
    c.height = 300
    const ctx = c.getContext('2d')
    if (!ctx) throw new Error('no 2d')
    if (style === 'stamped' || style === 'stamped-small-glare' || style === 'nickel-grooves') {
      const nickel = style === 'nickel-grooves'
      const hg = ctx.createLinearGradient(0, 0, 900, 300)
      hg.addColorStop(0, nickel ? '#9a9da2' : '#a8904c')
      hg.addColorStop(0.6, nickel ? '#c4c7cc' : '#c9ad62')
      hg.addColorStop(1, nickel ? '#8d9095' : '#9c8443')
      ctx.fillStyle = hg
      ctx.fillRect(0, 0, 900, 300)
      for (let i = 0; i < 300; i++) {
        ctx.fillStyle = `rgba(0,0,0,${(Math.sin(i * 7.3) * 0.5 + 0.5) * 0.07})`
        ctx.fillRect(0, i, 900, 1)
      }
      const size = style === 'stamped-small-glare' ? 46 : 64
      ctx.font = `bold ${String(size)}px "Arial Narrow", Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.filter = 'blur(1.2px)'
      // Punched into the metal: a soft shadow edge, a highlight edge, slightly darker floor.
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      ctx.fillText(number, 452, 152)
      ctx.fillStyle = 'rgba(255,255,255,0.32)'
      ctx.fillText(number, 449, 149)
      ctx.fillStyle = nickel ? 'rgba(40,40,45,0.35)' : 'rgba(60,45,10,0.22)'
      ctx.fillText(number, 450, 150)
      ctx.filter = 'none'
      if (style === 'stamped-small-glare') {
        const glare = ctx.createLinearGradient(380, 0, 560, 0)
        glare.addColorStop(0, 'rgba(255,255,255,0)')
        glare.addColorStop(0.5, 'rgba(255,255,250,0.55)')
        glare.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = glare
        ctx.fillRect(0, 0, 900, 300)
      }
      const img = ctx.getImageData(0, 0, 900, 300)
      let seed = 11
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 16807) % 2147483647
        const n = (seed / 2147483647 - 0.5) * 36
        img.data[i] = Math.max(0, Math.min(255, (img.data[i] ?? 0) + n))
        img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] ?? 0) + n))
        img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] ?? 0) + n))
      }
      ctx.putImageData(img, 0, 0)
      return c.toDataURL('image/jpeg', 0.7).split(',')[1] ?? ''
    }
    const g = ctx.createLinearGradient(0, 0, 900, 300)
    const dark = style === 'engraved-dark'
    g.addColorStop(0, dark ? '#3a3a3a' : '#d8c27a')
    g.addColorStop(0.5, dark ? '#5a5a5a' : '#b89a4e')
    g.addColorStop(1, dark ? '#2c2c2c' : '#e2cf8f')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 900, 300)
    // brushed-metal streaks
    for (let i = 0; i < 300; i++) {
      ctx.fillStyle = `rgba(255,255,255,${(Math.sin(i * 12.9898) * 0.5 + 0.5) * 0.06})`
      ctx.fillRect(0, i, 900, 1)
    }
    ctx.save()
    ctx.translate(450, 150)
    if (style === 'tilted-noisy') ctx.rotate((4 * Math.PI) / 180)
    if (style === 'upside-down') ctx.rotate(Math.PI)
    ctx.font = 'bold 120px "Courier New", Courier, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    if (style === 'tilted-noisy') ctx.filter = 'blur(1px)'
    // stamped look: dark core with a light offset edge
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.5)'
    ctx.fillText(number, 2, 2)
    ctx.fillStyle = dark ? '#e8e8e8' : '#2a2414'
    ctx.fillText(number, 0, 0)
    ctx.restore()
    if (style === 'tilted-noisy') {
      const img = ctx.getImageData(0, 0, 900, 300)
      let seed = 7
      for (let i = 0; i < img.data.length; i += 4) {
        seed = (seed * 16807) % 2147483647
        const n = (seed / 2147483647 - 0.5) * 50
        img.data[i] = Math.max(0, Math.min(255, (img.data[i] ?? 0) + n))
        img.data[i + 1] = Math.max(0, Math.min(255, (img.data[i + 1] ?? 0) + n))
        img.data[i + 2] = Math.max(0, Math.min(255, (img.data[i + 2] ?? 0) + n))
      }
      ctx.putImageData(img, 0, 0)
    }
    return c.toDataURL('image/png').split(',')[1] ?? ''
  }, s)
  return Buffer.from(b64, 'base64')
}

function realFixtures(): { number: string; file: string }[] {
  const dir = join(process.cwd(), 'tests/fixtures/keys')
  try {
    return readdirSync(dir)
      .filter((f) => /\.(jpe?g|png)$/i.test(f) && f.includes('__'))
      .map((f) => ({ number: f.split('__')[0] ?? '', file: join(dir, f) }))
  } catch {
    return []
  }
}

/** Runs one image through Scan → Number → "Use a photo instead"; true if the right door is shown. */
async function scanImage(
  page: Page,
  door: string,
  buffer: Buffer,
  name: string,
): Promise<{ hit: boolean; read: string; seconds: number }> {
  await page
    .getByTestId('ocr-file')
    .setInputFiles({ name, mimeType: name.endsWith('.png') ? 'image/png' : 'image/jpeg', buffer })
  await expect(page.getByTestId('ocr-read')).toBeVisible({ timeout: 60_000 })
  const read = (await page.getByTestId('ocr-read').textContent()) ?? ''
  const hit = (await page.getByRole('article', { name: `Door: ${door}` }).count()) > 0
  const secs = Number(
    /Read in ([\d.]+) s/.exec((await page.getByText(/Read in/).textContent()) ?? '')?.[1] ?? 'NaN',
  )
  await page.getByRole('button', { name: 'Scan again' }).click()
  return { hit, read, seconds: secs }
}

test('OCR hit rate on synthetic key images (+ real photos in tests/fixtures/keys)', async ({
  page,
}) => {
  const real = realFixtures()
  await login(page, uniqueEmail('ocr'))
  const hid = await createHome(page, 'OCR Home', 'O')
  const doorFor = (n: string) => `Door ${n}`
  await seedViaApi(
    page,
    hid,
    [...new Set([...NUMBERS, ...real.map((r) => r.number)])].map((n) => ({
      door: doorFor(n),
      number: n,
    })),
  )
  await page.reload()
  await nav(page, 'Scan').click()

  const rows: { sample: string; read: string; hit: boolean; seconds: number }[] = []
  for (const s of SYNTHETIC) {
    const r = await scanImage(page, doorFor(s.number), await render(page, s), `${s.number}.png`)
    rows.push({ sample: `${s.number} (${s.style})`, ...r })
  }
  const hardRows: typeof rows = []
  for (const s of HARD) {
    const img = await render(page, s)
    // OCR_DUMP=<dir> saves the generated images for eyeballing.
    if (process.env.OCR_DUMP) writeFileSync(join(process.env.OCR_DUMP, `${s.number}.jpg`), img)
    const r = await scanImage(page, doorFor(s.number), img, `${s.number}.jpg`)
    hardRows.push({ sample: `${s.number} (${s.style})`, ...r })
  }
  const realRows: typeof rows = []
  for (const f of real) {
    const r = await scanImage(page, doorFor(f.number), readFileSync(f.file), f.file)
    realRows.push({ sample: f.file.split('/').pop() ?? f.file, ...r })
  }

  const rate = (rs: typeof rows) => (rs.length ? rs.filter((r) => r.hit).length / rs.length : NaN)
  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? NaN
  const report = [
    ...rows.map(
      (r) =>
        `${r.hit ? '✓' : '✗'} ${r.sample.padEnd(26)} read=${r.read.padEnd(10)} ${r.seconds.toFixed(1)}s`,
    ),
    `synthetic hit rate: ${(rate(rows) * 100).toFixed(0)}% (${rows.filter((r) => r.hit).length}/${rows.length}), median ${median(rows.map((r) => r.seconds)).toFixed(1)}s`,
    ...hardRows.map(
      (r) =>
        `${r.hit ? '✓' : '✗'} ${r.sample.padEnd(30)} read=${r.read.padEnd(10)} ${r.seconds.toFixed(1)}s`,
    ),
    `hard (stamped) hit rate: ${(rate(hardRows) * 100).toFixed(0)}% (${hardRows.filter((r) => r.hit).length}/${hardRows.length}), median ${median(hardRows.map((r) => r.seconds)).toFixed(1)}s`,
    ...realRows.map((r) => `${r.hit ? '✓' : '✗'} ${r.sample} read=${r.read}`),
    real.length
      ? `REAL photo hit rate: ${(rate(realRows) * 100).toFixed(0)}% (${realRows.filter((r) => r.hit).length}/${realRows.length})`
      : 'no real photos in tests/fixtures/keys',
  ].join('\n')
  console.log(report)
  test.info().annotations.push({ type: 'ocr-report', description: report })

  expect(rate(rows)).toBeGreaterThanOrEqual(0.7)
  // Guards the stamped-key preprocessing (text locating + lighting flattening): 33% before it.
  expect(rate(hardRows)).toBeGreaterThanOrEqual(0.7)
  if (real.length) expect(rate(realRows)).toBeGreaterThanOrEqual(0.7)
})
