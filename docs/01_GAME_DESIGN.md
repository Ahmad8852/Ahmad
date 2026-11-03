# Game Design Document - Goober Tide

## Pillars
1. **Instant clarity** - "buy / steal / survive" is explainable in one sentence and one 8-second clip.
2. **Social tension** - every player has something to lose and a reason to look at everyone else's base.
3. **Spectacle on a timer** - the Tide guarantees a shareable, shocking moment every 3 minutes in every server.
4. **Collection + flex** - rarities, mutations, Secret creatures, public announcements and a Goooberdex.

## Core loop (session = 20-40 min)
`Buy at belt -> pad earns -> collect -> buy better -> (steal / defend) -> Tide -> Surge -> Rebirth`

| Timer | What happens |
|---|---|
| 0-2.6 s | A new goober spawns on the belt (1.4 s during Surge). |
| 45 s | Belt journey; unbought goobers exit at "TOO SLOW!". |
| 3:00 | Tide cycle: 15 s warning, ~13 s wave, 60 s Surge. (First tide at 75 s so new players see it immediately.) |
| 45 s / 90 s VIP | Base lock duration, then 60 s recharge. |
| 4 h | Free Lucky Spin. |

## Systems (all in `src/server/Services`)
| System | File | Notes |
|---|---|---|
| Persistence | `Data.luau` | DataStore + **session locking**, retry, autosave 60 s, BindToClose, offline earnings (25 %, 2 h / 6 h VIP). |
| Economy | `Economy.luau` | Stash per pad (1 h cap), multipliers (rebirth x passes x surge), slots (6 -> 24), rebirth. |
| Bases | `Plot.luau` | 12 raised platforms with ramps, pads, signs, lock lasers, steal prompts. |
| Belt | `Belt.luau` | Weighted rarity roll, luck scaling, mutations, reserved drops. |
| Stealing | `Steal.luau`, `Slap.luau` | Goober stays **in transit** (still owned + saved by victim) until delivered - disconnects/crashes can never dupe or delete. |
| Tide | `Tide.luau` | Siren, lighting moods, wave kill-volume check, shields, survivor bonus, Surge, beach goobers, Tsunamoo. |
| Retention | `Rewards.luau` | 7-day streak, 12 playtime gifts, 8-slot spin, codes. |
| Monetization | `Monetization.luau` | 5 passes, 8 products, idempotent receipts. |
| Social proof | `Leaderboard.luau`, `Map.luau` | Richest + Top Thieves boards, server-wide announcements. |
| Content tools | `Director.luau` | Hidden panel to trigger any viral moment on demand. |

## Creature roster (24)
| Rarity | Belt chance* | Examples | Price range | Income/s |
|---|---|---|---|---|
| Common | 55 % | Blorp, Snorbo, Wibble, Dorp | $150-600 | 3-12 |
| Uncommon | 25 % | Squidge, Noodlr, Bonko, Mochi Mop | $1.5K-6.5K | 25-100 |
| Rare | 12 % | Sir Wobbles, Glitchy, Disco Dave | $15K-85K | 200-1K |
| Epic | 5 % | Toaster Tom, Lord Sploot, Turbo Taco, Ghosty Toast | $250K-1.4M | 2.8K-13K |
| Legendary | 1.8 % | King Gigaglorp, Sushi Samurai, Magma Muffin | $5M-30M | 50K-260K |
| Mythic | 0.7 % | Cosmic Cheeseborger, Void Waffle, Prismatic Pickle | $150M-1B | 1.1M-6.5M |
| Secret | 0.1 % / Tide only | THE GOOBER, **Tsunamoo** (Tide only) | $25B-100B | 120M-450M |

\*Per roll, before luck. Luck multiplies Rare+ weights. All odds are disclosed in the in-game Goooberdex.
**Mutations** (belt): Gold x1.5 (6 %), Slimy x2 (3 %), Lava x3 (1.5 %), Rainbow x5 (0.5 %), **Tidal x6** (Surge only).

## Why the Tide design works
- **Vertical map**: bases are 20 studs up; the plaza and lower ramps are the danger zone. "High ground" is readable from any camera angle.
- **Risk on the carry**: thieves must descend, cross the plaza and climb - exactly where the wave hits. Stealing right before a siren is a gamble players love to clip.
- **Reward after danger**: Surge (2x income, free goobers, higher luck) pulls everyone *toward* the plaza right after they fled it.
- **Fairness valves**: Tide Shields, base lock, slap glove, survivor bonus, no loss of owned goobers on death (a carried goober just returns).

## Anti-exploit notes
- All purchase/steal/collect logic is server-side; remotes are rate-limited and validated (distance, ownership, state).
- Session lock + in-transit model prevents duplication; receipts are deduped and only acknowledged after a successful save.
- Remote `Director` works only in Studio or for `Config.DIRECTORS` UserIds.

## Tuning cheat-sheet (`src/shared/Config.luau`)
Rarity weights, prices, income, tide interval/speed, lock/cooldown, slap range, rebirth curve, rewards, codes, sounds - all in one file.

## Roadmap (post-launch content, already designed to slot in)
1. **Week 2 - "Sharkcoin" update**: new Mythic line, Hammerhead boss goober that bites during Tide.
2. **Week 4 - Trading + gifting** (needs trade-safety review).
3. **Week 6 - Seasonal Tide variants**: Lava Tide, Ice Tide, Candy Tide (reskin wave + new mutation each).
4. **Week 8 - Clans/Squads** with shared base lock and weekly leaderboards.
