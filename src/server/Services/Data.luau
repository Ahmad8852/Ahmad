-- Persistence: DataStore with session locking (prevents item duplication across servers),
-- autosave, and a throttled snapshot push to the owning client.

local DataStoreService = game:GetService("DataStoreService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local State = require(script.Parent.State)

local Data = {}

local TEMPLATE = {
	version = 1,
	cash = Config.START_CASH,
	rebirths = 0,
	slotUpgrades = 0,
	goobers = {}, -- list of { slot, id, mut, stash }
	discovered = {}, -- [creatureId] = true
	discoveredMut = {}, -- [mutationName] = true
	stats = {
		steals = 0,
		stolen = 0,
		defends = 0,
		bought = 0,
		collects = 0,
		tidesSurvived = 0,
		tidesSwept = 0,
		totalEarned = 0,
		playTime = 0,
		sessions = 0,
	},
	daily = { lastDay = 0, streak = 0 },
	spin = { last = 0 },
	codes = {},
	shields = 0,
	tutorial = { bought = false, collected = false, stole = false, rebirthed = false },
	receipts = {},
	lastSeen = 0,
}

local S: any -- services registry
local store: DataStore? = nil
local dirtyPlayers: { [Player]: boolean } = {}

local function reconcile(target: any, template: any)
	for k, v in template do
		if target[k] == nil then
			target[k] = Util.deepCopy(v)
		elseif type(v) == "table" and type(target[k]) == "table" and next(v) ~= nil then
			reconcile(target[k], v)
		end
	end
end

local function serialize(ps: any)
	local d = ps.data
	local list = {}
	for slot, e in ps.slots do
		table.insert(list, { slot = slot, id = e.id, mut = e.mut, stash = e.stash or 0 })
	end
	d.goobers = list
	d.lastSeen = os.time()
	d.stats.playTime += ps.playSeconds - (ps.playSecondsSaved or 0)
	ps.playSecondsSaved = ps.playSeconds
	return d
end

local function keyFor(player: Player): string
	return "P_" .. player.UserId
end

function Data.Init(services: any)
	S = services
	Net.get("Data") -- ensure exists
	local ok, result = pcall(function()
		return DataStoreService:GetDataStore(Config.DATA_STORE)
	end)
	if ok then
		store = result
	else
		warn("[GooberTide] DataStore unavailable:", result)
	end

	-- flush dirty snapshots to clients at 4 Hz
	task.spawn(function()
		while true do
			task.wait(0.25)
			for player in dirtyPlayers do
				dirtyPlayers[player] = nil
				local ps = State.get(player)
				if ps and player.Parent then
					Data.Push(ps)
				end
			end
		end
	end)

	-- autosave loop (staggered)
	task.spawn(function()
		while true do
			task.wait(Config.AUTOSAVE_SECONDS)
			for _, ps in State.list() do
				task.spawn(Data.Save, ps, false)
				task.wait(0.4)
			end
		end
	end)
end

----------------------------------------------------------------------
-- Load
----------------------------------------------------------------------
function Data.LoadPlayer(player: Player)
	local raw: any = nil
	local ephemeral = false

	if store then
		for attempt = 1, 8 do
			if not player.Parent then
				return nil
			end
			local captured: any = nil
			local ok, err = pcall(function()
				local st = store :: DataStore
				st:UpdateAsync(keyFor(player), function(old)
					old = old or {}
					local lock = old._lock
					if lock and lock.job ~= game.JobId and os.time() - lock.t < Config.SESSION_LOCK_SECONDS then
						return nil -- another server still owns this profile
					end
					old._lock = { job = game.JobId, t = os.time() }
					captured = old
					return old
				end)
			end)
			if ok then
				if captured then
					raw = captured
					break
				end
				task.wait(4) -- locked elsewhere; wait for the other server to release
			else
				local msg = tostring(err)
				if RunService:IsStudio() and (string.find(msg, "StudioAccessToApisNotAllowed") or string.find(msg, "403")) then
					warn("[GooberTide] Studio API access is off - running with temporary data. Enable Game Settings > Security > Enable Studio Access to API Services to test saving.")
					ephemeral = true
					break
				end
				warn("[GooberTide] load failed:", msg)
				task.wait(math.min(2 ^ attempt, 12))
			end
		end
		if not raw and not ephemeral then
			return nil
		end
	else
		ephemeral = true
	end

	local profile = raw or {}
	profile._lock = nil
	reconcile(profile, TEMPLATE)

	local ps: any = {
		player = player,
		data = profile,
		slots = {}, -- [slotIndex] = { id, mut, stash, inTransit? }
		ephemeral = ephemeral,
		passes = {},
		joinedAt = os.clock(),
		playSeconds = 0,
		claimedGifts = {},
		carry = nil,
		plot = nil,
		rl = {},
		loaded = true,
	}
	for _, e in profile.goobers do
		if Config.CreatureById[e.id] and e.slot and e.slot >= 1 and e.slot <= Config.MAX_SLOTS then
			ps.slots[e.slot] = { id = e.id, mut = Config.Mutations[e.mut] and e.mut or "Normal", stash = e.stash or 0 }
		end
	end
	profile.stats.sessions += 1
	State.byPlayer[player] = ps
	return ps
end

----------------------------------------------------------------------
-- Save
----------------------------------------------------------------------
function Data.Save(ps: any, release: boolean): boolean
	if ps.ephemeral or not store then
		return true
	end
	if ps.saving then
		return false
	end
	ps.saving = true
	local snapshot = Util.deepCopy(serialize(ps))
	local success = false
	for attempt = 1, 5 do
		local ok, err = pcall(function()
			local st = store :: DataStore
			st:UpdateAsync(keyFor(ps.player), function(old)
				if old and old._lock and old._lock.job ~= game.JobId and os.time() - old._lock.t < Config.SESSION_LOCK_SECONDS then
					return nil -- we lost the lock; do not overwrite
				end
				snapshot._lock = if release then nil else { job = game.JobId, t = os.time() }
				return snapshot
			end)
		end)
		if ok then
			success = true
			break
		end
		warn("[GooberTide] save failed (" .. attempt .. "):", err)
		task.wait(2 ^ attempt)
	end
	ps.saving = false
	return success
end

-- Remove a leaving player's state and persist it for the last time.
function Data.SaveAndRelease(ps: any)
	State.byPlayer[ps.player] = nil
	dirtyPlayers[ps.player] = nil
	Data.Save(ps, true)
end

function Data.SaveAllOnClose()
	local pending = 0
	for _, ps in State.list() do
		pending += 1
		task.spawn(function()
			State.byPlayer[ps.player] = nil
			Data.Save(ps, true)
			pending -= 1
		end)
	end
	local t = os.clock()
	while pending > 0 and os.clock() - t < 25 do
		task.wait(0.2)
	end
end

----------------------------------------------------------------------
-- Client sync
----------------------------------------------------------------------
function Data.MarkDirty(ps: any)
	dirtyPlayers[ps.player] = true
end

function Data.Push(ps: any)
	if not ps.player.Parent then
		return
	end
	local snap = S.Economy.Snapshot(ps)
	Net.get("Data"):FireClient(ps.player, snap)
end

function Data.Notify(player: Player, text: string, kind: string?)
	Net.get("Notify"):FireClient(player, text, kind or "info")
end

return Data
