# Higgsfield Content Factory Playbook

The factory turns the game's viral moments into a posting pipeline. Inputs: real gameplay captures (Director mode) + AI keyframes/B-roll. Output: ~3 posts/day on TikTok / Shorts / Reels.

## 0. Generate the briefs
```bash
python3 tools/content_factory.py
```
Produces in `marketing/output/`:
- `prompts_batch.csv|json` - 102 briefs (moment x character x hook): keyframe prompt, video prompt, hook text, VO line, CTA, capture recipe.
- `content_calendar.csv` - 90 slots (30 days x 3 platforms/times) with captions + hashtags.
- `gameplay_shotlist.csv` - how to capture each moment with the in-game Director panel.

Change `CHARACTERS`, `MOMENTS`, `HASHTAGS` in the script, re-run, done.

## 1. Models available on your account (checked via Higgsfield `models_explore`)
| Job | Model id | Why |
|---|---|---|
| Keyframes, thumbnails, icon art | `nano_banana_pro` | Best identity + text handling, takes reference images (use your Blorp render as `image_references`). 1k-4k, aspect 9:16/16:9/1:1. |
| Hero video (reveals, wave) | `seedance_2_5` | Omni-reference: start image + character references + audio, 4-30 s, 480p-1080p. Use `draft` (480p) first, finalize only winners. |
| Cheap iterations | `grok_video` / `grok_video_v15` | 1-15 s, image-to-video, cheapest way to test a hook. |
| Alt look / long | `flux_3_video` | 5-20 s, up to 4K, start/end frames. |
| UGC-style ads (talking creator) | `marketing_studio_video` | Presets (UGC, Tutorial, Unboxing, Review) with avatars; add the game as a "product". |
| Fix aspect | `reframe` tool | Convert a 16:9 gameplay capture to 9:16 without re-recording. |
| Virality check | `virality_predictor` tool | Score clips on hook strength / retention risk before posting. |
| Post | `tiktok_*` tools | Connect, prepare and publish drafts to TikTok directly from Higgsfield. |

## 2. Credits plan (be frugal - balance was 32 credits at build time)
1. **Day 0 (cheap):** 1 character sheet image set (Blorp, Cheeseborger, Tsunamoo) with `nano_banana_pro` 1k. Reuse as references forever.
2. **Day 1-3:** use `draft` mode / `grok_video` for 5 hooks; check with `virality_predictor`; keep top 2.
3. **Scale:** only finalize winners at 1080p; put real gameplay in 70 % of posts (free).
4. Upgrade the plan only after a clip crosses ~50k views.

## 3. The 5 production recipes
**A. Reveal (AI hero + real gameplay splice)** - 8-12 s
1. Generate keyframe with the brief's `keyframe_prompt` (nano_banana_pro, 9:16, reference = character image).
2. Image-to-video on `seedance_2_5` with the `video_prompt` (duration = brief). Draft first.
3. Splice: 0-2 s real belt footage -> AI reveal -> real "BOUGHT" gameplay. Add the on-screen text + VO.

**B. Pure gameplay clip** (free) - Director mode
1. Studio: record with Record/OBS, press **F6** to hide the HUD.
2. Use the Director button: `TRIGGER TIDE`, `SPAWN MYTHIC`, `RAINBOW MYTHIC`, `BEACH GOOBERS`...
3. Reframe 16:9 -> 9:16 in Higgsfield (`reframe`), add hook text + captions.

**C. Creator-style UGC** (Marketing Studio) - 12-15 s
1. Add Goober Tide as a product (name, icon, thumbnail, description).
2. Preset: UGC or Tutorial; avatar: a teen-friendly creator; hook from the library.
3. Overlay real gameplay B-roll. Keep claims factual (no fake earnings, no "free Robux").

**D. Cursed goober meme** - 6-7 s
Macro push-in on Snorbo/Blorp, eyes tracking camera, one absurd beat. Text only. Cheap with `grok_video`.

**E. Ad Multiplier** (for Roblox Sponsored Ads)
Take your top-performing 12 s clip -> create 4 variants (different hook text, music, first 1.5 s) -> test CTR.

## 4. Weekly rhythm
| Day | Output |
|---|---|
| Mon | 3 reveal posts (A) |
| Tue | 3 gameplay clips (B) |
| Wed | Happy Tide event clip + UGC (C) |
| Thu | 3 cursed memes (D) |
| Fri | New-goober teaser (A) + Roblox ad variants (E) |
| Sat | Creator collabs/stitches |
| Sun | Recap: best-of + Top Thieves leaderboard |

## 5. QA checklist before posting
- [ ] Hook visible in first 1.5 s; text readable on a phone.
- [ ] Goober looks like the in-game goober (check against Goooberdex).
- [ ] Real gameplay footage is clearly gameplay; AI footage labelled where required.
- [ ] No third-party IP, no music you don't own (use platform library for TikTok).
- [ ] CTA + code in caption; link in bio is live.
