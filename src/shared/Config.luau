-- GOOBER TIDE - central game configuration.
-- Everything a designer / marketer would want to tune lives here.

local Config = {}

----------------------------------------------------------------------
-- Meta
----------------------------------------------------------------------
Config.GAME_NAME = "Goober Tide"
Config.DATA_STORE = "GooberTide_v1"
Config.LB_CASH_STORE = "GooberTide_LB_Cash_v1"
Config.LB_STEAL_STORE = "GooberTide_LB_Steals_v1"
Config.SESSION_LOCK_SECONDS = 120
Config.AUTOSAVE_SECONDS = 60

-- UserIds allowed to open the Director (content capture) panel in live servers.
-- In Roblox Studio everybody is a director. Put your own UserId (and your creators') here.
Config.DIRECTORS = {} :: { number }

----------------------------------------------------------------------
-- Economy
----------------------------------------------------------------------
Config.START_CASH = 300
Config.BASE_SLOTS = 6
Config.MAX_SLOTS = 24
Config.STASH_HOURS = 1 -- how many hours of income a pad can store before it is full
Config.OFFLINE_RATE = 0.25 -- fraction of income earned while offline
Config.OFFLINE_MAX_HOURS = 2
Config.OFFLINE_MAX_HOURS_VIP = 6
Config.STEAL_HOLD = 2.5 -- seconds of holding E to steal
Config.CARRY_WALKSPEED = 13
Config.SLAP_COOLDOWN = 1.2
Config.SLAP_RANGE = 9
Config.LOCK_DURATION = 45
Config.LOCK_DURATION_VIP = 90
Config.LOCK_COOLDOWN = 60
Config.DEFEND_REWARD_MINUTES = 3 -- slapping a thief that carries something gives N minutes of income

function Config.rebirthCost(n: number): number
	return 2500000 * (3 ^ n)
end

function Config.rebirthMult(n: number): number
	return 1 + 0.5 * n
end

function Config.slotUpgradeCost(n: number): number
	return math.floor(1500 * (3.2 ^ n))
end

function Config.rebirthStartCash(n: number): number
	return Config.START_CASH + 500 * n
end

----------------------------------------------------------------------
-- Rarities
----------------------------------------------------------------------
export type Rarity = { name: string, order: number, color: Color3, weight: number, scale: number }

Config.Rarities = {
	{ name = "Common", order = 1, color = Color3.fromRGB(200, 200, 208), weight = 55, scale = 1.0 },
	{ name = "Uncommon", order = 2, color = Color3.fromRGB(92, 214, 110), weight = 25, scale = 1.1 },
	{ name = "Rare", order = 3, color = Color3.fromRGB(70, 150, 255), weight = 12, scale = 1.25 },
	{ name = "Epic", order = 4, color = Color3.fromRGB(176, 90, 255), weight = 5, scale = 1.45 },
	{ name = "Legendary", order = 5, color = Color3.fromRGB(255, 176, 40), weight = 1.8, scale = 1.7 },
	{ name = "Mythic", order = 6, color = Color3.fromRGB(255, 70, 120), weight = 0.7, scale = 2.0 },
	{ name = "Secret", order = 7, color = Color3.fromRGB(20, 240, 230), weight = 0.1, scale = 2.5 },
} :: { Rarity }

Config.Rarity = {} :: { [string]: Rarity }
for _, r in Config.Rarities do
	Config.Rarity[r.name] = r
end

----------------------------------------------------------------------
-- Mutations
----------------------------------------------------------------------
export type Mutation = { name: string, mult: number, color: Color3 }

Config.Mutations = {
	Normal = { name = "Normal", mult = 1, color = Color3.fromRGB(255, 255, 255) },
	Gold = { name = "Gold", mult = 1.5, color = Color3.fromRGB(255, 205, 60) },
	Slimy = { name = "Slimy", mult = 2, color = Color3.fromRGB(110, 255, 90) },
	Lava = { name = "Lava", mult = 3, color = Color3.fromRGB(255, 110, 30) },
	Rainbow = { name = "Rainbow", mult = 5, color = Color3.fromRGB(255, 120, 255) },
	Tidal = { name = "Tidal", mult = 6, color = Color3.fromRGB(70, 200, 255) },
} :: { [string]: Mutation }

-- chance (in percent) that a belt goober gets a mutation
Config.MutationRoll = {
	{ "Gold", 6 },
	{ "Slimy", 3 },
	{ "Lava", 1.5 },
	{ "Rainbow", 0.5 },
}
Config.MutationRollSurge = { -- during the Tide Surge after a wave
	{ "Tidal", 8 },
	{ "Gold", 6 },
	{ "Slimy", 3 },
	{ "Lava", 1.5 },
	{ "Rainbow", 0.5 },
}

----------------------------------------------------------------------
-- Creatures ("Goobers")
----------------------------------------------------------------------
export type Creature = {
	id: string,
	name: string,
	rarity: string,
	price: number,
	cps: number,
	color: Color3,
	scale: number?,
	features: { string },
	tideOnly: boolean?,
	blurb: string,
}

local function c(id, name, rarity, price, cps, color, features, blurb, extra): Creature
	local t: any = {
		id = id,
		name = name,
		rarity = rarity,
		price = price,
		cps = cps,
		color = color,
		features = features,
		blurb = blurb,
		scale = 1,
	}
	if extra then
		for k, v in extra do
			t[k] = v
		end
	end
	return t
end

local RGB = Color3.fromRGB

Config.Creatures = {
	-- COMMON
	c("blorp", "Blorp", "Common", 150, 3, RGB(120, 220, 110), { "cheeks" }, "Mostly goo. Fully vibes."),
	c("snorbo", "Snorbo", "Common", 250, 5, RGB(255, 150, 190), { "bigteeth" }, "Has never once closed its mouth."),
	c("wibble", "Wibble", "Common", 400, 8, RGB(120, 200, 255), { "antenna" }, "Receives signals from a taco truck."),
	c("dorp", "Dorp", "Common", 600, 12, RGB(255, 225, 90), { "sprout" }, "Photosynthesizes out of pure confidence."),
	-- UNCOMMON
	c("squidge", "Squidge", "Uncommon", 1500, 25, RGB(170, 120, 255), { "headphones" }, "Only listens to bass-boosted lullabies."),
	c("noodlr", "Noodlr", "Uncommon", 2500, 40, RGB(255, 170, 80), { "unibrow", "tail" }, "Zero bones. Infinite drama."),
	c("bonko", "Bonko", "Uncommon", 4000, 65, RGB(60, 200, 180), { "partyhat" }, "Every day is its birthday."),
	c("mochimop", "Mochi Mop", "Uncommon", 6500, 100, RGB(255, 235, 240), { "cheeks", "sprout" }, "Squishes on command."),
	-- RARE
	c("sirwobbles", "Sir Wobbles", "Rare", 15000, 200, RGB(170, 190, 230), { "tophat", "mustache" }, "Sophisticated. Slightly tipsy."),
	c("captaincrumb", "Captain Crumb", "Rare", 28000, 360, RGB(220, 170, 110), { "bowtie", "mustache" }, "Commands a fleet of one cracker."),
	c("glitchy", "Glitchy", "Rare", 50000, 620, RGB(60, 255, 200), { "antenna", "spikes" }, "Not a bug. A feature. Probably.", { neon = true }),
	c("discodave", "Disco Dave", "Rare", 85000, 1000, RGB(255, 80, 200), { "sunglasses", "headphones" }, "The party arrives when he does."),
	-- EPIC
	c("toastertom", "Toaster Tom", "Epic", 250000, 2800, RGB(230, 180, 100), { "sunglasses", "spikes" }, "Pops up at the worst times."),
	c("lordsploot", "Lord Sploot", "Epic", 450000, 4800, RGB(110, 60, 170), { "horns", "mustache" }, "Rules the swamp. Loudly."),
	c("turbotaco", "Turbo Taco", "Epic", 800000, 8000, RGB(255, 190, 60), { "sunglasses", "tail", "flame" }, "Delivered in 30 seconds or you get a hug."),
	c("ghostytoast", "Ghosty Toast", "Epic", 1400000, 13000, RGB(240, 240, 255), { "halo", "cheeks" }, "Haunts breakfast tables.", { transparency = 0.25 }),
	-- LEGENDARY
	c("kinggigaglorp", "King Gigaglorp", "Legendary", 5000000, 50000, RGB(70, 200, 90), { "crown", "bigteeth", "sparkles" }, "Ruler of the Slime Throne."),
	c("sushisamurai", "Sushi Samurai", "Legendary", 12000000, 110000, RGB(240, 80, 70), { "horns", "bowtie" }, "Slices the competition. And the rice."),
	c("magmamuffin", "Magma Muffin", "Legendary", 30000000, 260000, RGB(200, 60, 30), { "flame", "spikes" }, "Fresh from the volcano bakery.", { neon = true }),
	-- MYTHIC
	c("cosmiccheeseborger", "Cosmic Cheeseborger", "Mythic", 150000000, 1100000, RGB(255, 215, 60), { "crown", "wings", "sparkles" }, "Born when a burger fell into a black hole."),
	c("voidwaffle", "Void Waffle", "Mythic", 400000000, 2800000, RGB(55, 25, 95), { "horns", "wings", "sparkles" }, "Syrup of the abyss."),
	c("prismaticpickle", "Prismatic Pickle", "Mythic", 1000000000, 6500000, RGB(120, 255, 120), { "halo", "wings", "sparkles", "sunglasses" }, "Too cool to be brined."),
	-- SECRET
	c("thegoober", "THE GOOBER", "Secret", 25000000000, 120000000, RGB(255, 255, 255), { "halo", "crown", "wings", "sparkles", "flame" }, "Nobody believed it existed.", { rainbow = true, scale = 1.1 }),
	c("tsunamoo", "Tsunamoo", "Secret", 100000000000, 450000000, RGB(30, 110, 255), { "crown", "wings", "sparkles" }, "Surfs in on the biggest wave. Only the Tide brings it.", { tideOnly = true, scale = 1.1 }),
}

Config.CreatureById = {} :: { [string]: Creature }
for _, d in Config.Creatures do
	Config.CreatureById[d.id] = d
end

function Config.priceOf(def: Creature, mutName: string?): number
	local m = Config.Mutations[mutName or "Normal"] or Config.Mutations.Normal
	return math.floor(def.price * (0.4 + 0.6 * m.mult))
end

function Config.cpsOf(def: Creature, mutName: string?): number
	local m = Config.Mutations[mutName or "Normal"] or Config.Mutations.Normal
	return def.cps * m.mult
end

----------------------------------------------------------------------
-- Map
----------------------------------------------------------------------
Config.MAP = {
	PLOTS_PER_SIDE = 6,
	PLOT_SPACING = 52,
	PLOT_X = 126, -- absolute X of plot centre
	PLATFORM = Vector3.new(72, 20, 48),
	RAMP_RUN = 44,
	RAMP_WIDTH = 14,
	BELT_HALF_LENGTH = 160,
	BELT_Y = 1,
	WORLD_HALF = 300,
}
Config.MAX_PLAYERS = Config.MAP.PLOTS_PER_SIDE * 2

----------------------------------------------------------------------
-- Belt
----------------------------------------------------------------------
Config.BELT = {
	SPEED = 7, -- studs / second
	SPAWN_EVERY = 2.6,
	SPAWN_EVERY_SURGE = 1.4,
	MAX_ITEMS = 26,
	BUY_HOLD = 0.3,
}

----------------------------------------------------------------------
-- Tide
----------------------------------------------------------------------
Config.TIDE = {
	INTERVAL = 180, -- seconds between waves (first wave comes after INTERVAL_FIRST)
	INTERVAL_FIRST = 75,
	INTERVAL_STUDIO = 30,
	WARNING = 15,
	WAVE_SPEED = 42, -- studs / second
	WAVE_HEIGHT = 24,
	WAVE_THICKNESS = 26,
	WAVE_HALF_WIDTH = 150,
	SAFE_Y = 13, -- standing above this height = safe (plot platforms are at y=20)
	SURGE_SECONDS = 60,
	SURGE_LUCK = 2,
	SURGE_INCOME_MULT = 2,
	BEACH_GOOBERS = 14,
	BEACH_LIFETIME = 50,
	TSUNAMOO_CHANCE = 0.04, -- per tide, a Tsunamoo is washed ashore
	SURVIVOR_BONUS_MINUTES = 2,
}

----------------------------------------------------------------------
-- Gamepasses / Developer products  (REPLACE the 0 ids with yours - see docs/05_LAUNCH_CHECKLIST.md)
----------------------------------------------------------------------
Config.PASSES = {
	Cash2x = { id = 0, name = "2x Cash", desc = "Double ALL income. Forever.", robux = 399, order = 1 },
	AutoCollect = { id = 0, name = "Auto Collect", desc = "Cash goes straight to your wallet. No pad touching!", robux = 249, order = 2 },
	VIP = { id = 0, name = "VIP", desc = "+25% cash, 90s base lock, 6h offline earnings, VIP tag.", robux = 499, order = 3 },
	Luck = { id = 0, name = "Lucky Charm", desc = "2x luck on your Spins, Daily goobers and Beach grabs.", robux = 199, order = 4 },
	Slots4 = { id = 0, name = "+4 Slots", desc = "Four extra goober slots right away.", robux = 299, order = 5 },
}

Config.PRODUCTS = {
	Cash10m = { id = 0, name = "10 Min of Cash", desc = "Instantly get 10 minutes of your income.", robux = 49, order = 1 },
	Cash1h = { id = 0, name = "1 Hour of Cash", desc = "Instantly get 1 hour of your income.", robux = 149, order = 2 },
	Cash6h = { id = 0, name = "6 Hours of Cash", desc = "Instantly get 6 hours of your income.", robux = 499, order = 3 },
	Luck = { id = 0, name = "Server Luck x2 (10m)", desc = "Boost rarity luck for EVERYONE on the server!", robux = 99, order = 4 },
	MegaLuck = { id = 0, name = "Server Luck x4 (5m)", desc = "MEGA luck for the whole server. You're the hero.", robux = 199, order = 5 },
	Shield = { id = 0, name = "Tide Shield x3", desc = "Survive the next 3 waves that sweep you away.", robux = 79, order = 6 },
	LockRefill = { id = 0, name = "Instant Base Lock", desc = "Lock your base NOW (no cooldown).", robux = 39, order = 7 },
	MythicDrop = { id = 0, name = "Summon a Mythic", desc = "A MYTHIC rolls onto the belt, reserved for you for 25s.", robux = 399, order = 8 },
}

----------------------------------------------------------------------
-- Rewards
----------------------------------------------------------------------
-- type: cash (minutes of income, min floor), luck (server luck minutes), shield, goober (min rarity order), lock
Config.DAILY = {
	{ kind = "cash", minutes = 5, floor = 2500, label = "Cash Drop" },
	{ kind = "luck", minutes = 5, label = "Server Luck x2 (5m)" },
	{ kind = "cash", minutes = 15, floor = 15000, label = "Big Cash Drop" },
	{ kind = "shield", amount = 1, label = "Tide Shield" },
	{ kind = "cash", minutes = 45, floor = 100000, label = "Mega Cash Drop" },
	{ kind = "luck", minutes = 15, label = "Server Luck x2 (15m)" },
	{ kind = "goober", minOrder = 3, label = "Free Rare+ Goober!" },
}

Config.SPIN_COOLDOWN = 4 * 3600
Config.SPIN = {
	{ kind = "cash", minutes = 3, floor = 1000, weight = 28, label = "Cash" },
	{ kind = "cash", minutes = 10, floor = 5000, weight = 20, label = "More Cash" },
	{ kind = "luck", minutes = 5, weight = 14, label = "Luck x2 (5m)" },
	{ kind = "shield", amount = 1, weight = 12, label = "Tide Shield" },
	{ kind = "goober", minOrder = 1, maxOrder = 2, weight = 12, label = "Goober!" },
	{ kind = "cash", minutes = 30, floor = 25000, weight = 8, label = "Cash Jackpot" },
	{ kind = "goober", minOrder = 3, maxOrder = 4, weight = 5, label = "Rare Goober!" },
	{ kind = "goober", minOrder = 5, maxOrder = 5, weight = 1, label = "LEGENDARY!" },
}

-- seconds of play time -> reward
Config.GIFTS = {
	{ at = 120, kind = "cash", minutes = 2, floor = 1000 },
	{ at = 300, kind = "cash", minutes = 4, floor = 3000 },
	{ at = 600, kind = "shield", amount = 1 },
	{ at = 900, kind = "cash", minutes = 8, floor = 8000 },
	{ at = 1200, kind = "luck", minutes = 5 },
	{ at = 1800, kind = "cash", minutes = 15, floor = 20000 },
	{ at = 2400, kind = "shield", amount = 1 },
	{ at = 3000, kind = "cash", minutes = 25, floor = 50000 },
	{ at = 3600, kind = "luck", minutes = 10 },
	{ at = 4500, kind = "cash", minutes = 40, floor = 100000 },
	{ at = 5400, kind = "goober", minOrder = 3 },
	{ at = 7200, kind = "cash", minutes = 90, floor = 250000 },
}

Config.CODES = {
	LAUNCH = { kind = "cash", minutes = 10, floor = 25000 },
	TIDE = { kind = "luck", minutes = 10 },
	SPLASH = { kind = "shield", amount = 2 },
	GOOBER = { kind = "cash", minutes = 5, floor = 10000 },
	STEALIT = { kind = "cash", minutes = 8, floor = 50000 },
	HIGGS = { kind = "goober", minOrder = 2 },
	SQUAD = { kind = "cash", minutes = 15, floor = 75000 },
}

----------------------------------------------------------------------
-- Sound hooks. rbxasset:// sounds ship with the Roblox client. Swap for your own SFX ids.
----------------------------------------------------------------------
Config.SOUNDS = {
	buy = "rbxasset://sounds/electronicpingshort.wav",
	collect = "rbxasset://sounds/button.wav",
	reveal = "rbxasset://sounds/victory.wav",
	alarm = "rbxasset://sounds/bass.wav",
	slap = "rbxasset://sounds/impact_water.mp3",
	siren = "rbxasset://sounds/bass.wav",
	swoosh = "rbxasset://sounds/swoosh.wav",
	click = "rbxasset://sounds/clickfast.wav",
}

return Config
