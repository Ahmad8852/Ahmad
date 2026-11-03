# Character & Brand Bible (the continuity layer for AI video)

AI video drifts unless every prompt repeats the same anchors. **Always paste the STYLE LOCK and the character's exact description** (both live in `tools/content_factory.py`; generated prompts already do this).

## Brand
- **Name:** Goober Tide - *Buy. Steal. Survive.*
- **Colors:** Bubblegum pink `#FF5AA0`, Aqua `#46DCFF`, Sunshine `#FFCD46`, Deep navy `#161930`.
- **Voice:** fast, cheeky, caper-movie narrator for gameplay; deadpan for the weird goober clips. Never mean, never real-violence.
- **Sound:** bouncy marimba + bass drops; siren + whoosh for Tide; tiny "bloop" for goobers.
- **Mascot:** Blorp (friendly, cheap, universal). Hero rare: Cosmic Cheeseborger. Villain energy: Void Waffle. Final boss of cute: THE GOOBER.

## STYLE LOCK (append to every prompt)
> stylized 3D toy-like cartoon render, glossy smooth plastic materials, big googly slightly cross-eyed eyes, bright saturated candy colors, soft studio lighting, shallow depth of field, clean blocky Roblox-inspired world, no text, no logos, no watermark

## Roster descriptions (exact strings used in prompts)
| Goober | Rarity | Anchor description |
|---|---|---|
| Blorp | Common | round lime-green slime blob, rosy pink cheeks, two tiny stubby feet, goofy grin |
| Snorbo | Common | round bubblegum-pink blob, two huge white buck teeth |
| Disco Dave | Rare | round hot-magenta blob, black sunglasses, big black DJ headphones |
| Turbo Taco | Epic | round golden-orange blob, sunglasses, fluffy white tail, small flame on back |
| Ghosty Toast | Epic | translucent pale-white blob, glowing yellow halo, pink cheeks |
| King Gigaglorp | Legendary | big emerald slime blob, glowing gold crown, big white teeth, sparkles |
| Magma Muffin | Legendary | glowing dark-red lava blob, cream spikes, flames licking off |
| Cosmic Cheeseborger | Mythic | huge golden-yellow blob, gold crown, glowing white angel wings, floating sparkles |
| Void Waffle | Mythic | huge dark-purple blob, white horns, glowing white wings, cosmic sparkles |
| Prismatic Pickle | Mythic | huge neon-green blob, gold halo, white wings, black sunglasses, rainbow shimmer |
| THE GOOBER | Secret | gigantic white rainbow-shimmering blob, halo, crown, wings, flames, sparkles |
| Tsunamoo | Secret | gigantic deep-ocean-blue blob, gold crown, glowing white wings, surfing on a wave |

The full 24-goober list matches `Config.Creatures` in the game, so the render in the ad is the thing players actually receive.

## Do / Don't
- DO show the cross-eyed stare - it's the meme.
- DO keep goobers round and simple; complexity = drift.
- DON'T put text in the generated frame (add captions in editing; AI text is unreliable).
- DON'T use real brand/IP names in prompts (no "Brainrot" character names, no Roblox logo marks inside AI renders).
- DON'T show the Roblox logo as the game's own - include "Roblox" only in the platform-required disclosure.

## Real-gameplay vs AI-generated: the 70/30 rule
Ads that show footage not in the game get flagged and hurt reviews. Use AI renders for **hooks, reveals, transitions, thumbnails, character comedy**; use **real gameplay footage** (F6 clean mode + Director panel) for anything that implies "this is how the game plays". Label per platform rules for AI content.
