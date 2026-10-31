# Dockspire — We ship. Mostly.

The Dockspire website: [dockspire.github.io](https://dockspire.github.io/).

An English digital workshop website with an original SVG harbor, an interactive collision and ship breakup, flying cargo, coffee rescue and a reversible relaunch. Motion can be paused and respects reduced-motion preferences. Sound is opt-in.

## Local preview

```sh
python3 -m http.server 8111 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8111/. The site uses buildless HTML, CSS and JavaScript, with self-hosted OFL fonts and no package dependencies.

## Deployment

GitHub Actions checks JavaScript and deploys `dist/` to GitHub Pages after a push to `main`. Pull requests run the build check without deploying. The workflow can also be started manually. No deployment secrets are required.

Design references and the scene narrative are in [docs/CONCEPT.md](docs/CONCEPT.md). Font licenses are included alongside the font files.
