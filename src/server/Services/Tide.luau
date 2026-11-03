-- THE TIDE. Every few minutes a siren sounds, the sky turns, and a giant wave sweeps through the
-- plaza. Anyone caught below the safe height is swept away (and drops any stolen goober).
-- After the wave: Tide Surge - 2x income, faster belt, Tidal mutations and free washed-up goobers.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local Factory = require(Shared.GooberFactory)
local State = require(script.Parent.State)
local Tags = require(script.Parent.Tags)

local Tide = {}
local S: any

local T = Config.TIDE
local stateName = "Idle"
local stateEndsAt = 0
local surgeUntil = 0
local forceNow = false
local beachFolder: Folder
local flood: Part
local wave: Part?

function Tide.isSurge(): boolean
	return workspace:GetServerTimeNow() < surgeUntil
end

function Tide.TriggerNow()
	if stateName == "Idle" then
		forceNow = true
	end
end

local function setState(name: string, duration: number)
	stateName = name
	stateEndsAt = workspace:GetServerTimeNow() + duration
	Net.get("TideState"):FireAllClients(name, stateEndsAt)
end

function Tide.SendTo(player: Player)
	Net.get("TideState"):FireClient(player, stateName, stateEndsAt)
end

----------------------------------------------------------------------
-- Lighting moods
----------------------------------------------------------------------
local function mood(name: string, t: number)
	local atmosphere = Lighting:FindFirstChildOfClass("Atmosphere")
	local goals: { [string]: any }
	local atmGoals: { [string]: any }
	if name == "Warning" then
		goals = { ClockTime = 18.2, Brightness = 1.4, OutdoorAmbient = Color3.fromRGB(110, 70, 90) }
		atmGoals = { Color = Color3.fromRGB(190, 110, 110), Density = 0.5, Haze = 2.2 }
	elseif name == "Surge" then
		goals = { ClockTime = 16.2, Brightness = 3.2, OutdoorAmbient = Color3.fromRGB(150, 200, 255) }
		atmGoals = { Color = Color3.fromRGB(190, 225, 255), Density = 0.25, Haze = 0.4 }
	else
		goals = { ClockTime = 14.5, Brightness = 2.6, OutdoorAmbient = Color3.fromRGB(140, 170, 190) }
		atmGoals = { Color = Color3.fromRGB(199, 225, 255), Density = 0.3, Haze = 1.0 }
	end
	TweenService:Create(Lighting, TweenInfo.new(t), goals):Play()
	if atmosphere then
		TweenService:Create(atmosphere, TweenInfo.new(t), atmGoals):Play()
	end
end

----------------------------------------------------------------------
-- Wave
----------------------------------------------------------------------
local function makeWave(): Part
	local w = Instance.new("Part")
	w.Name = "TideWave"
	w.Anchored = true
	w.CanCollide = false
	w.CanQuery = false
	w.CanTouch = false
	w.Material = Enum.Material.Glass
	w.Color = Color3.fromRGB(30, 140, 255)
	w.Transparency = 0.35
	w.Size = Vector3.new(T.WAVE_HALF_WIDTH * 2, T.WAVE_HEIGHT, T.WAVE_THICKNESS)

	local foam = Instance.new("Part")
	foam.Name = "Foam"
	foam.CanCollide = false
	foam.CanQuery = false
	foam.CanTouch = false
	foam.Massless = true
	foam.Material = Enum.Material.Neon
	foam.Color = Color3.fromRGB(235, 250, 255)
	foam.Transparency = 0.15
	foam.Size = Vector3.new(T.WAVE_HALF_WIDTH * 2, 4, T.WAVE_THICKNESS + 6)
	foam.CFrame = CFrame.new(0, T.WAVE_HEIGHT / 2, 0)
	foam.Parent = w
	local weld = Instance.new("WeldConstraint")
	weld.Part0 = w
	weld.Part1 = foam
	weld.Parent = foam

	local spray = Instance.new("ParticleEmitter")
	spray.Rate = 160
	spray.Lifetime = NumberRange.new(1, 2)
	spray.Speed = NumberRange.new(10, 22)
	spray.SpreadAngle = Vector2.new(50, 50)
	spray.EmissionDirection = Enum.NormalId.Top
	spray.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 3), NumberSequenceKeypoint.new(1, 0) })
	spray.Transparency = NumberSequence.new(0.2, 1)
	spray.LightEmission = 0.5
	spray.Color = ColorSequence.new(Color3.fromRGB(230, 248, 255))
	spray.Parent = foam
	return w
end

local function sweep(ps: any, wz: number)
	local player: Player = ps.player
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum or hum.Health <= 0 then
		return
	end
	if (ps.shieldedUntil or 0) > os.clock() then
		return
	end
	if ps.data.shields > 0 then
		ps.data.shields -= 1
		ps.shieldedUntil = os.clock() + 5
		S.Data.Notify(player, "TIDE SHIELD saved you! (" .. ps.data.shields .. " left)", "good")
		Net.get("Knock"):FireClient(player, Vector3.new(0, 55, 28))
		S.Data.MarkDirty(ps)
		return
	end
	ps.swept = true
	ps.data.stats.tidesSwept += 1
	Net.get("Knock"):FireClient(player, Vector3.new(0, 70, 95))
	S.Data.Notify(player, "SWEPT AWAY BY THE TIDE!", "error")
	task.delay(0.45, function()
		local h = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if h and h.Health > 0 then
			h.Health = 0
		end
	end)
end

local function runWave()
	local half = Config.MAP.WORLD_HALF - 24
	local w = makeWave()
	wave = w
	local startZ, endZ = -half, half
	w.CFrame = CFrame.new(0, T.WAVE_HEIGHT / 2, startZ)
	w.Parent = workspace

	local travel = (endZ - startZ) / T.WAVE_SPEED
	setState("Wave", travel)
	for _, ps in State.list() do
		ps.swept = false
	end
	local tween = TweenService:Create(w, TweenInfo.new(travel, Enum.EasingStyle.Linear), { CFrame = CFrame.new(0, T.WAVE_HEIGHT / 2, endZ) })
	tween:Play()
	Net.get("Shake"):FireAllClients(0.5, travel)

	local conn
	conn = RunService.Heartbeat:Connect(function()
		local wz = w.Position.Z
		for _, ps in State.list() do
			if not ps.swept then
				local hrp = ps.player.Character and ps.player.Character:FindFirstChild("HumanoidRootPart") :: BasePart?
				if hrp then
					local p = hrp.Position
					if math.abs(p.X) <= T.WAVE_HALF_WIDTH + 4 and math.abs(p.Z - wz) <= T.WAVE_THICKNESS / 2 + 3 and p.Y < T.SAFE_Y then
						sweep(ps, wz)
					end
				end
			end
		end
	end)
	tween.Completed:Wait()
	conn:Disconnect()
	w:Destroy()
	wave = nil
end

----------------------------------------------------------------------
-- Beach goobers (free, washed up after the wave)
----------------------------------------------------------------------
local function grab(player: Player, model: Model, mutName: string, defId: string)
	if not model.Parent then
		return
	end
	local ps = State.get(player)
	if not ps then
		return
	end
	local slot = S.Economy.freeSlot(ps)
	if not slot then
		S.Data.Notify(player, "No free slot! Make room and grab another!", "error")
		return
	end
	local def = Config.CreatureById[defId]
	local pos = model.PrimaryPart.Position
	model:Destroy()
	S.Belt.Poof(pos + Vector3.new(0, 2, 0), Config.Rarity[def.rarity].color)
	S.Plot.PlaceNew(ps, slot, defId, mutName)
	Net.get("Sfx"):FireClient(player, "reveal")
	local rar = Config.Rarity[def.rarity]
	S.Data.Notify(player, "Caught a " .. mutName .. " " .. def.name .. "!", "good")
	if rar.order >= 4 then
		Net.get("Reveal"):FireClient(player, {
			title = "WASHED ASHORE!",
			name = mutName .. " " .. def.name,
			color = rar.color,
			rarity = def.rarity,
			cps = Config.cpsOf(def, mutName),
		})
	end
	if rar.order >= 5 then
		Net.get("Announce"):FireAllClients(player.DisplayName .. " caught a " .. string.upper(def.rarity) .. " " .. def.name .. " on the beach!!", rar.color)
	end
end

local function spawnBeachGoober(def: any, mutName: string, position: Vector3)
	local model = Factory.build(def, mutName)
	local off = model:GetAttribute("GroundOffset") or 2
	model:PivotTo(CFrame.new(position + Vector3.new(0, off + 0.2, 0)) * CFrame.Angles(0, math.random() * math.pi * 2, 0))
	model.Parent = beachFolder
	local body = model.PrimaryPart :: BasePart
	Tags.goober(body, def, mutName, false)

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "GRAB (FREE)"
	prompt.ObjectText = mutName .. " " .. def.name
	prompt.HoldDuration = 0.25
	prompt.MaxActivationDistance = 12
	prompt.RequiresLineOfSight = false
	prompt.Parent = body
	prompt.Triggered:Connect(function(player)
		grab(player, model, mutName, def.id)
	end)
	Debris:AddItem(model, T.BEACH_LIFETIME)
	return model
end

function Tide.SpawnBeach()
	local luck = math.max(2, State.currentLuck())
	for _ = 1, T.BEACH_GOOBERS do
		local def = S.Belt.rollDef(luck, 1, 6)
		if def then
			local pos = Vector3.new(math.random(-70, 70), 0, math.random(-140, 140))
			spawnBeachGoober(def, "Tidal", pos)
		end
	end
	if math.random() < T.TSUNAMOO_CHANCE or Tide.forceTsunamoo then
		Tide.forceTsunamoo = false
		spawnBeachGoober(Config.CreatureById.tsunamoo, "Tidal", Vector3.new(math.random(-30, 30), 0, math.random(-60, 60)))
		Net.get("Announce"):FireAllClients("THE TSUNAMOO WASHED ASHORE!!! GRAB IT!!!", Config.Rarity.Secret.color)
		Net.get("Shake"):FireAllClients(0.7, 2.5)
	end
end

----------------------------------------------------------------------
-- Main loop
----------------------------------------------------------------------
local function runCycle()
	-- warning
	setState("Warning", T.WARNING)
	mood("Warning", T.WARNING)
	Net.get("Announce"):FireAllClients("THE TIDE IS COMING! Get to HIGH GROUND!", Color3.fromRGB(255, 90, 90))
	Net.get("Sfx"):FireAllClients("siren")
	local warnEnd = os.clock() + T.WARNING
	while os.clock() < warnEnd do
		Net.get("Shake"):FireAllClients(0.12, 1)
		task.wait(1)
	end

	-- wave
	runWave()

	-- survivors
	for _, ps in State.list() do
		if not ps.swept then
			ps.data.stats.tidesSurvived += 1
			local bonus = S.Economy.totalCps(ps) * 60 * T.SURVIVOR_BONUS_MINUTES
			if bonus >= 1 then
				S.Economy.addCash(ps, bonus, true)
				S.Data.Notify(ps.player, "TIDE SURVIVOR! +" .. Util.money(bonus), "good")
			end
		end
	end

	-- surge
	surgeUntil = workspace:GetServerTimeNow() + T.SURGE_SECONDS
	State.luck.mult = math.max(State.currentLuck(), T.SURGE_LUCK)
	State.luck.endsAt = math.max(State.luck.endsAt, surgeUntil)
	setState("Surge", T.SURGE_SECONDS)
	mood("Surge", 4)
	Net.get("Announce"):FireAllClients("TIDE SURGE! 2x income, extra luck & free goobers on the beach!", Color3.fromRGB(80, 220, 255))
	flood.Transparency = 0.55
	TweenService:Create(flood, TweenInfo.new(T.SURGE_SECONDS, Enum.EasingStyle.Quad), { Transparency = 1 }):Play()
	Tide.SpawnBeach()
	for _, ps in State.list() do
		S.Data.MarkDirty(ps)
	end
	task.wait(T.SURGE_SECONDS)
end

function Tide.Init(services: any)
	S = services
	beachFolder = Instance.new("Folder")
	beachFolder.Name = "Beach"
	beachFolder.Parent = workspace

	flood = Instance.new("Part")
	flood.Name = "Flood"
	flood.Anchored = true
	flood.CanCollide = false
	flood.CanQuery = false
	flood.CanTouch = false
	flood.Material = Enum.Material.Glass
	flood.Color = Color3.fromRGB(60, 170, 255)
	flood.Transparency = 1
	flood.Size = Vector3.new(190, 0.4, Config.MAP.BELT_HALF_LENGTH * 2 + 60)
	flood.Position = Vector3.new(0, 0.3, 0)
	flood.Parent = workspace

	task.spawn(function()
		local first = true
		while true do
			local wait_ = if RunService:IsStudio() then T.INTERVAL_STUDIO elseif first then T.INTERVAL_FIRST else T.INTERVAL
			first = false
			setState("Idle", wait_)
			mood("Idle", 3)
			local untilT = os.clock() + wait_
			while os.clock() < untilT and not forceNow do
				task.wait(0.5)
				if #State.list() == 0 then
					untilT += 0.5 -- the tide never comes for an empty server
				end
			end
			forceNow = false
			runCycle()
		end
	end)
end

return Tide
