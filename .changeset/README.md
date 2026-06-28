# Changesets

This folder holds [changesets](https://github.com/changesets/changesets). Each release-worthy
change adds a markdown file here describing the bump (patch/minor/major) and a short summary.

Add one with:

```bash
npm run changeset
```

`changeset version` consumes these files to update the version and changelog, and
`npm run release` builds and publishes to npm.
