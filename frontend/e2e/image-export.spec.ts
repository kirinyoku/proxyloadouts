import { readFile, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { build, owner, summary } from './fixtures/image-export'
test.beforeEach(async ({ page }) => {
  const assets: Record<string, string> = {
    'IconRoleCircle46.webp': 'alice.webp', 'Weapon_S_1401.png': 'weapon.png',
    'SuitFangedMetal.png': 'fanged-metal.png', 'SuitSavior.png': 'phaethon.png',
    'ItemRarityS.png': 'rarity.png', 'IconAnomaly.png': 'specialty.png',
  }
  await page.route(/^https:\/\/(?:static\.nanoka\.cc|enka\.network)\//, async (route) => {
    const filename = new URL(route.request().url()).pathname.split('/').pop() ?? ''
    const asset = assets[filename]
    if (!asset) return route.abort()
    await route.fulfill({
      path: `e2e/fixtures/export-artwork/${asset}`,
      contentType: asset.endsWith('.webp') ? 'image/webp' : 'image/png',
      headers: { 'Access-Control-Allow-Origin': '*' },
    })
  })
  await page.route('**/api/v1/**', (route) => {
    const url = new URL(route.request().url())
    if (route.request().method() !== 'GET') throw new Error(`Unexpected mutation: ${url.pathname}`)
    if (url.pathname.includes('/public/builds/') || url.pathname.includes('/shared/builds/')) return route.fulfill({ json: { build, owner } })
    if (url.pathname.includes('/public/teams/') || url.pathname.includes('/shared/teams/')) return route.fulfill({ json: { ...summary, owner } })
    if (url.pathname.endsWith('/auth/me')) return route.fulfill({ json: {
      user: { id: 'user-png', username: 'Proxy', discord_id: '123', avatar_url: null, created_at: build.created_at },
      accounts: [{ id: 'account-png', uid: owner.uid, region: 'Europe', created_at: build.created_at }],
    } })
    if (url.pathname.endsWith('/builds')) return route.fulfill({ json: [build] })
    if (url.pathname.endsWith('/teams')) return route.fulfill({ json: [summary] })
    if (url.pathname.endsWith('/share')) return route.fulfill({ json: { active: false } })
    return route.fulfill({ json: [] })
  })
})

for (const { path, label } of [
  { path: '/roster', label: 'Поделиться сборкой' },
  { path: '/shared/build/token-png', label: 'Поделиться сборкой' },
  { path: '/teams', label: 'Поделиться отрядом' },
  { path: '/shared/team/token-png', label: 'Поделиться отрядом' },
]) {
  test(`${path}: downloads a real PNG without changing visibility or creating a link`, async ({ page }, testInfo) => {
    await page.goto(path)
    await page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).click()
    const downloading = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: 'Скачать PNG', exact: true }).click()
    const download = await downloading
    expect(download.suggestedFilename()).toMatch(/^ProxyLoadouts-.+\.png$/)
    const file = testInfo.outputPath('export.png')
    await download.saveAs(file)
    const png = await readFile(file)
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(png.readUInt32BE(16)).toBe(2400)
    expect(png.readUInt32BE(20)).toBeGreaterThan(path.includes('team') ? 2500 : 900)
    await expect(page.getByText('PNG сохранён', { exact: true })).toBeVisible()
    await testInfo.attach('Exported PNG', { path: file, contentType: 'image/png' })
  })
}

test('copies a decodable PNG into the real browser clipboard on mobile', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/b/build-png')
  await page.getByRole('button', { name: 'Поделиться сборкой', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Скопировать изображение', exact: true }).click()
  await expect(page.getByText('Изображение скопировано', { exact: true })).toBeVisible()
  const dimensions = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read()
    const blob = await item.getType('image/png')
    const image = await createImageBitmap(blob)
    const result = { width: image.width, height: image.height }
    image.close()
    return result
  })
  expect(dimensions.width).toBe(2400)
  expect(dimensions.height).toBeGreaterThan(900)
})

test('keeps download available when the browser cannot copy images', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'ClipboardItem', { value: undefined }) })
  await page.goto('/b/build-png')
  await page.getByRole('button', { name: 'Поделиться сборкой', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Скопировать изображение', exact: true })).toBeDisabled()
  await expect(page.getByRole('menuitem', { name: 'Скачать PNG', exact: true })).toBeEnabled()
})

test('reports missing artwork instead of silently exporting blank icons', async ({ page }) => {
  await page.route('https://static.nanoka.cc/**', (route) => route.request().resourceType() === 'fetch' ? route.abort() : route.fallback())
  const downloads: string[] = []
  page.on('download', (download) => downloads.push(download.suggestedFilename()))
  await page.goto('/b/build-png')
  await page.getByRole('button', { name: 'Поделиться сборкой', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Скачать PNG', exact: true }).click()
  await expect(page.getByText('Не удалось загрузить изображения для PNG. Обновите страницу и попробуйте ещё раз.', { exact: true })).toBeVisible()
  expect(downloads).toEqual([])
  await expect(page.locator('iframe')).toHaveCount(0)
})

test('explains denied clipboard access and allows a subsequent download', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'write', { value: () => Promise.reject(new DOMException('Denied', 'NotAllowedError')) })
  })
  await page.goto('/b/build-png')
  await page.getByRole('button', { name: 'Поделиться сборкой', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Скопировать изображение', exact: true }).click()
  await expect(page.getByText('Не удалось скопировать изображение. Попробуйте скачать PNG.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Поделиться сборкой', exact: true }).click()
  await expect(page.getByRole('menuitem', { name: 'Скачать PNG', exact: true })).toBeEnabled()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Скачать PNG', exact: true }).click()
  expect((await downloading).suggestedFilename()).toMatch(/\.png$/)
})

test('PNG matches the on-screen inspector with FAE, artwork and roll totals', async ({ page }, testInfo) => {
  await page.addInitScript(() => localStorage.setItem('pl-lang', 'en'))
  await page.route('**/api/v1/teams?game_account_id=*', (route) => route.fulfill({ json: [{
    ...summary, members: summary.members.map((member) => ({ ...member, build: { ...member.build, name: build.name } })),
  }] }))
  await page.setViewportSize({ width: 1280, height: 1200 })
  await page.goto('/teams')
  await page.getByTitle('Alice — «30 + 6»', { exact: true }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.addStyleTag({ content: `
    [role="dialog"] { width: 1200px !important; max-width: none !important; max-height: none !important; overflow: visible !important; }
    [data-build-controls] { display: none !important; }
  ` })
  await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll('[role="dialog"] img')].map((image) => image instanceof HTMLImageElement ? image.decode() : Promise.resolve()))
    await document.fonts.ready
  })
  const card = page.locator('[role="dialog"] [data-build-equipment]')
  await expect(card.locator('[data-slot="dialog-header"]').getByText('Lv. 60', { exact: true })).toBeVisible()
  await expect(card.getByTestId('fae-badge-snapshot').filter({ visible: true })).toBeVisible()
  await expect(card.getByText('54.0%', { exact: true })).toBeVisible()
  const reference = await card.screenshot({ scale: 'css', animations: 'disabled' })
  await page.goto('/b/build-png')
  await page.getByRole('button', { name: 'Share build', exact: true }).click()
  const downloading = page.waitForEvent('download')
  await page.getByRole('menuitem', { name: 'Download PNG', exact: true }).click()
  const file = testInfo.outputPath('matching-export.png')
  await (await downloading).saveAs(file)
  const png = await readFile(file)
  const comparison = await page.evaluate(async ({ reference, exported }) => {
    const decode = async (base64: string) => createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
    const [expected, actual] = await Promise.all([decode(reference), decode(exported)])
    const canvas = document.createElement('canvas')
    canvas.width = expected.width
    canvas.height = expected.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(expected, 0, 0)
    const expectedPixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    // The image adds a 1px border + 20px card padding, at 2x.
    ctx.drawImage(actual, 42, 42, expected.width * 2, expected.height * 2, 0, 0, expected.width, expected.height)
    const actualPixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    // Sample the empty gap 2px and 10px beyond the 52px portrait's right edge.
    const portraitHaloDifference = Math.max(...[20, 28].flatMap((y) => [0, 1, 2].map((channel) =>
      Math.abs(actualPixels[(y * canvas.width + 54) * 4 + channel] - actualPixels[(y * canvas.width + 62) * 4 + channel]),
    )))
    let differentPixels = 0
    for (let pixel = 0; pixel < expectedPixels.length; pixel += 4) {
      if ([0, 1, 2].some((channel) => Math.abs(expectedPixels[pixel + channel] - actualPixels[pixel + channel]) > 32)) differentPixels++
    }
    const fullCanvas = document.createElement('canvas')
    fullCanvas.width = actual.width
    fullCanvas.height = actual.height
    const fullCtx = fullCanvas.getContext('2d')
    if (!fullCtx) throw new Error('Full canvas unavailable')
    fullCtx.drawImage(actual, 0, 0)
    const fullPixels = fullCtx.getImageData(0, 0, actual.width, actual.height).data
    const cornerPixels = [
      [0, 0],
      [actual.width - 1, 0],
      [0, actual.height - 1],
      [actual.width - 1, actual.height - 1],
    ].map(([x, y]) => {
      const offset = (y * actual.width + x) * 4
      return {
        r: fullPixels[offset],
        g: fullPixels[offset + 1],
        b: fullPixels[offset + 2],
        a: fullPixels[offset + 3],
      }
    })
    const interiorPixelOffset = (42 * actual.width + 42) * 4
    const interiorAlpha = fullPixels[interiorPixelOffset + 3]
    const cardBg = [
      fullPixels[interiorPixelOffset],
      fullPixels[interiorPixelOffset + 1],
      fullPixels[interiorPixelOffset + 2],
    ]
    let bottomLeftFooterForegroundPixels = 0
    for (let y = actual.height - 84; y < actual.height - 42; y++) {
      for (let x = 42; x < 360; x++) {
        const offset = (y * actual.width + x) * 4
        if (
          fullPixels[offset + 3] === 255 &&
          [0, 1, 2].some((channel) => Math.abs(fullPixels[offset + channel] - cardBg[channel]) > 35)
        ) {
          bottomLeftFooterForegroundPixels++
        }
      }
    }
    expected.close()
    actual.close()
    return {
      difference: differentPixels / (canvas.width * canvas.height),
      portraitHaloDifference,
      cornerPixels,
      interiorAlpha,
      bottomLeftFooterForegroundPixels,
      crop: canvas.toDataURL('image/png'),
    }
  }, { reference: reference.toString('base64'), exported: png.toString('base64') })
  await writeFile(testInfo.outputPath('reference.png'), reference)
  await writeFile(testInfo.outputPath('exported-card.png'), Buffer.from(comparison.crop.split(',')[1], 'base64'))
  await testInfo.attach('PNG versus inspector', { body: JSON.stringify({ difference: comparison.difference }), contentType: 'application/json' })
  for (const corner of comparison.cornerPixels) {
    expect(corner.a, 'All four corners of the exported PNG must be opaque').toBe(255)
    expect(Math.max(corner.r, corner.g, corner.b), 'All four corners must be dark without white artifacts').toBeLessThan(80)
  }
  expect(comparison.interiorAlpha, 'Card interior surface must be opaque').toBe(255)
  expect(comparison.bottomLeftFooterForegroundPixels, 'Bottom-left card footer must render proxyloadouts.com').toBeGreaterThan(20)
  expect(comparison.portraitHaloDifference, 'The empty gap beside the portrait must not contain a colored halo').toBeLessThanOrEqual(3)
  expect(comparison.difference).toBeLessThan(.03)
})

test.describe('Safari user-agent export', () => {
  test.use({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  })

  test('downloads a 2400px PNG under Safari UA without the quadratic redraw stall', async ({ page }, testInfo) => {
    await page.goto('/b/build-png')
    await page.getByRole('button', { name: 'Поделиться сборкой', exact: true }).click()
    const downloading = page.waitForEvent('download')
    const startedAt = Date.now()
    await page.getByRole('menuitem', { name: 'Скачать PNG', exact: true }).click()
    const download = await downloading
    expect(Date.now() - startedAt).toBeLessThan(3_000)
    const file = testInfo.outputPath('safari-ua-export.png')
    await download.saveAs(file)
    const png = await readFile(file)
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    expect(png.readUInt32BE(16)).toBe(2400)
    await expect(page.getByText('PNG сохранён', { exact: true })).toBeVisible()
  })
})
