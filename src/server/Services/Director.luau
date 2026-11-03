-- "Director mode": a hidden panel (bottom-right button) for the people who record marketing
-- footage. Lets you trigger a Tide, drop a Mythic on the belt, grant cash, etc. on demand.
-- Active for anyone inside Roblox Studio and for the UserIds in Config.DIRECTORS.

local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)
local State = require(script.Parent.State)

local Director = {}
local S: any

function Director.isDirector(player: Player): boolean
	if RunService:IsStudio() then
		return true
	end
	return table.find(Config.DIRECTORS, player.UserId) ~= nil
end

local function defOfRarity(rarity: string)
	local defs = {}
	for _, d in Config.Creatures do
		if d.rarity == rarity then
			table.insert(defs, d)
		end
	end
	return if #defs > 0 then defs[math.random(1, #defs)] else nil
end

function Director.Init(services: any)
	S = services
	Net.get("Director").OnServerEvent:Connect(function(player, cmd, arg)
		if not Director.isDirector(player) or type(cmd) ~= "string" then
			return
		end
		local ps = State.get(player)
		if not ps then
			return
		end
		if cmd == "tide" then
			S.Tide.TriggerNow()
		elseif cmd == "beach" then
			S.Tide.SpawnBeach()
		elseif cmd == "spawn" and type(arg) == "string" then
			local rarity, mut = string.match(arg, "^(%a+):?(%a*)$")
			local def = rarity and defOfRarity(rarity)
			if def then
				S.Belt.Spawn(def, if mut and Config.Mutations[mut] then mut else nil)
			end
		elseif cmd == "cash" and type(arg) == "number" then
			S.Economy.addCash(ps, math.clamp(arg, 0, 1e18), false)
		elseif cmd == "luck" then
			S.Rewards.ApplyServerLuck(4, 5, player.DisplayName)
		elseif cmd == "shield" then
			ps.data.shields += 3
			S.Data.MarkDirty(ps)
		elseif cmd == "slots" then
			ps.data.slotUpgrades = Config.MAX_SLOTS
			S.Plot.RefreshAllPads(ps)
		elseif cmd == "giveSlot" and type(arg) == "string" then
			local id, mut = string.match(arg, "^(%w+):?(%a*)$")
			local slot = S.Economy.freeSlot(ps)
			if id and slot and Config.CreatureById[id] then
				S.Plot.PlaceNew(ps, slot, id, if mut ~= "" and Config.Mutations[mut] then mut else "Normal")
			end
		elseif cmd == "lockrefill" then
			ps.lockReadyAt = 0
			S.Data.MarkDirty(ps)
		end
	end)
end

return Director
