# Monetization & Live-Ops

Ethical baseline: nothing sold is a random item; the game is fully playable free; odds visible; no pay-to-win steal power (no "can't be slapped" passes).

## Passes (one-time)
| Pass | Suggested R$ | Why it sells |
|---|---|---|
| 2x Cash | 399 | Universal, evergreen. Top seller in this genre. |
| Auto Collect | 249 | Removes pad-touching; huge for mobile & AFK. |
| VIP | 499 | +25 % cash, 90 s lock, 6 h offline, [VIP] sign tag. Status + utility. |
| Lucky Charm | 199 | 2x luck on spin / daily goobers / beach grabs. |
| +4 Slots | 299 | Direct progression relief at slot 6. |

## Developer products (repeatable)
| Product | R$ | Notes |
|---|---|---|
| 10 min / 1 h / 6 h Cash | 49 / 149 / 499 | Scales with the buyer's income -> never obsolete. |
| Server Luck x2 (10 m) | 99 | **Benefits everyone** -> social gifting + "thank you" chat. Announced server-wide. |
| Server Luck x4 (5 m) | 199 | Influencer-friendly: a creator buys one on stream. |
| Tide Shield x3 | 79 | Panic-buy during the siren (warning is 15 s: sell a shield button in HUD later). |
| Instant Base Lock | 39 | Impulse buy when a thief is nearby. |
| Summon a Mythic | 399 | Mythic rolls on belt, reserved 25 s for buyer, announced to the server. Public flex = marketing. |

## Setup
Create these in Creator Hub (see docs/04), paste IDs into `Config.PASSES` / `Config.PRODUCTS`. Prices in `Config` are display labels only; the real price shown at purchase comes from Roblox.

## Live-ops calendar (repeat weekly)
| Day | Beat |
|---|---|
| Mon | New code on Discord/TikTok bio (cash/shield/goober). |
| Wed | "Happy Tide" - set `Config.TIDE.INTERVAL = 120` for 24 h. |
| Fri | Content drop: new goober (add one row to `Config.Creatures`). |
| Sat | Creator code event: `HIGGS`, `SQUAD` style codes per creator. |
| Sun | Leaderboard shout-out video (Top Thieves). |

Adding a goober = one `c(...)` line in Config + (optional) a new feature function in `GooberFactory`. No UI work needed; the Goooberdex builds itself.

## Economy health checks
- First Rebirth target: ~$2.5M. Expected 25-40 min for an engaged new player; if funnel shows >50 min, raise early `cps` or lower `rebirthCost`.
- If cash inflation outruns prices late-game, add Secret-tier price rungs or raise `rebirthCost` base (3x per rebirth).
- Watch "stash full" frequency - if >30 % of pads are full at logout, stash cap (`STASH_HOURS`) is too tight; a full stash is a Auto-Collect upsell moment.
