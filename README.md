# nip

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![bundle][bundle-src]][bundle-href]
[![JSDocs][jsdocs-src]][jsdocs-href]
[![License][license-src]][license-href]

A better `pnpm install xxx` with prompts and catalogs support.

> [!NOTE]
> This CLI is [pnpm](https://pnpm.io/)-specific and opinionated, you might want to check [`@antfu/ni`](https://github.com/antfu-collective/ni) instead.

```bash
pnpm i @antfu/nip
```

```bash
nip vue
```

Then it will prompts you to select the catalog to install the package to, and update `pnpm-workspace.yaml` and `package.json` for you.

You can also explictly set the catalog with `--catalog` flag.

```bash
nip vue --catalog frontend
```

## Why?

- `pnpm` currently lacking of the `--catalog` option to directly install to catalog, resulting in quite a few manual operations. While pnpm's current codebase structure is a bit too complex to add this feature as an outside contributor.
- Sometimes the dependency might already presented in the workspace/catalogs. This tool would pick existing version/catalog automatically.
- My workflow might be a bit opinionated (will write a blog post to explain!)

## Todos

- [ ] Support inferring current workspace packages and fill `workspace:*` automatically.
- [ ] Prompts to edit entries (if select "no" in "looks good")

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © [Anthony Fu](https://github.com/antfu)

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/nip?style=flat&colorA=080f12&colorB=1fa669
[npm-version-href]: https://npmjs.com/package/nip
[npm-downloads-src]: https://img.shields.io/npm/dm/nip?style=flat&colorA=080f12&colorB=1fa669
[npm-downloads-href]: https://npmjs.com/package/nip
[bundle-src]: https://img.shields.io/bundlephobia/minzip/nip?style=flat&colorA=080f12&colorB=1fa669&label=minzip
[bundle-href]: https://bundlephobia.com/result?p=nip
[license-src]: https://img.shields.io/github/license/antfu/nip.svg?style=flat&colorA=080f12&colorB=1fa669
[license-href]: https://github.com/antfu/nip/blob/main/LICENSE
[jsdocs-src]: https://img.shields.io/badge/jsdocs-reference-080f12?style=flat&colorA=080f12&colorB=1fa669
[jsdocs-href]: https://www.jsdocs.io/package/nip
