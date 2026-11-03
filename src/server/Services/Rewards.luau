-- Daily streak, lucky spin, playtime gifts and promo codes.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local State = require(script.Parent.State)

local Rewards = {}
local S: any

local function limited(ps: any, key: string, gap: number): boolean
	local now = os.clock()
	if ps.rl[key] and now - ps.rl[key] < gap then
		return true
	end
	ps.rl[key] = now
	return false
end

-- Server-wide luck. Higher multipliers override lower ones, equal ones stack time.
function Rewards.ApplyServerLuck(mult: number, minutes: number, byName: string?)
	local now = workspace:GetServerTimeNow()
	local L = State.luck
	if now >= L.endsAt or mult > L.mult then
		L.mult = mult
		L.endsAt = now + minutes * 60
	elseif mult == L.mult then
		L.endsAt = math.min(L.endsAt + minutes * 60, now + 3600)
	end
	if byName then
		Net.get("Announce"):FireAllClients(byName .. " boosted SERVER LUCK to x" .. L.mult .. "!", Color3.fromRGB(120, 255, 160))
	end
	for _, ps in State.list() do
		S.Data.MarkDirty(ps)
	end
end

function Rewards.Init(services: any)
	S = services

	Net.get("ClaimDaily").OnServerEvent:Connect(function(player)
		local ps = State.get(player)
		if not ps or limited(ps, "daily", 0.5) then
			return
		end
		local d = ps.data.daily
		local today = os.time() // 86400
		if d.lastDay >= today then
			S.Data.Notify(player, "Already claimed today. Come back tomorrow!", "info")
			return
		end
		local streak = if d.lastDay == today - 1 then d.streak + 1 else 1
		local idx = (streak - 1) % #Config.DAILY + 1
		local desc = S.Economy.GrantReward(ps, Config.DAILY[idx])
		if not desc then
			S.Data.Notify(player, "Free up a slot to claim today's goober!", "error")
			return
		end
		d.lastDay = today
		d.streak = streak
		S.Data.Notify(player, "Day " .. idx .. " reward: " .. desc, "good")
		Net.get("Sfx"):FireClient(player, "reveal")
		S.Data.MarkDirty(ps)
	end)

	Net.get("DoSpin").OnServerEvent:Connect(function(player)
		local ps = State.get(player)
		if not ps or limited(ps, "spin", 0.5) then
			return
		end
		local now = os.time()
		if now - ps.data.spin.last < Config.SPIN_COOLDOWN then
			S.Data.Notify(player, "Next free spin in " .. Util.formatTime(Config.SPIN_COOLDOWN - (now - ps.data.spin.last)), "info")
			return
		end
		local weights = Config.SPIN
		local prize = Util.weightedPick(weights, function(r)
			return r.weight
		end)
		local index = table.find(weights, prize) or 1
		local desc = S.Economy.GrantReward(ps, prize)
		if not desc then
			-- no free slot for a goober prize: pay out cash instead
			desc = S.Economy.GrantReward(ps, { kind = "cash", minutes = 15, floor = 10000 })
		end
		ps.data.spin.last = now
		Net.get("SpinResult"):FireClient(player, index, desc)
		S.Data.MarkDirty(ps)
	end)

	Net.get("ClaimGift").OnServerEvent:Connect(function(player, index)
		local ps = State.get(player)
		if not ps or type(index) ~= "number" or limited(ps, "gift", 0.3) then
			return
		end
		local g = Config.GIFTS[index]
		if not g or ps.claimedGifts[index] or ps.playSeconds < g.at then
			return
		end
		local desc = S.Economy.GrantReward(ps, g)
		if not desc then
			S.Data.Notify(player, "Free up a slot to claim this gift!", "error")
			return
		end
		ps.claimedGifts[index] = true
		S.Data.Notify(player, "Gift: " .. desc, "good")
		Net.get("Sfx"):FireClient(player, "reveal")
		S.Data.MarkDirty(ps)
	end)

	Net.get("Redeem").OnServerEvent:Connect(function(player, code)
		local ps = State.get(player)
		if not ps or type(code) ~= "string" or limited(ps, "code", 1) then
			return
		end
		code = string.upper((string.gsub(code, "%s+", "")))
		local reward = Config.CODES[code]
		if not reward then
			S.Data.Notify(player, "Invalid code", "error")
			return
		end
		if ps.data.codes[code] then
			S.Data.Notify(player, "You already used that code", "error")
			return
		end
		local desc = S.Economy.GrantReward(ps, reward)
		if not desc then
			S.Data.Notify(player, "Free up a slot and try again!", "error")
			return
		end
		ps.data.codes[code] = true
		S.Data.Notify(player, "Code redeemed: " .. desc, "good")
		Net.get("Sfx"):FireClient(player, "reveal")
		S.Data.MarkDirty(ps)
	end)

	-- Plain UI actions
	Net.get("Rebirth").OnServerEvent:Connect(function(player)
		local ps = State.get(player)
		if ps and not limited(ps, "rebirth", 1) then
			S.Economy.Rebirth(ps)
		end
	end)
	Net.get("UseLock").OnServerEvent:Connect(function(player)
		local ps = State.get(player)
		if ps and not limited(ps, "lock", 0.5) then
			S.Plot.UseLock(ps)
		end
	end)
	Net.get("CollectAll").OnServerEvent:Connect(function(player)
		local ps = State.get(player)
		if not ps or limited(ps, "collectall", 0.5) then
			return
		end
		local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
		if ps.plot and hrp and S.Plot.ContainsPosition(ps.plot, hrp.Position) then
			S.Economy.CollectAll(ps)
		else
			S.Data.Notify(player, "Go to your base to collect!", "info")
		end
	end)
	Net.get("UpgradeSlot").OnServerEvent:Connect(function(player)
		local ps = State.get(player)
		if ps and not limited(ps, "upgrade", 0.5) then
			S.Economy.UpgradeSlot(ps)
		end
	end)
end

return Rewards
