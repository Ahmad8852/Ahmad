# Market Thesis - why this game, why now

> Source: my training knowledge of the Roblox market through mid-2026, **not live analytics**. Validate the "Check" items on roblox.com/discover and RoMonitor/Rolimons before committing ad budget.

## What's been printing on Roblox (pattern, not copycat)
| Pattern | Representative hits | What players actually enjoy |
|---|---|---|
| **Collect-and-steal idle** | "Steal a Brainrot" style games | Passive income + raid tension + rare reveals |
| **Garden/economy idle with events** | "Grow a Garden" style games | Timed server events, mutations, huge CCU spikes on updates |
| **Survive-the-disaster arcade** | "Escape Tsunami"-style games, "99 Nights"-style | Instant-readable danger, great clips |
| **Meme-creature collectibles** | "brainrot" meme IP | Kid-native humor, collectability |

**Thesis:** the highest-retention loop (collect + steal) is crowded, but it lacks a *server-wide spectacle clock*. Goober Tide fuses the proven economy/steal loop with a recurring disaster event, giving every server a clip-worthy moment every 3 minutes and a reason for streamers to say "wait for the Tide".

## Differentiators vs. the field
1. **Original, brandable creatures** ("Goobers") with a character bible built for AI video consistency - not a meme-IP dependent on trend decay.
2. **The Tide event** (siren -> wave -> Surge) - a built-in content-creation device.
3. **In-transit steal model** - safer, more forgiving than permanent loss -> better for kids/retention, fewer rage-quits.
4. **Director mode** - marketing can film any viral moment on demand (competitors rely on luck).
5. **Odds disclosure** in-game (Goooberdex) - policy-safe and trust-building.

## Audience
- **Primary**: Roblox players 9-14, mobile-first. Likes: memes, rare reveals, trolling friends.
- **Secondary**: 15-22 streamers/clippers who need reaction moments.
- **Parents** (for Roblox ads and safety perception): no chat-gated purchases, no real-money random items, free codes.

## Platform strategy
| Channel | Role | Format |
|---|---|---|
| TikTok | Primary discovery | 8-15 s hooks (moment library) |
| YouTube Shorts | Longer shelf life | same cuts + 20 s tutorial |
| Instagram Reels | Parent/older-teen reach | polished Higgsfield keyframes |
| Roblox Sponsored Ads | Cold traffic | Use the best-performing 3 clips + icon A/B |
| Creators (mid-size, 10k-500k) | Trust + CCU spikes | Codes, Director-ready accounts |
| Discord | Retention | Code drops, Tide alerts |

## Launch KPIs (first 14 days)
| Metric | Healthy | Great |
|---|---|---|
| D1 retention | 18 % | 28 %+ |
| D7 retention | 5 % | 10 %+ |
| Avg session | 14 min | 22 min+ |
| Like ratio | 85 % | 92 %+ |
| First-buy within 60 s (funnel step 2) | 70 % | 85 % |
| Pay conversion | 1.5 % | 3 %+ |
| Short-form -> play CTR (link in bio) | 0.8 % | 2 % |

Funnel steps are already logged via `AnalyticsService` (Joined, FirstBuy, FirstCollect, FirstStealAttempt, FirstRebirth) - read them in Creator Hub > Analytics > Onboarding.

## Risks and mitigations
| Risk | Mitigation |
|---|---|
| Genre fatigue | Original IP + Tide spectacle + weekly Tide variants (Lava/Ice/Candy). |
| "Stealing" sensitivity | In-transit model, slap/lock counter-play, framed as comedic caper; no real violence. |
| Paid-randomness policy | No paid random items. Luck potions only affect shared belt rarity (odds shown); spin is free. Review current Roblox policy on "paid random items" before enabling more. |
| Bot/clone competitors | Ship updates fast; leverage brand characters in UGC/merch later. |
| Performance on mobile | Part-count budget per goober ~15; bobbing limited to 90-stud radius; heavy UI uses ScrollingFrames. |
