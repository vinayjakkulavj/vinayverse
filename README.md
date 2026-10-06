# douknowme — Vinay's personal universe

A portfolio application centered on Vinay, with three worlds: **Professional**, **Know Me**, and **Project Pandora**. The application uses Next.js 16, React 19, TypeScript, React Three Fiber, Three.js, Drei, and GSAP. Inter is bundled locally through Fontsource.

“DO YOU KNOW ME?” reveals from left to right over 2.5 seconds without a title spacecraft; the drag control appears at 2.8 seconds. Even a small pull reveals colorful braided particle strings. Short pulls spring closed; a completed pull opens a radial aperture over 0.9 seconds. A single GPU draw carries 11,000 desktop particles or 4,000 mobile particles through nine crossing strings, synchronized elastic waves, expansion, mixing turns, and three sparse collision pairs with brief local flashes. The live preview and release share the same animation clock. After release, the particles gather into the existing world colors over 3.5 seconds, revealing the sun and three planets in a clear triangular arrangement before their steady orbits begin. The opening is a visual metaphor for the Big Bang and later cosmic structure, rather than a literal physical simulation.

The solar plane is gently tilted. Vinay is represented by a rusty red sphere with a textured convection surface and visible axial rotation. Three distinct calculated orbital paths use normalized arc distance to maintain steady travel speed, including while focused. Eclipse shading follows the current 3D positions: an intervening planet's apparent overlap with the finite Sun smoothly dims the receiving world's surface, atmosphere, halo, and ring; light returns as the alignment passes. A bottom **Design insights** button explains the symbolism, motion, eclipses, and artistic simplifications, with NASA references. Its **Watch an eclipse** action smoothly brings the actual orbits into alignment over 2.8 seconds, then resumes their usual motion; it uses the same geometric shadow calculation as naturally occurring alignments.

One small meteoroid circles each desktop planet. Rare impacts are staggered about 70 seconds apart across the system, with a subtle surface flash; each planet is struck roughly once every three and a half minutes. The scene includes shader-based planets and atmospheres, world focus, satellites, camera transitions, hidden constellations, a discovery trail, and a spacecraft cursor. Three depth layers contain 13,000 desktop stars or 6,500 mobile stars, with twelve decorative constellations, two recurring meteors, and a comet with a spherical nucleus and tapered tail. Its content also has ordinary, directly accessible pages with persistent email and LinkedIn actions.

## Run locally

Use Node.js and npm compatible with Next.js 16. The static preview script also requires Python 3.

```bash
git clone https://github.com/vinayjakkulavj/vinayverse.git
cd vinayverse
npm ci
npm run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Stop the development server before using the static preview, since both use port 3000.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server on `127.0.0.1:3000`. |
| `npm run typecheck` | Run TypeScript with no emitted files. |
| `npm run build` | Build the application and export the static website to `out/`. |
| `npm run serve` | Serve the existing `out/` directory with Python on `127.0.0.1:3000`. |

To preview the production export:

```bash
npm run build
npm run typecheck
npm run serve
```

The original dependency-free interaction prototype is preserved in the root `index.html` for reference. The npm commands above run the new application.

## Content and routes

Edit `src/data/portfolio.ts` to update the worlds and content. The `topics` array is the source for titles, descriptions, quotations, sections, optional lists, and project status. The `worlds` array defines each world's title, accent color, and satellite topics. Professional reads its résumé content from `src/data/resume.ts`.

There are **19 canonical topics** at `/explore/<slug>/`: three world overviews, eleven satellites, and five constellations. Six older Professional URLs remain available as aliases, making 25 exported topic routes. The home page is `/`.

| World | Overview slug | Satellite slugs |
| --- | --- | --- |
| Professional | `professional` | `experience`, `skills`, `achievements` |
| Know Me | `know-me` | `beyond`, `wonder`, `peace`, `alternate` |
| Project Pandora | `project-pandora` | `tools`, `ideas`, `experiments`, `stories` |

The constellation slugs are `soundtrack`, `on-the-road`, `small-things`, `science`, and `what-if`. The former Professional destinations (`lineage`, `systems`, `journey`, `automation`, `impact`, and `engineering-stack`) resolve to the relevant résumé section, with canonical metadata pointing to the new URL.

`src/app/explore/[slug]/page.tsx` generates these routes from `topics` during the build. Keep each slug unique. When adding a satellite, include its slug in the appropriate world's `topics` list. Rebuild the static export after any content change.

Professional reproduces the Professional Summary, Employment History, Technical Skills, and Professional Achievements from `Vinay_Jakkula_Databricks_Oct26.pdf`. PDF line wrapping is normalized; claims and dates are retained. The overview places the summary first, then “In this world,” followed by Experience, Skills, and Achievements. Each satellite also opens its individual section. No additional Professional narratives or quotes are included.

## Contacts and site URL

Edit `src/data/site.ts` for the site identity and contact destinations:

- **Send Signal:** `vinayjakkulargukt@gmail.com`
- **Open Comms:** `https://www.linkedin.com/in/vinayjakkula`

`SiteHeader.tsx` uses these values throughout the app, including detail pages. Email opens the visitor's mail application; LinkedIn opens in a new tab.

The default canonical URL is `https://douknowme.com`. To use another deployment URL, copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SITE_URL=https://your-domain.example
```

Set the same public variable in the hosting provider's build environment. It supplies the metadata base, sitemap, and robots configuration, so rebuild when it changes. This value is public and should contain no secrets.

## Experience preferences and fallback navigation

- **Motion:** animation follows the operating system's reduced-motion preference. Reduced motion simplifies the opening and camera transitions and uses the native cursor.
- **Discovery:** visited topics are stored in the browser's `localStorage` under `douknowme-discovered`. They influence the discovery trail and the central sphere's appearance. Opening completion is held only in memory; refreshes and fresh visits show the opening again. Storage failures do not prevent exploration.
- **Planet focus:** mouse hover on a planet surface opens its details. Planet captions retain click and keyboard navigation without opening details on mouse hover. Clicking empty space or other noninteractive screen areas returns to the full universe; dragging preserves focus.
- **Navigation:** planet and satellite entry follows a 2.05-second camera flight, ending inside the atmosphere with world-colored haze before the prefetched content route opens. Direct content links remain immediately accessible. Reduced motion and the WebGL fallback bypass the flight.
- **Mobile:** at widths of 700px or below, a compact universe starts with a clear triangle and a sticky world selector. Three separated moving tracks fit in the same canvas and allow geometric eclipses without the planet bodies intersecting. Dragging empty space rotates the 3D system inside the same compact canvas, with gentle inertia and bounded pitch; the page remains scrollable outside the scene. Details flow below the scene, so another world remains selectable while details are open. A first planet tap selects its world; tapping the selected planet enters it. The opening particle sequence fills the phone screen, then the canvas settles into the compact layout over 0.65 seconds. Wider screens retain the rotating universe. The spacecraft cursor is limited to fine pointers.
- **Opening:** “DO YOU KNOW ME?” appears on fresh visits and refreshes. Internal “Return to orbit,” “Universe,” and name links return directly to the universe. A content page's return link also selects its world. Text reveals from left to right over 2.5 seconds without a title jet; controls unlock at 2.8 seconds. Small pulls preview crossing, braided particle strings through a limited aperture; a successful release opens it over 0.9 seconds while the 3.5-second formation begins. The planets stay hidden until the streams gather, then emerge in their clear triangular starting arrangement. The whole drag track accepts a pull, with stationary pointer capture, final release-coordinate checks, and window event recovery. Short pulls spring back and can be retried; reduced motion uses a brief fade. Meteors, comets, and orbiting meteoroids appear only after formation and mobile settling finish.
- **Replay opening:** open `/?intro=1` to return to the introduction while keeping discovery and preferences. Finishing the introduction returns to `/`.
- **Design insights:** a bottom button opens a scrollable, keyboard-accessible guide to the design, with seven sections and NASA links distinguishing cosmic facts from artistic choices. Escape, the close control, or the backdrop dismisses it and restores focus. “Watch an eclipse” closes the guide, resets the view smoothly, and aligns the actual orbits before returning to their normal speeds.
- **Universe map:** this keyboard-accessible list offers every topic and remains available if the WebGL scene fails. Static detail pages can also be opened directly by URL. The initial home HTML includes ordinary world and map links before JavaScript loads.

## Architecture

| Location | Responsibility |
| --- | --- |
| `src/app/` | Next.js App Router pages, route metadata, sitemap, robots, and error pages. |
| `src/data/portfolio.ts`, `src/data/resume.ts`, and `src/data/site.ts` | Portfolio content, supplied résumé content, world definitions, identity, contacts, and canonical URL. |
| `src/components/UniverseExperience.tsx` | Opening flow, navigation, drag input, world focus, Universe map, and Design insights. |
| `src/components/UniverseScene.tsx` and `src/lib/shaders.ts` | React Three Fiber scene, planets, tilted orbits, constellations, trails, and atmospheric camera flights. |
| `src/components/UniverseFormation.tsx` and `PlanetFlight.tsx` | GPU braided strings, expansion, rebounds, collision flashes and sphere formation; world-colored flight overlay. |
| `src/lib/eclipse.ts` | Apparent-disc overlap for smooth geometric eclipse coverage. |
| `src/components/UniverseDesignGuide.tsx` and `.module.css` | Responsive design guide, astronomy references, and eclipse preview action. |
| `src/components/CosmicBackdrop.tsx` and `PlanetImpacts.tsx` | Surrounding stars, decorative constellations, distant meteors, rare planetary impacts, comet tails, and sky parallax. |
| `src/components/ContentView.tsx` and `ProfessionalResumeContent.tsx` | Topic detail layout, résumé sections, and related topic navigation. |
| `src/components/MobileUniversePanel.tsx` | Mobile world selector and details below the compact scene. |
| `src/components/ExperienceProvider.tsx` and `ExperienceShell.tsx` | System motion preference, discovery state, header, and cursor. |
| `src/components/EntryGate.tsx`, `TitleDrawing.tsx`, `StarshipCursor.tsx`, and CSS files | Opening flow, measured title reveal, pointer, and motion adaptations. |

`src/lib/orbits.ts` samples normalized arc distance so elliptical planet and moon paths maintain a constant travel speed instead of speeding up at their ends. Focusing a world does not pause its orbit; the system reduced-motion preference pauses the whole scene. Eclipse coverage is the fraction of the Sun’s apparent angular disc hidden by a nearer planet, measured at the receiving world’s center. It drives broad dimming for readability; the scene does not model a detailed spatial shadow or gravitational N-body motion. Real planets follow Kepler’s changing speeds on elliptical orbits; the site’s steady arc speed is an intentional navigation choice.

The 3D scene loads on the client. Topic content is generated as HTML during the build. The exported site needs no application server or database at runtime.

## Deployment

`next.config.ts` sets `output: 'export'`, `trailingSlash: true`, and unoptimized images. `npm run build` creates the HTML, CSS, JavaScript, and public assets in `out/`, which can be deployed to Vercel, Cloudflare Pages, or another static host. Hosts should serve directory `index.html` files for routes such as `/explore/lineage/`. See the [Next.js static export documentation](https://nextjs.org/docs/app/guides/static-exports).

For Vercel, import the repository as a Next.js project and use `npm run build`; retain the export configuration. See [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

For Cloudflare Pages, use the **Next.js (Static HTML Export)** preset, the build command `npm run build`, and output directory `out`. See [Cloudflare's static Next.js deployment guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/).

For other static hosts, build locally or in CI and publish the contents of `out/`. Configure the host to use `404.html` for missing routes when supported.

The application is deployed on Vercel at `https://vinayverse.net/`. Pushing to the connected GitHub `main` branch starts a production deployment. Set `NEXT_PUBLIC_SITE_URL=https://vinayverse.net` in the Vercel build environment for canonical metadata.
