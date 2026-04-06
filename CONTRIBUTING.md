# Contributing to site-sense

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/YotamNordman/site-sense.git
cd site-sense
npm install
npm run build
npm test        # 11 tests, <1s
```

## Making Changes

1. Fork the repo and create a branch from `main`
2. Make your changes
3. Run `npm run build && npm test` — all tests must pass
4. Submit a pull request

## What to Contribute

- **Bug fixes** — especially for specific browser/portal edge cases
- **Portal testing** — capture reports from Azure Portal, GitHub, ADO, etc.

## Code Style

- TypeScript strict mode
- No unnecessary comments (code should be self-explanatory)

## Security

If you find a security vulnerability, **do not open a public issue**. See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

## Releasing a New Version

1. Update the `version` field in `package.json` and `extension/manifest.json` to match.
2. Push a tag: `git tag v0.x.0 && git push origin v0.x.0`
3. The [publish workflow](.github/workflows/publish.yml) automatically builds, zips, and publishes to the Chrome Web Store.

The workflow requires four GitHub repository secrets set by the maintainer:
`CHROME_EXTENSION_ID`, `CHROME_CLIENT_ID`, `CHROME_CLIENT_SECRET`, `CHROME_REFRESH_TOKEN`.

See the [Chrome Web Store developer documentation](https://developer.chrome.com/docs/webstore/using-api) for how to obtain OAuth2 credentials.
