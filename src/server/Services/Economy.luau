-- Income, stash, collecting, slots, rebirth and the snapshot sent to clients.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local State = require(script.Parent.State)

local Economy = {}
local S: any

function Economy.Init(services: any)
	S = services

	-- income tick, once per second
	task.spawn(function()
		local last = os.clock()
		while true do
			task.wait(1)
			local now = os.clock()
			local dt = now - last
			last = now
			for _, ps in State.list() do
				ps.playSeconds += dt
				Economy.Tick(ps, dt)
			end
		end
	end)
end

----------------------------------------------------------------------
-- Multipliers
----------------------------------------------------------------------
function Economy.multiplier(ps: any): number
	local m = Config.rebirthMult(ps.data.rebirths)
	if ps.passes.Cash2x then
		m *= 2
	end
	if ps.passes.VIP then
		m *= 1.25
	end
	if S.Tide and S.Tide.isSurge() then
		m *= Config.TIDE.SURGE_INCOME_MULT
	end
	return m
end

function Economy.entryCps(entry: any): number
	local def = Config.CreatureById[entry.id]
	if not def then
		return 0
	end
	return Config.cpsOf(def, entry.mut)
end

function Economy.totalCps(ps: any): number
	local total = 0
	for _, e in ps.slots do
		if not e.inTransit then
			total += Economy.entryCps(e)
		end
	end
	return total * Economy.multiplier(ps)
end

function Economy.slotsUnlocked(ps: any): number
	local n = Config.BASE_SLOTS + ps.data.slotUpgrades + ps.data.rebirths
	if ps.passes.Slots4 then
		n += 4
	end
	return math.min(n, Config.MAX_SLOTS)
end

function Economy.freeSlot(ps: any): number?
	for i = 1, Economy.slotsUnlocked(ps) do
		if not ps.slots[i] then
			return i
		end
	end
	return nil
end

function Economy.lockDuration(ps: any): number
	return if ps.passes.VIP then Config.LOCK_DURATION_VIP else Config.LOCK_DURATION
end

----------------------------------------------------------------------
-- Cash
----------------------------------------------------------------------
function Economy.addCash(ps: any, amount: number, countAsEarned: boolean?)
	ps.data.cash += amount
	if countAsEarned and amount > 0 then
		ps.data.stats.totalEarned += amount
	end
	S.Data.MarkDirty(ps)
end

function Economy.spend(ps: any, amount: number): boolean
	if ps.data.cash >= amount then
		ps.data.cash -= amount
		S.Data.MarkDirty(ps)
		return true
	end
	return false
end

----------------------------------------------------------------------
-- Income tick
----------------------------------------------------------------------
function Economy.Tick(ps: any, dt: number)
	local mult = Economy.multiplier(ps)
	local autoCollect = ps.passes.AutoCollect
	local changed = false
	for slot, e in ps.slots do
		if not e.inTransit then
			local gain = Economy.entryCps(e) * mult * dt
			if autoCollect then
				ps.data.cash += gain
				ps.data.stats.totalEarned += gain
				changed = true
			else
				local cap = Economy.entryCps(e) * mult * 3600 * Config.STASH_HOURS
				e.stash = math.min((e.stash or 0) + gain, math.max(cap, 1))
				S.Plot.UpdatePad(ps, slot)
			end
		end
	end
	if changed then
		S.Data.MarkDirty(ps)
	end
	S.Plot.UpdateSign(ps)
	if (ps.playSeconds % 5) < dt then
		S.Data.MarkDirty(ps) -- keeps the HUD cps / gift timers fresh
	end
end

function Economy.Collect(ps: any, slot: number): number
	local e = ps.slots[slot]
	if not e or e.inTransit then
		return 0
	end
	local amount = e.stash or 0
	if amount < 1 then
		return 0
	end
	e.stash = 0
	Economy.addCash(ps, amount, true)
	ps.data.stats.collects += 1
	S.Plot.UpdatePad(ps, slot)
	S.Plot.PopCash(ps, slot, amount)
	if not ps.data.tutorial.collected then
		ps.data.tutorial.collected = true
		S.Analytics.step(ps.player, 3, "FirstCollect")
	end
	return amount
end

function Economy.CollectAll(ps: any): number
	local total = 0
	for slot in ps.slots do
		total += Economy.Collect(ps, slot)
	end
	if total > 0 then
		Net.get("Sfx"):FireClient(ps.player, "collect")
	end
	return total
end

----------------------------------------------------------------------
-- Slots / rebirth
----------------------------------------------------------------------
function Economy.UpgradeSlot(ps: any): boolean
	local unlocked = Economy.slotsUnlocked(ps)
	if unlocked >= Config.MAX_SLOTS then
		S.Data.Notify(ps.player, "All slots unlocked!", "info")
		return false
	end
	local cost = Config.slotUpgradeCost(ps.data.slotUpgrades)
	if not Economy.spend(ps, cost) then
		S.Data.Notify(ps.player, "Need " .. Util.money(cost) .. " to unlock a slot", "error")
		return false
	end
	ps.data.slotUpgrades += 1
	S.Plot.RefreshAllPads(ps)
	S.Data.Notify(ps.player, "New slot unlocked!", "good")
	Net.get("Sfx"):FireClient(ps.player, "buy")
	return true
end

function Economy.Rebirth(ps: any): boolean
	local cost = Config.rebirthCost(ps.data.rebirths)
	if ps.data.cash < cost then
		S.Data.Notify(ps.player, "You need " .. Util.money(cost) .. " to Rebirth", "error")
		return false
	end
	if ps.carry then
		S.Data.Notify(ps.player, "Deliver the goober you're carrying first!", "error")
		return false
	end
	for _, e in ps.slots do
		if e.inTransit then
			S.Data.Notify(ps.player, "Wait until your stolen goober is resolved before rebirthing!", "error")
			return false
		end
	end
	ps.data.rebirths += 1
	ps.data.cash = Config.rebirthStartCash(ps.data.rebirths)
	-- keep Mythic+ goobers, repack them into the first slots
	local keep = {}
	for slot = 1, Config.MAX_SLOTS do
		local e = ps.slots[slot]
		if e and not e.inTransit then
			local def = Config.CreatureById[e.id]
			if def and Config.Rarity[def.rarity].order >= 6 then
				table.insert(keep, { id = e.id, mut = e.mut, stash = 0 })
			end
		end
	end
	ps.slots = {}
	for i, e in keep do
		ps.slots[i] = e
	end
	S.Plot.RebuildAll(ps)
	if not ps.data.tutorial.rebirthed then
		ps.data.tutorial.rebirthed = true
		S.Analytics.step(ps.player, 5, "FirstRebirth")
	end
	S.Data.Notify(ps.player, "REBIRTH " .. ps.data.rebirths .. "! Income x" .. Config.rebirthMult(ps.data.rebirths), "good")
	Net.get("Announce"):FireAllClients(ps.player.DisplayName .. " just REBIRTHED (x" .. ps.data.rebirths .. ")!", Color3.fromRGB(255, 120, 255))
	Net.get("Reveal"):FireClient(ps.player, { title = "REBIRTH " .. ps.data.rebirths, name = "Income x" .. Config.rebirthMult(ps.data.rebirths), color = Color3.fromRGB(255, 120, 255), rarity = "Rebirth" })
	S.Data.Save(ps, false)
	S.Data.MarkDirty(ps)
	return true
end

function Economy.OfflineEarnings(ps: any)
	local last = ps.data.lastSeen
	if last <= 0 then
		return
	end
	local elapsed = os.time() - last
	if elapsed < 90 then
		return
	end
	local cap = (if ps.passes.VIP then Config.OFFLINE_MAX_HOURS_VIP else Config.OFFLINE_MAX_HOURS) * 3600
	local gain = Economy.totalCps(ps) * math.min(elapsed, cap) * Config.OFFLINE_RATE
	if gain >= 1 then
		Economy.addCash(ps, gain, true)
		task.delay(3, function()
			if ps.player.Parent then
				S.Data.Notify(ps.player, "Welcome back! Your goobers earned " .. Util.money(gain) .. " while you were away", "good")
			end
		end)
	end
end

----------------------------------------------------------------------
-- Reward helper shared by daily / spin / gifts / codes
----------------------------------------------------------------------
-- Returns a short description string, or nil if the reward could not be given.
function Economy.GrantReward(ps: any, r: any): string?
	local luckMult = if ps.passes.Luck then 2 else 1
	if r.kind == "cash" then
		local amount = math.max(r.floor or 0, Economy.totalCps(ps) * 60 * r.minutes)
		Economy.addCash(ps, amount, true)
		return Util.money(amount)
	elseif r.kind == "luck" then
		S.Rewards.ApplyServerLuck(2, r.minutes, ps.player.DisplayName)
		return "Server Luck x2 for " .. r.minutes .. "m"
	elseif r.kind == "shield" then
		ps.data.shields += r.amount
		S.Data.MarkDirty(ps)
		return r.amount .. " Tide Shield" .. (if r.amount > 1 then "s" else "")
	elseif r.kind == "goober" then
		local slot = Economy.freeSlot(ps)
		if not slot then
			return nil
		end
		local def = S.Belt.rollDef(luckMult, r.minOrder, r.maxOrder)
		if not def then
			return nil
		end
		S.Plot.PlaceNew(ps, slot, def.id, "Normal")
		return def.rarity .. " " .. def.name
	elseif r.kind == "lock" then
		ps.lockReadyAt = 0
		S.Data.MarkDirty(ps)
		return "Base Lock refreshed"
	end
	return nil
end

----------------------------------------------------------------------
-- Snapshot sent to the client
----------------------------------------------------------------------
function Economy.Snapshot(ps: any)
	local d = ps.data
	local now = os.time()
	local serverNow = workspace:GetServerTimeNow()
	local today = now // 86400
	local dailyReady = d.daily.lastDay < today
	local streak = d.daily.streak
	if dailyReady and d.daily.lastDay < today - 1 then
		streak = 0
	end
	local giftsClaimed = {}
	for i in ps.claimedGifts do
		giftsClaimed[i] = true
	end
	local passes = {}
	for k in ps.passes do
		passes[k] = true
	end
	local unlocked = Economy.slotsUnlocked(ps)
	local slotsOwned = {}
	for slot, e in ps.slots do
		slotsOwned[slot] = { id = e.id, mut = e.mut }
	end
	return {
		cash = d.cash,
		cps = Economy.totalCps(ps),
		mult = Economy.multiplier(ps),
		rebirths = d.rebirths,
		rebirthCost = Config.rebirthCost(d.rebirths),
		rebirthMult = Config.rebirthMult(d.rebirths),
		rebirthMultNext = Config.rebirthMult(d.rebirths + 1),
		slotsUnlocked = unlocked,
		slotCost = if unlocked < Config.MAX_SLOTS then Config.slotUpgradeCost(d.slotUpgrades) else nil,
		luck = { mult = State.currentLuck(), endsAt = State.luck.endsAt },
		passes = passes,
		dailyReady = dailyReady,
		dailyStreak = streak,
		spinReady = now - d.spin.last >= Config.SPIN_COOLDOWN,
		spinIn = math.max(0, Config.SPIN_COOLDOWN - (now - d.spin.last)),
		playSeconds = ps.playSeconds,
		giftsClaimed = giftsClaimed,
		discovered = d.discovered,
		discoveredMut = d.discoveredMut,
		owned = slotsOwned,
		stats = d.stats,
		shields = d.shields,
		tutorial = d.tutorial,
		lockReadyAt = ps.lockReadyAt or 0,
		lockUntil = ps.plot and ps.plot.lockedUntil or 0,
		isDirector = S.Director.isDirector(ps.player),
		serverNow = serverNow,
		carrying = ps.carry ~= nil,
	}
end

return Economy
