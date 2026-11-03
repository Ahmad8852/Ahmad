#!/usr/bin/env python3
"""
GOOBER TIDE - Higgsfield content factory generator.

Expands the creative building blocks below (characters x viral moments x hooks x formats) into:
  marketing/output/prompts_batch.json   - machine-readable, one object per asset
  marketing/output/prompts_batch.csv    - same, spreadsheet friendly
  marketing/output/content_calendar.csv - 30 day posting calendar (3 posts/day, 3 platforms)
  marketing/output/gameplay_shotlist.csv- what to screen-record in-game (Director panel commands)

Run:  python3 tools/content_factory.py
Zero dependencies. Deterministic (seeded) so re-runs give identical IDs.
Edit the dictionaries, re-run, upload the CSV to your scheduler / paste prompts into Higgsfield.
"""
import csv
import json
import os
import random
from datetime import date, timedelta

random.seed(42)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "marketing", "output")
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------------------
# 1. STYLE LOCK - paste at the end of EVERY image/video prompt for consistency
# ---------------------------------------------------------------------------
STYLE = (
    "stylized 3D toy-like cartoon render, glossy smooth plastic materials, big googly slightly cross-eyed eyes, "
    "bright saturated candy colors, soft studio lighting, shallow depth of field, clean blocky Roblox-inspired world, "
    "no text, no logos, no watermark"
)

# ---------------------------------------------------------------------------
# 2. CHARACTERS (visual descriptions are the continuity bible - never paraphrase them)
# ---------------------------------------------------------------------------
CHARACTERS = {
    "blorp": ("Blorp", "Common", "a round lime-green slime blob with rosy pink cheeks, two tiny stubby feet and a goofy grin"),
    "snorbo": ("Snorbo", "Common", "a round bubblegum-pink blob with two huge white buck teeth sticking out of its mouth"),
    "discodave": ("Disco Dave", "Rare", "a round hot-magenta blob wearing black sunglasses and big black DJ headphones"),
    "turbotaco": ("Turbo Taco", "Epic", "a round golden-orange blob with sunglasses, a fluffy white tail and a small flame on its back"),
    "ghostytoast": ("Ghosty Toast", "Epic", "a translucent pale-white blob with a glowing yellow halo and pink cheeks"),
    "kinggigaglorp": ("King Gigaglorp", "Legendary", "a big emerald-green slime blob with a glowing gold crown, big white teeth and sparkles around it"),
    "magmamuffin": ("Magma Muffin", "Legendary", "a glowing dark-red lava blob with cream spikes on top and flames licking off its body"),
    "cosmiccheeseborger": ("Cosmic Cheeseborger", "Mythic", "a huge golden-yellow blob with a gold crown, glowing white angel wings and floating sparkles"),
    "voidwaffle": ("Void Waffle", "Mythic", "a huge dark-purple blob with white horns, glowing white wings and swirling cosmic sparkles"),
    "prismaticpickle": ("Prismatic Pickle", "Mythic", "a huge neon-green blob with a gold halo, white wings and black sunglasses, rainbow light shimmering over it"),
    "thegoober": ("THE GOOBER", "Secret", "a gigantic pure-white rainbow-shimmering blob with halo, crown, wings, flames and sparkles - the final boss of cute"),
    "tsunamoo": ("Tsunamoo", "Secret", "a gigantic deep-ocean-blue blob with a gold crown and glowing white wings, surfing on a wave of water"),
}

# ---------------------------------------------------------------------------
# 3. SCENES
# ---------------------------------------------------------------------------
SCENES = {
    "belt": "a neon-edged conveyor belt running through a sunny sand plaza with palm trees, a pink GOOBER BELT arch in the distance",
    "base": "a pastel floating-style raised platform base with glowing teal pads, seen from a low hero angle",
    "tide": "a gigantic translucent blue tsunami wave wall with glowing white foam crashing across a sand plaza at sunset",
    "beach": "a flooded plaza at golden hour with shallow glittering water, washed-up toys scattered around, big puffy clouds",
    "night": "a dark neon-lit plaza at night with purple sky, glowing rainbow particles and light beams",
}

# ---------------------------------------------------------------------------
# 4. VIRAL MOMENTS - each maps to something the game really does
#    hook: first 1.5 seconds  | beats: shot structure | capture: how to record it in-game
# ---------------------------------------------------------------------------
MOMENTS = [
    dict(id="lastsecond", name="Last-Second Steal", scene="base", rarity_min=4, dur=12,
         hooks=["He had 1 second left to steal this", "I stole a {rarity} with the owner staring at me", "POV: you steal while they blink"],
         beats="0-1.5s extreme close-up of {char} on its pad, ominous. 1.5-6s hand-held chase: thief grabs it, runs down the ramp. 6-10s owner sprints behind, slap glove swing, camera shake. 10-12s thief lands on own base, gold sparkles, reveal text.",
         vo="Okay okay okay do NOT look at me... {char} is mine now.",
         capture="Two accounts. Account B holds E on the goober (2.5s). Record A running after with the Slap Glove. Use Director 'GIVE: ...' to put the target on Base A.",
         cta="Play before it's stolen. Link in bio."),
    dict(id="tidewave", name="Tide Wave Escape", scene="tide", rarity_min=1, dur=10,
         hooks=["The water is coming and I'm carrying {char}", "99% of players don't make it up this ramp", "Tide in 3... 2... run."],
         beats="0-2s siren, sky turns red, players sprint. 2-7s wave wall crashes across plaza, hero {char} on the player's head. 7-10s he leaps onto the platform, wave passes underneath, cut to scoreboard 'TIDE SURVIVOR'.",
         vo="Siren. Run. RUN. Jump... YES.",
         capture="Director panel > TRIGGER TIDE. Film from the platform edge (safe) and from a thief carrying a goober on the ramp.",
         cta="Can you survive the Tide? Free on Roblox."),
    dict(id="mythicreveal", name="Mythic Reveal", scene="belt", rarity_min=6, only=["cosmiccheeseborger", "voidwaffle", "prismaticpickle"], dur=8,
         hooks=["I waited 6 hours for this", "Wait for the end... it's a MYTHIC", "The whole server stopped when this rolled in"],
         beats="0-2s belt rolls past mundane commons, music builds. 2-4s shadow rolls into frame, screen shake, server banner. 4-7s {char} full glam reveal, camera orbit, confetti. 7-8s buy prompt + 'BOUGHT'.",
         vo="That's... that's not a common... NO WAY.",
         capture="Director > SPAWN MYTHIC / RAINBOW MYTHIC while recording the belt from the arch.",
         cta="Hunt your Mythic. Play free."),
    dict(id="tsunamoo", name="Tsunamoo Washed Ashore", scene="beach", rarity_min=7, only=["tsunamoo"], dur=12,
         hooks=["1 in 25 tides. I got the Tsunamoo.", "The rarest thing in Goober Tide just washed up", "SECRET UNLOCKED"],
         beats="0-3s calm flooded plaza, announcer banner 'TSUNAMOO WASHED ASHORE'. 3-8s everyone sprints, player slides, grabs. 8-12s gigantic glowing blue reveal, 450M/s counter ticking.",
         vo="Everyone is running at me. I'm not letting go.",
         capture="Set Tide.forceTsunamoo = true in the console (see docs) or Director 'GIVE: TSUNAMOO'. Film grabs from several accounts.",
         cta="Catch the Tsunamoo. Link in bio."),
    dict(id="rebirthflex", name="Rebirth Flex", scene="night", rarity_min=1, dur=10,
         hooks=["From $300 to a TRILLION in one video", "I rebirthed 10 times so you don't have to", "Noob to Mythic base speedrun"],
         beats="0-2s empty base, $300. 2-8s speed-ramped montage: buys, pads filling, cash counter spinning, slots unlocking. 8-10s rebirth flash, 'x6 INCOME'.",
         vo="Three hundred dollars. Let's see how far this goes.",
         capture="Screen-record a real run with 2x speed edit, or use Director cash buttons to show the late game.",
         cta="Start your climb. Free on Roblox."),
    dict(id="slapdefend", name="Slap Defense", scene="base", rarity_min=1, dur=8,
         hooks=["Never steal from me", "He thought the lasers were off", "Get slapped, nerd"],
         beats="0-2s thief creeps, tension beat. 2-4s alarm lights red, owner spins. 4-6s slap glove -> thief flies across screen. 6-8s goober returns, '+DEFENDED' text.",
         vo="Mm. No. Not today.",
         capture="Two accounts. Account B steals, Account A slaps (shove velocity looks great in slow-mo).",
         cta="Defend your goobers. Play now."),
    dict(id="lockbase", name="Base Lock Troll", scene="base", rarity_min=1, dur=8,
         hooks=["They tried to steal. The lasers had other plans", "POV: you hit LOCK at the perfect time", "Thieves HATE this one trick"],
         beats="0-2s three thieves converge. 2-4s thumb hits LOCK, red laser cage rises. 4-8s thieves bounce off, owner laughs, goober bobbing happily.",
         vo="Three of them. One button.",
         capture="Account A hits Lock Base as B/C/D approach.",
         cta="Lock it. Flex it. Play free."),
    dict(id="beachrush", name="Beach Goober Scramble", scene="beach", rarity_min=1, dur=10,
         hooks=["FREE goobers are washing up RIGHT NOW", "The wave left gifts", "Everyone sprinting for free Epics"],
         beats="0-2s water recedes, glittering. 2-8s swarm of players dashing between 14 glowing goobers, grabs and slaps. 8-10s rare pop, counter.",
         vo="Free! Free! Free! Grab it grab it GRAB IT!",
         capture="Director > BEACH GOOBERS with 4+ accounts.",
         cta="Free goobers every Tide."),
    dict(id="mutation", name="Mutation Jackpot", scene="belt", rarity_min=1, dur=8,
         hooks=["A RAINBOW mutation on a Common?!", "Gold Lava Rainbow - which is best?", "0.5% chance and I hit it"],
         beats="0-2s plain goober approaches. 2-3.5s flicker as mutation sparkles hit. 3.5-6s color-cycling reveal, income x5 counter. 6-8s bought, base glows.",
         vo="That's a rainbow. That's a RAINBOW.",
         capture="Director > RAINBOW MYTHIC / LAVA EPIC / GOLD LEGENDARY.",
         cta="Mutations are real. Chase them."),
    dict(id="fakeout", name="Fake-Out Funny", scene="belt", rarity_min=1, dur=7,
         hooks=["The goober that never stops looking at you", "POV: you saw this on the belt at 3AM", "Cursed goober spotted"],
         beats="0-3s uncanny close-up, cross-eyed stare, eyes follow camera. 3-5s beat drop, goober rolls on belt. 5-7s smash cut to price tag $150.",
         vo="(silence, then a very small) bloop.",
         capture="Macro shot of a Blorp or Snorbo on the belt; slow push-in.",
         cta="Meet the goobers. Free."),
    dict(id="tutorial", name="60s Tutorial Speedrun", scene="belt", rarity_min=1, dur=15,
         hooks=["How to get rich in Goober Tide in 60 seconds", "Beginner mistakes that cost you a Mythic", "Do THIS first"],
         beats="0-3s hook text. 3-6s hold E on belt. 6-9s stand on pad, cash pops. 9-12s lock base before stealing. 12-15s tide siren, run to high ground.",
         vo="Rule one: buy anything. Rule two: stand on your pad. Rule three: lock before you leave.",
         capture="Straight gameplay with captions, record on a fresh account.",
         cta="Free on Roblox - link in bio."),
    dict(id="duo", name="Friends vs Thief Duo", scene="base", rarity_min=1, dur=10,
         hooks=["I stole from my best friend (we're no longer friends)", "My brother tried to rob me. I recorded it.", "Roommate betrayal speedrun"],
         beats="0-2s two friends chilling on base. 2-5s one slips away, climbs next base. 5-8s alarm, chase, laugh. 8-10s steal succeeds, 'we're not friends' text.",
         vo="Dude. DUDE. Give it back!",
         capture="Two real friends on Discord call, capture voice.",
         cta="Bring your friends. Betray them."),
]

# Hook formats / on-screen text styles
ONSCREEN = [
    "{hook}",
    "WAIT FOR IT",
    "POV: {pov}",
    "{rarity} OR NOTHING",
]
POV = ["you almost got stolen from", "the tide is 3 seconds away", "you found the secret goober", "you rebirthed again"]

HASHTAGS = {
    "tiktok": "#roblox #robloxgames #gooberTide #robloxtiktok #fyp #gaming #stealabrainrot #growagarden #robloxmemes",
    "shorts": "#roblox #shorts #robloxgames #gooberTide #gaming #robloxgameplay",
    "reels": "#roblox #reels #robloxgames #gooberTide #gaming #robloxedit",
}
PLATFORM_SPECS = {
    "tiktok": dict(aspect="9:16", max_s=15),
    "shorts": dict(aspect="9:16", max_s=20),
    "reels": dict(aspect="9:16", max_s=15),
}

MODELS = {
    "keyframe_image": "nano_banana_pro",       # best text/identity, reference images supported
    "video_hero": "seedance_2_5",              # omni-reference: feed the keyframe + character sheet
    "video_fast": "grok_video",                # cheap iterations, 1-15s
    "video_alt": "flux_3_video",               # multi-frame image-to-video, up to 4k
    "ugc_ad": "marketing_studio_video",        # UGC/Tutorial/Unboxing presets (needs product entry)
}


def rarity_pool(min_order):
    order = {"Common": 1, "Uncommon": 2, "Rare": 3, "Epic": 4, "Legendary": 5, "Mythic": 6, "Secret": 7}
    return [k for k, v in CHARACTERS.items() if order[v[1]] >= min_order]


def build_rows():
    rows = []
    n = 0
    for m in MOMENTS:
        pool = m.get("only") or rarity_pool(m["rarity_min"])
        # 2-3 characters per moment (rotates so the roster gets even coverage)
        picks = random.sample(pool, k=min(len(pool), 3))
        for cid in picks:
            name, rarity, desc = CHARACTERS[cid]
            for hi, hook in enumerate(m["hooks"]):
                n += 1
                scene = SCENES[m["scene"]]
                hook_txt = hook.format(rarity=rarity.upper(), char=name)
                beats = m["beats"].format(char=name, rarity=rarity)
                key_prompt = (
                    f"Keyframe: {desc}, hero shot in {scene}. Dramatic low angle, strong rim light. {STYLE}"
                )
                vid_prompt = (
                    f"Vertical 9:16 social video, {m['dur']} seconds. Shot plan: {beats} "
                    f"Main character: {name} - {desc}. Setting: {scene}. "
                    f"Fast energetic camera, handheld shake on impacts, punchy sound design, comedic timing. {STYLE}"
                )
                rows.append(dict(
                    id=f"GT-{n:03d}",
                    moment=m["name"],
                    character=name,
                    rarity=rarity,
                    hook_text=hook_txt,
                    onscreen_text=random.choice(ONSCREEN).format(hook=hook_txt.upper(), pov=random.choice(POV), rarity=rarity.upper()),
                    voiceover=m["vo"].format(char=name),
                    duration_s=m["dur"],
                    aspect="9:16",
                    keyframe_model=MODELS["keyframe_image"],
                    keyframe_prompt=key_prompt,
                    video_model=MODELS["video_hero"] if rarity in ("Mythic", "Secret", "Legendary") else MODELS["video_fast"],
                    video_prompt=vid_prompt,
                    gameplay_capture=m["capture"],
                    cta=m["cta"],
                ))
    return rows


def caption_for(row, platform):
    return f"{row['hook_text']} {row['cta']} {HASHTAGS[platform]}"


def build_calendar(rows):
    start = date(2026, 11, 9)  # launch Monday (edit)
    plat = ["tiktok", "shorts", "reels"]
    # priority order: reveals + tide first (best retention), tutorials mid, humor sprinkled
    order = {"Mythic Reveal": 0, "Tide Wave Escape": 0, "Last-Second Steal": 1, "Tsunamoo Washed Ashore": 1,
             "Mutation Jackpot": 2, "Slap Defense": 2, "Beach Goober Scramble": 3, "Base Lock Troll": 3,
             "Rebirth Flex": 4, "60s Tutorial Speedrun": 4, "Friends vs Thief Duo": 5, "Fake-Out Funny": 5}
    pool = sorted(rows, key=lambda r: (order.get(r["moment"], 9), r["id"]))
    # interleave moments so no two consecutive posts share a format
    by_moment = {}
    for r in pool:
        by_moment.setdefault(r["moment"], []).append(r)
    queue = []
    while any(by_moment.values()):
        for k in sorted(by_moment, key=lambda x: order.get(x, 9)):
            if by_moment[k]:
                queue.append(by_moment[k].pop(0))
    cal = []
    slots = ["12:00", "17:00", "21:00"]
    qi = 0
    for d in range(30):
        day = start + timedelta(days=d)
        for si, t in enumerate(slots):
            if qi >= len(queue):
                qi = 0
            r = queue[qi]
            qi += 1
            p = plat[(d + si) % 3]
            cal.append(dict(
                date=day.isoformat(), time_local=t, platform=p, asset_id=r["id"], moment=r["moment"],
                character=r["character"], caption=caption_for(r, p),
                note="Launch week: reply to every comment with a code (LAUNCH, TIDE, SPLASH)" if d < 7 else "",
            ))
    return cal


def build_shotlist():
    shots = []
    for m in MOMENTS:
        shots.append(dict(moment=m["name"], duration_s=m["dur"], how_to_capture=m["capture"],
                          camera="Roblox 1080x1920 portrait crop or record 16:9 and Reframe in Higgsfield to 9:16",
                          tip="Press F6 to hide the HUD for clean cinematic plates; keep HUD on for tutorial/flex formats."))
    return shots


def write_csv(path, rows):
    if not rows:
        return
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)


def main():
    rows = build_rows()
    cal = build_calendar(rows)
    shots = build_shotlist()
    with open(os.path.join(OUT, "prompts_batch.json"), "w", encoding="utf-8") as f:
        json.dump(dict(style_lock=STYLE, models=MODELS, assets=rows), f, indent=2, ensure_ascii=False)
    write_csv(os.path.join(OUT, "prompts_batch.csv"), rows)
    write_csv(os.path.join(OUT, "content_calendar.csv"), cal)
    write_csv(os.path.join(OUT, "gameplay_shotlist.csv"), shots)
    print(f"{len(rows)} asset briefs, {len(cal)} calendar slots, {len(shots)} capture recipes -> {OUT}")


if __name__ == "__main__":
    main()
