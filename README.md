# GOOBER TIDE

> Buy goobers off a conveyor belt. Steal them from your friends. **Outrun the Tide.**

A complete Roblox game (Luau, Rojo project) plus the marketing machine to launch it:
a Higgsfield content factory that turns the game's built-in viral moments into 100+ short-form video briefs and a 30-day posting calendar.

| | |
|---|---|
| `src/` | The game: 27 Luau modules, ~5,300 lines. Everything (map, goobers, UI) is generated from code - **no marketplace assets needed**. |
| `docs/` | Game design, market thesis, monetization & live-ops, Studio setup + launch checklist. |
| `marketing/` | Character bible, Higgsfield playbook, 30 video scripts, creator/launch plan, store-page assets. |
| `tools/content_factory.py` | Generates `marketing/output/*` (prompts, calendar, capture shot-list). |

## The game in 30 seconds
1. **Belt** - a shared conveyor rolls random goobers (7 rarities, 24 creatures, 6 mutations). Hold **E** to buy.
2. **Earn** - goobers earn cash into their pad; stand on it to collect (or buy Auto Collect).
3. **Steal** - hold **E** on a goober in someone else's raised base, carry it home. Owners get an alarm, can **slap** you (drops it), or hit **Lock Base**.
4. **The Tide** - every 3 minutes a siren sounds and a giant wave sweeps the plaza. Be on high ground or be swept (and drop your loot). Afterwards: **Tide Surge** - 2x income, free washed-up Tidal goobers, and a rare chance at the secret **Tsunamoo**.
5. **Rebirth** for permanent multipliers; collect the whole Goooberdex.

## Run it
```bash
# 1. install Rojo (https://rojo.space) - or: aftman install
rojo build -o GooberTide.rbxlx      # builds a place file
# 2. open GooberTide.rbxlx in Roblox Studio, press Play (use "Start Server + 2 Players" to test stealing)
# or live-sync:  rojo serve   -> Studio Rojo plugin -> Connect
```
Then follow **docs/04_STUDIO_SETUP_AND_LAUNCH.md** (game settings, passes/products, publish).

## Status - read this
- The code was written and statically checked (block/bracket balance, cross-module call resolution) but **has not been run in Roblox Studio** - I had no Studio or Luau runtime in the build sandbox. Expect a short first playtest pass (the checklist is in docs/04). Anything that breaks will be tuning-level, not architecture-level.
- Gamepass / product IDs in `Config.luau` are `0` until you create them (shop shows a friendly "not live yet" message).
- Market claims in `docs/02` come from my training knowledge (cutoff mid-2026), not live Roblox analytics - verify on the Discover page before spending ad money.
- No Higgsfield credits were spent building this. Your account currently has ~32 credits; see `marketing/02_HIGGSFIELD_PLAYBOOK.md` for a spend plan.
