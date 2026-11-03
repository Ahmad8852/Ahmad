-- The Goober Belt: a shared conveyor in the plaza that rolls random goobers past the players.
-- Hold E next to a goober to buy it with cash; it flies into your next free slot.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local Factory = require(Shared.GooberFactory)
local State = require(script.Parent.State)
local Tags = require(script.Parent.Tags)

local Belt = {}
local S: any
local items: { [Model]: any } = {}
local itemCount = 0
local beltFolder: Folder
local forceNext: { any } = {} -- queue of {def, mut, reservedFor}

----------------------------------------------------------------------
-- Rolling
----------------------------------------------------------------------
-- luck multiplies the weight of Rare+ rarities. min/max order restrict the rarity band.
function Belt.rollDef(luck: number?, minOrder: number?, maxOrder: number?, allowTideOnly: boolean?)
	luck = luck or 1
	local pool = {}
	for _, r in Config.Rarities do
		if (not minOrder or r.order >= minOrder) and (not maxOrder or r.order <= maxOrder) then
			table.insert(pool, r)
		end
	end
	local rar = Util.weightedPick(pool, function(r)
		return r.weight * (if r.order >= 3 then luck else 1)
	end)
	if not rar then
		return nil
	end
	local defs = {}
	for _, d in Config.Creatures do
		if d.rarity == rar.name and (allowTideOnly or not d.tideOnly) then
			table.insert(defs, d)
		end
	end
	if #defs == 0 then
		return nil
	end
	return defs[math.random(1, #defs)]
end

function Belt.rollMutation(surge: boolean?): string
	local table_ = if surge then Config.MutationRollSurge else Config.MutationRoll
	local roll = math.random() * 100
	for _, row in table_ do
		roll -= row[2]
		if roll <= 0 then
			return row[1]
		end
	end
	return "Normal"
end

----------------------------------------------------------------------
-- Effects
----------------------------------------------------------------------
function Belt.Poof(position: Vector3, color: Color3, amount: number?)
	local p = Instance.new("Part")
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.Transparency = 1
	p.Size = Vector3.one
	p.Position = position
	local e = Instance.new("ParticleEmitter")
	e.Texture = "rbxasset://textures/particles/sparkles_main.dds"
	e.Color = ColorSequence.new(color)
	e.Lifetime = NumberRange.new(0.5, 1)
	e.Speed = NumberRange.new(14, 26)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.6), NumberSequenceKeypoint.new(1, 0) })
	e.LightEmission = 1
	e.Rate = 0
	e.Parent = p
	p.Parent = workspace
	e:Emit(amount or 28)
	Debris:AddItem(p, 1.5)
end

----------------------------------------------------------------------
-- Spawning
----------------------------------------------------------------------
function Belt.Spawn(def: any?, mut: string?, reservedFor: number?)
	local surge = S.Tide.isSurge()
	def = def or Belt.rollDef(State.currentLuck())
	if not def then
		return
	end
	mut = mut or Belt.rollMutation(surge)

	local model = Factory.build(def, mut)
	local off = model:GetAttribute("GroundOffset") or 2
	local H = Config.MAP.BELT_HALF_LENGTH
	local y = Config.MAP.BELT_Y + 0.5 + off
	local startCF = CFrame.new(0, y, -H)
	local endCF = CFrame.new(0, y, H + 6)
	local body = model.PrimaryPart :: BasePart
	model:PivotTo(CFrame.lookAt(startCF.Position, startCF.Position + Vector3.new(0, 0, 1)))
	model.Parent = beltFolder

	local price = Config.priceOf(def, mut)
	Tags.goober(body, def, mut, true)

	local item: any = { model = model, root = body, def = def, mut = mut, price = price, sold = false }
	if reservedFor then
		item.reservedFor = reservedFor
		item.reservedUntil = workspace:GetServerTimeNow() + 25
	end

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Buy " .. Util.money(price)
	prompt.ObjectText = (if mut ~= "Normal" then mut .. " " else "") .. def.name
	prompt.HoldDuration = Config.BELT.BUY_HOLD
	prompt.MaxActivationDistance = 13
	prompt.RequiresLineOfSight = false
	prompt.Parent = body
	prompt.Triggered:Connect(function(player)
		Belt.TryBuy(player, item)
	end)

	local dist = (endCF.Position - startCF.Position).Magnitude
	local lookAtCF = CFrame.lookAt(endCF.Position, endCF.Position + Vector3.new(0, 0, 1))
	local tween = TweenService:Create(body, TweenInfo.new(dist / Config.BELT.SPEED, Enum.EasingStyle.Linear), { CFrame = lookAtCF })
	item.tween = tween
	items[model] = item
	itemCount += 1
	tween.Completed:Connect(function(state)
		if state == Enum.PlaybackState.Completed and model.Parent then
			Belt.Remove(item)
		end
	end)
	tween:Play()

	local rar = Config.Rarity[def.rarity]
	if rar.order >= 5 then
		Net.get("Announce"):FireAllClients(
			"A " .. string.upper(def.rarity) .. " " .. (if mut ~= "Normal" then mut .. " " else "") .. def.name .. " is rolling down the belt!",
			rar.color
		)
		Net.get("Shake"):FireAllClients(0.25, 0.6)
	end
	return item
end

function Belt.Remove(item: any)
	if items[item.model] then
		items[item.model] = nil
		itemCount -= 1
	end
	if item.tween then
		item.tween:Cancel()
	end
	if item.model.Parent then
		item.model:Destroy()
	end
end

-- Used by the Director panel and the "Summon a Mythic" product.
function Belt.QueueSpecial(def: any, mut: string?, reservedFor: number?)
	table.insert(forceNext, { def = def, mut = mut, reservedFor = reservedFor })
end

----------------------------------------------------------------------
-- Buying
----------------------------------------------------------------------
function Belt.TryBuy(player: Player, item: any)
	local ps = State.get(player)
	if not ps or item.sold or not item.model.Parent then
		return
	end
	if ps.rl.buy and os.clock() - ps.rl.buy < 0.15 then
		return
	end
	ps.rl.buy = os.clock()

	if item.reservedFor and item.reservedFor ~= player.UserId and workspace:GetServerTimeNow() < item.reservedUntil then
		S.Data.Notify(player, "Reserved for someone else for a few more seconds!", "error")
		return
	end
	local hrp = player.Character and player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
	if not hrp or (hrp.Position - item.root.Position).Magnitude > 30 then
		return
	end
	local slot = S.Economy.freeSlot(ps)
	if not slot then
		S.Data.Notify(player, "Your base is full! Unlock a slot or Rebirth.", "error")
		return
	end
	if not S.Economy.spend(ps, item.price) then
		S.Data.Notify(player, "Not enough cash! Need " .. Util.money(item.price), "error")
		return
	end

	item.sold = true
	local def, mut = item.def, item.mut
	local pos = item.root.Position
	Belt.Remove(item)
	Belt.Poof(pos + Vector3.new(0, 2, 0), Config.Rarity[def.rarity].color)

	S.Plot.PlaceNew(ps, slot, def.id, mut)
	ps.data.stats.bought += 1
	if not ps.data.tutorial.bought then
		ps.data.tutorial.bought = true
		S.Analytics.step(player, 2, "FirstBuy")
	end
	Net.get("Sfx"):FireClient(player, "buy")

	local rar = Config.Rarity[def.rarity]
	if rar.order >= 4 then
		Net.get("Reveal"):FireClient(player, {
			title = string.upper(def.rarity) .. "!",
			name = (if mut ~= "Normal" then mut .. " " else "") .. def.name,
			color = rar.color,
			rarity = def.rarity,
			cps = Config.cpsOf(def, mut),
		})
	end
	if rar.order >= 5 then
		Net.get("Announce"):FireAllClients(
			player.DisplayName .. " bought a " .. string.upper(def.rarity) .. " " .. (if mut ~= "Normal" then mut .. " " else "") .. def.name .. "!!",
			rar.color
		)
		ps.data.stats.legendaryFound = (ps.data.stats.legendaryFound or 0) + 1
	end
end

----------------------------------------------------------------------
-- Init
----------------------------------------------------------------------
function Belt.Init(services: any)
	S = services
	beltFolder = Instance.new("Folder")
	beltFolder.Name = "Belt"
	beltFolder.Parent = workspace

	task.spawn(function()
		while true do
			local surge = S.Tide.isSurge()
			task.wait(if surge then Config.BELT.SPAWN_EVERY_SURGE else Config.BELT.SPAWN_EVERY)
			if #State.list() > 0 then
				local forced = table.remove(forceNext, 1)
				if forced then
					Belt.Spawn(forced.def, forced.mut, forced.reservedFor)
				elseif itemCount < Config.BELT.MAX_ITEMS then
					Belt.Spawn()
				end
			end
		end
	end)
end

return Belt
