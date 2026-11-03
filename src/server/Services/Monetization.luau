-- Game passes + developer products. All Robux ids live in Config.PASSES / Config.PRODUCTS.
-- Purchases are idempotent (receipt ids are stored) and saved before being acknowledged.

local MarketplaceService = game:GetService("MarketplaceService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local State = require(script.Parent.State)

local Monetization = {}
local S: any

function Monetization.LoadPasses(ps: any)
	for name, p in Config.PASSES do
		if p.id > 0 then
			local ok, owns = pcall(function()
				return MarketplaceService:UserOwnsGamePassAsync(ps.player.UserId, p.id)
			end)
			if ok and owns then
				ps.passes[name] = true
			end
		end
	end
end

local function productNameById(id: number): string?
	for name, p in Config.PRODUCTS do
		if p.id == id and id > 0 then
			return name
		end
	end
	return nil
end

local function giveCashMinutes(ps: any, minutes: number, floor: number)
	local amount = math.max(floor, S.Economy.totalCps(ps) * 60 * minutes)
	S.Economy.addCash(ps, amount, true)
	S.Data.Notify(ps.player, "+" .. Util.money(amount) .. " added!", "good")
end

local HANDLERS: { [string]: (ps: any) -> boolean } = {
	Cash10m = function(ps)
		giveCashMinutes(ps, 10, 5000)
		return true
	end,
	Cash1h = function(ps)
		giveCashMinutes(ps, 60, 40000)
		return true
	end,
	Cash6h = function(ps)
		giveCashMinutes(ps, 360, 250000)
		return true
	end,
	Luck = function(ps)
		S.Rewards.ApplyServerLuck(2, 10, ps.player.DisplayName)
		return true
	end,
	MegaLuck = function(ps)
		S.Rewards.ApplyServerLuck(4, 5, ps.player.DisplayName)
		return true
	end,
	Shield = function(ps)
		ps.data.shields += 3
		S.Data.Notify(ps.player, "+3 Tide Shields!", "good")
		S.Data.MarkDirty(ps)
		return true
	end,
	LockRefill = function(ps)
		ps.lockReadyAt = 0
		S.Plot.UseLock(ps, true)
		return true
	end,
	MythicDrop = function(ps)
		local defs = {}
		for _, d in Config.Creatures do
			if d.rarity == "Mythic" then
				table.insert(defs, d)
			end
		end
		local def = defs[math.random(1, #defs)]
		S.Belt.Spawn(def, nil, ps.player.UserId)
		Net.get("Announce"):FireAllClients(ps.player.DisplayName .. " SUMMONED A MYTHIC!", Config.Rarity.Mythic.color)
		return true
	end,
}

function Monetization.Grant(ps: any, productName: string): boolean
	local h = HANDLERS[productName]
	return h ~= nil and h(ps)
end

function Monetization.Init(services: any)
	S = services

	MarketplaceService.PromptGamePassPurchaseFinished:Connect(function(player, passId, purchased)
		if not purchased then
			return
		end
		local ps = State.get(player)
		if not ps then
			return
		end
		for name, p in Config.PASSES do
			if p.id == passId then
				ps.passes[name] = true
				S.Data.Notify(player, "Thank you! " .. p.name .. " unlocked!", "good")
				S.Plot.RefreshAllPads(ps)
				S.Plot.UpdateSign(ps, true)
				S.Data.MarkDirty(ps)
			end
		end
	end)

	MarketplaceService.ProcessReceipt = function(info)
		local player = Players:GetPlayerByUserId(info.PlayerId)
		if not player then
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		local ps = State.get(player)
		local t = 0
		while not ps and t < 10 and player.Parent do
			task.wait(0.5)
			t += 0.5
			ps = State.get(player)
		end
		if not ps then
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		local rid = tostring(info.PurchaseId)
		if table.find(ps.data.receipts, rid) then
			return Enum.ProductPurchaseDecision.PurchaseGranted
		end
		local name = productNameById(info.ProductId)
		if not name or not Monetization.Grant(ps, name) then
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		table.insert(ps.data.receipts, rid)
		if #ps.data.receipts > 60 then
			table.remove(ps.data.receipts, 1)
		end
		if not S.Data.Save(ps, false) then
			-- could not persist: roll back the receipt so Roblox retries
			table.remove(ps.data.receipts)
			return Enum.ProductPurchaseDecision.NotProcessedYet
		end
		return Enum.ProductPurchaseDecision.PurchaseGranted
	end
end

return Monetization
