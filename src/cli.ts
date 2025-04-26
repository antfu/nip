import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
import c from 'ansis'
import { cac } from 'cac'
import { detect } from 'package-manager-detector'
import { version } from '../package.json'
import { parseSpec } from './parse'

function header(): void {
  p.intro(`${c.yellow`@antfu/nip `}${c.dim`v${version}`}`)
}

const cli = cac('@antfu/nip')

cli
  .command('[...names]', 'Package names to install')
  .option('--catalog [name]', 'Install from a specific catalog, auto detect if not provided')
  .option('--yes', 'Skip prompt confirmation')
  .allowUnknownOptions()
  .action(async (names: string[], options: {
    _: string[]
    dev: boolean
    d: boolean
    workspace: boolean
    w: boolean
    catalog: string | boolean
    yes: boolean
  }) => {
    header()

    const pm = await detect()
    if (pm?.name && pm.name !== 'pnpm') {
      p.log.warn(`nip is designed to be used with pnpm, but used with "${pm.agent}"`)
      p.outro('fallbacking to "@antfu/ni"')
      return await import('@antfu/ni/ni')
    }

    // Plain install, no name or catalog is explicitly disabled
    if (names.length === 0 || options.catalog === false || options.catalog === 'false') {
      p.outro('running full install with "antfu/ni"')
      // Remove catalog option and forward to ni
      process.argv = [
        ...process.argv.slice(0, 2),
        ...serializeArgs({
          ...options,
          catalog: undefined,
        }),
        ...names,
      ]
      return await import('@antfu/ni/ni')
    }

    const { findUp } = await import('find-up')
    const targetPackageJSON = (options.workspace || options.w)
      ? join(process.cwd(), 'package.json')
      : await findUp('package.json', { cwd: process.cwd() })
    if (!targetPackageJSON) {
      p.log.error('no package.json found, aborting')
      p.outro()
      process.exit(1)
    }
    const pkgJson = JSON.parse(await readFile(targetPackageJSON, 'utf-8'))

    let pnpmWorkspaceYamlPath = await findUp('pnpm-workspace.yaml', { cwd: process.cwd() })
    if (!pnpmWorkspaceYamlPath) {
      const root = await findUp(['.git', 'pnpm-lock.yaml'], { cwd: process.cwd() })
        .then(r => r ? dirname(r) : process.cwd())
      p.log.warn(c.yellow('No pnpm-workspace.yaml found'))
      const result = await p.confirm({
        message: `do you want to create it under project root ${c.dim(root)} ?`,
      })
      if (!result) {
        p.log.error('no pnpm-workspace.yaml found, aborting')
        p.outro()
        process.exit(1)
      }
      pnpmWorkspaceYamlPath = join(root, 'pnpm-workspace.yaml')
      await writeFile(pnpmWorkspaceYamlPath, 'packages: []')
    }

    const workspaceYaml = await import('pnpm-workspace-yaml')
      .then(async r => r.parsePnpmWorkspaceYaml(await readFile(pnpmWorkspaceYamlPath, 'utf-8')))
    const workspaceJson = workspaceYaml.toJSON()

    const parsed = names.map(x => x.trim()).filter(Boolean).map(parseSpec)
    let catalog = options.catalog
    if (catalog === true)
      catalog = 'default'

    for (const pkg of parsed) {
      if (catalog != null)
        pkg.catalog ||= catalog

      if (pkg.specifier) {
        pkg.specifierSource ||= 'user'
        continue
      }

      if (!pkg.catalog && !pkg.specifier) {
        const catalogs = workspaceYaml.getPackageCatalogs(pkg.name)
        if (catalogs[0]) {
          pkg.catalog = catalogs[0]
          pkg.specifierSource ||= 'catalog'
        }
      }

      if (pkg.catalog && !pkg.specifier) {
        const spec = pkg.catalog === 'default' ? workspaceJson?.catalog?.[pkg.name] : workspaceJson?.catalogs?.[pkg.catalog]?.[pkg.name]
        if (spec) {
          pkg.specifier = spec
          pkg.specifierSource ||= 'catalog'
        }
      }

      if (!pkg.specifier) {
        const spinner = p.spinner({ indicator: 'dots' })
        spinner.start(`resolving ${c.cyan(pkg.name)} from npm...`)
        const { getLatestVersion } = await import('fast-npm-meta')
        const version = await getLatestVersion(pkg.name)
        if (version.version) {
          pkg.specifier = `^${version.version}`
          pkg.specifierSource ||= 'npm'
          spinner.stop(c.gray`resolved ${c.cyan(pkg.name)}@${c.green(pkg.specifier)}`)
        }
        else {
          spinner.stop(`failed to resolve ${c.cyan(pkg.name)} from npm`)
          p.outro()
          process.exit(1)
        }
      }
    }

    const allCatalogs = Object.keys(workspaceJson?.catalogs || {})
    if (workspaceJson?.catalog)
      allCatalogs.push('default')
    allCatalogs.sort()

    let lastSelectedCatalog: string | null = null
    for (const pkg of parsed) {
      if (pkg.catalog)
        continue

      const result: string | symbol = await p.select({
        message: `select catalog for ${c.cyan(pkg.name)}`,
        options: [
          ...(lastSelectedCatalog
            ? [{
                label: lastSelectedCatalog + c.dim` (last selected)`,
                value: lastSelectedCatalog,
              }]
            : []),
          ...allCatalogs.map(x => ({
            label: x,
            value: x,
          })),
          {
            label: '<new catalog>',
            value: '*',
          },
        ],
      })
      if (!result || typeof result === 'symbol') {
        p.log.error('invalid catalog')
        p.outro()
        process.exit(1)
      }

      if (result === '*') {
        const result = await p.text({
          message: `enter catalog name for ${c.cyan(pkg.name)}`,
        })
        if (!result || typeof result !== 'string') {
          p.outro()
          process.exit(1)
        }
        pkg.catalog = result
        lastSelectedCatalog = result
      }
      else {
        pkg.catalog = result
        lastSelectedCatalog = result
      }
    }

    const contents: string[] = []
    for (const pkg of parsed) {
      const padEnd = Math.max(0, 20 - pkg.name.length - (pkg.specifier?.length || 0))
      const padCatalog = Math.max(0, 20 - (pkg.catalog?.length ? (pkg.catalog.length + ' catalog:'.length) : 0))
      contents.push([
        `${c.cyan(pkg.name)}@${c.green(pkg.specifier)} ${' '.repeat(padEnd)}`,
        pkg.catalog ? c.yellow` catalog:${pkg.catalog}` : '',
        ' '.repeat(padCatalog),
        pkg.specifierSource ? c.gray(` (from ${pkg.specifierSource})`) : '',
      ].join(' '))
    }
    p.note(c.reset(contents.join('\n')), `install packages to ${c.dim(targetPackageJSON)}`)

    if (!options.yes) {
      const result = await p.confirm({
        message: c.green`looks good?`,
      })
      if (!result) {
        p.log.error('aborting')
        p.outro()
        process.exit(1)
      }
    }

    const isDev = options.dev || options.d

    for (const pkg of parsed) {
      if (pkg.catalog)
        workspaceYaml.setPackage(pkg.catalog, pkg.name, pkg.specifier || '^0.0.0')
    }

    const depsName = isDev ? 'devDependencies' : 'dependencies'
    const depNameOppsite = isDev ? 'dependencies' : 'devDependencies'
    const deps = pkgJson[depsName] ||= {}
    for (const pkg of parsed) {
      deps[pkg.name] = pkg.catalog ? (`catalog:${pkg.catalog}`) : pkg.specifier || '^0.0.0'
      if (pkgJson[depNameOppsite]?.[pkg.name])
        delete pkgJson[depNameOppsite][pkg.name]
    }

    p.log.info('writing pnpm-workspace.yaml')
    await writeFile(pnpmWorkspaceYamlPath, workspaceYaml.toString(), 'utf-8')
    p.log.info('writing package.json')
    await writeFile(targetPackageJSON, `${JSON.stringify(pkgJson, null, 2)}\n`, 'utf-8')
    p.log.info('done')

    p.outro('running pnpm install')
    process.argv = process.argv.slice(0, 2)
    await import('@antfu/ni/ni')
  })

cli.help()
cli.version(version)
cli.parse()

function serializeArgs(options: Record<string, unknown>): string[] {
  const _ = options._ || []
  const args = Object.entries(options)
    .flatMap(([key, value]): string[] => {
      if (value == null)
        return []
      if (key === '_')
        return []
      if (typeof value === 'boolean') {
        return value
          ? [key.length === 1 ? `-${key}` : `--${key}`]
          : [key.length === 1 ? `-no-${key}` : `--no-${key}`]
      }
      if (Array.isArray(value))
        return value.flatMap(x => [`--${key}`, String(x)])
      return [`--${key}`, String(value)]
    })
    .filter(Boolean)
  if (options._ && Array.isArray(options._) && options._.length)
    args.push('--', ...options._)
  return args
}
