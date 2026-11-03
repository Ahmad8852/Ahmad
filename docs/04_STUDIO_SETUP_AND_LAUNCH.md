# Studio Setup & Launch Checklist

## A. Build and open
```bash
aftman install        # or install Rojo 7.4.x manually
rojo build -o GooberTide.rbxlx
```
Open `GooberTide.rbxlx` in Roblox Studio. (Or `rojo serve` + the Rojo plugin for live sync.)

## B. Studio settings (Game Settings)
- **Security > Enable Studio Access to API Services**: ON (so DataStore/leaderboards work in Studio).
- **Players > Max Players: 12** (12 bases exist; a 13th player is kicked politely).
- Avatar: R15, allow any. Place is **not** StreamingEnabled (project file sets it false so the world is always loaded).
- Chat: either works (no chat dependency).

## C. First playtest pass (30 min) - tick every box
Run **Test > Clients and Servers: 2 Players**.
- [ ] Both players spawn on different raised platforms with signs above.
- [ ] Belt spawns goobers; hold E buys one; it appears on your pad and the pad shows income.
- [ ] Standing on pad collects cash; HUD updates.
- [ ] Player B climbs A's ramp, holds E 2.5 s on A's goober: A gets red vignette + banner; B has a goober over their head.
- [ ] A slaps B with the glove (click): B drops it, goober back on A's pad.
- [ ] B delivers to own platform: goober moves, announcements show for Legendary+.
- [ ] Director (bottom-right button, Studio only) > TRIGGER TIDE: siren -> wave -> players on low ground die, platforms safe -> Surge -> beach goobers.
- [ ] Lock Base: red cage, steal prompts disappear, timer in HUD.
- [ ] Rebirth button works after "+$1 BILLION" from Director.
- [ ] Stop the session and press Play again: cash/goobers persisted (needs API access ON).
Likely tuning spots if something feels off: `Config.TIDE.SAFE_Y`, wave size, `Plot` ramp walls, prompt distances.

## D. Create monetization (Creator Hub > your experience)
1. Monetization > Passes: create `2x Cash`, `Auto Collect`, `VIP`, `Lucky Charm`, `+4 Slots` (names/icons from marketing/05).
2. Monetization > Developer Products: create the 8 in `Config.PRODUCTS`.
3. Paste each numeric ID into `src/shared/Config.luau` (`id = 0` -> real id), rebuild/publish.
4. Add your UserId to `Config.DIRECTORS` so you get Director mode in live servers.
5. Test every purchase in a private test place first - receipts are idempotent but verify.

## E. Publish
- File > Publish to Roblox. Set **Genre: Adventure/Comedy**, **Devices: all (phone, tablet, PC, console)**, **Max players 12**.
- Fill **Experience Questionnaire** (age guidelines): stealing = mild cartoon mischief; no real-money random items; no violence beyond cartoon slap.
- Upload icon/thumbnails from marketing/05, add title + description, enable **Voice off**, enable **Private servers** (optional paid VIP servers).
- Set experience **Private -> Public** only after the checklist in C is green.

## F. Soft launch (days -3 to 0)
- Friends & family 20-person test; watch funnel step drop-offs.
- Fix the top 3 drop-offs, then run the 7-day pre-launch teaser posts (marketing/04).
- Pre-seed 5 creators with codes + Director-enabled accounts.

## G. Launch day
- Public toggle, publish "NEW: Goober Tide" post across TikTok/Shorts/Reels, Discord @everyone with code `LAUNCH`.
- Turn on a small Roblox Sponsored Ad (e.g. 50k Robux over 3 days, two icons A/B).
- Monitor: crash logs (Developer Console > Server log), DataStore errors, D1 retention.
