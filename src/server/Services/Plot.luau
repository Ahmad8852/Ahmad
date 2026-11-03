-- Builds the 12 raised player bases ("plots") and manages everything that lives on them:
-- pads, goober models, stash labels, steal prompts, the base lock and the owner sign.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local CollectionService = game:GetService("CollectionService")
local TweenService = game:GetService("TweenService")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local Factory = require(Shared.GooberFactory)
local State = require(script.Parent.State)
local Tags = require(script.Parent.Tags)

local Plot = {}
local S: any

local M = Config.MAP
local PLATFORM = M.PLATFORM
local PAD_COLS = 6
local ROW_Z = { -5.5, 5.5, -16.5, 16.5 } -- local Z of pad rows (centre rows first)
local PAD_COL_SPACING = 10.4

local PLATFORM_COLORS = {
	Color3.fromRGB(255, 154, 162),
	Color3.fromRGB(255, 218, 140),
	Color3.fromRGB(150, 230, 170),
	Color3.fromRGB(150, 205, 255),
	Color3.fromRGB(204, 170, 255),
	Color3.fromRGB(255, 170, 220),
}

Plot.plots = {} :: { any }
local plotsFolder: Folder

local function padLocalCF(slot: number): CFrame
	local i = slot - 1
	local col = i % PAD_COLS
	local row = i // PAD_COLS
	local x = 26 - col * PAD_COL_SPACING
	return CFrame.new(x, PLATFORM.Y + 0.3, ROW_Z[row + 1])
end

----------------------------------------------------------------------
-- Construction
----------------------------------------------------------------------
local function buildPlot(index: number)
	local PER = M.PLOTS_PER_SIDE
	local west = index <= PER
	local k = (index - 1) % PER
	local cz = -((PER - 1) / 2) * M.PLOT_SPACING + k * M.PLOT_SPACING
	local cx = if west then -M.PLOT_X else M.PLOT_X
	local cf = CFrame.new(cx, 0, cz) * (if west then CFrame.identity else CFrame.Angles(0, math.pi, 0))
	local color = PLATFORM_COLORS[(index - 1) % #PLATFORM_COLORS + 1]

	local model = Instance.new("Model")
	model.Name = "Plot" .. index
	model:SetAttribute("Index", index)
	model.Parent = plotsFolder

	local function mk(props: { [string]: any }, localCF: CFrame): Part
		local p = Instance.new("Part")
		p.Anchored = true
		p.TopSurface = Enum.SurfaceType.Smooth
		p.BottomSurface = Enum.SurfaceType.Smooth
		for key, v in props do
			(p :: any)[key] = v
		end
		p.CFrame = cf * localCF
		p.Parent = model
		return p
	end

	local plot: any = {
		index = index,
		cf = cf,
		model = model,
		owner = nil,
		pads = {},
		padLabels = {},
		padPrompts = {},
		models = {},
		stealPrompts = {},
		lockedUntil = 0,
		lockToken = 0,
	}

	-- platform
	mk({ Name = "Platform", Size = PLATFORM, Color = color, Material = Enum.Material.SmoothPlastic }, CFrame.new(0, PLATFORM.Y / 2, 0))
	mk({ Name = "Trim", Size = Vector3.new(PLATFORM.X + 1, 1, PLATFORM.Z + 1), Color = Color3.fromRGB(255, 255, 255), Material = Enum.Material.Neon, Transparency = 0.2 }, CFrame.new(0, PLATFORM.Y - 0.2, 0))
	mk({ Name = "Floor", Size = Vector3.new(PLATFORM.X - 2, 0.2, PLATFORM.Z - 2), Color = Color3.fromRGB(245, 245, 250), Material = Enum.Material.Marble }, CFrame.new(0, PLATFORM.Y + 0.05, 0))

	-- ramp down to the plaza
	local half = PLATFORM.X / 2
	local run = M.RAMP_RUN
	local ang = math.atan2(PLATFORM.Y, run)
	local len = math.sqrt(PLATFORM.Y ^ 2 + run ^ 2)
	mk(
		{ Name = "Ramp", Size = Vector3.new(len, 1, M.RAMP_WIDTH), Color = Color3.fromRGB(235, 235, 245), Material = Enum.Material.Concrete },
		CFrame.new(half + run / 2 - 0.2, PLATFORM.Y / 2 - 0.45, 0) * CFrame.Angles(0, 0, -ang)
	)
	for _, sz in { -1, 1 } do
		mk(
			{ Name = "RampRail", Size = Vector3.new(len, 0.5, 0.6), Color = Color3.fromRGB(255, 255, 255), Material = Enum.Material.Neon, Transparency = 0.3 },
			CFrame.new(half + run / 2 - 0.2, PLATFORM.Y / 2 + 0.15, sz * (M.RAMP_WIDTH / 2)) * CFrame.Angles(0, 0, -ang)
		)
	end

	-- invisible walls so nobody falls off by accident
	local wallH = 14
	local function wall(size: Vector3, lcf: CFrame)
		mk({ Name = "Wall", Size = size, Transparency = 1, CanQuery = false, CanTouch = false }, lcf)
	end
	local wy = PLATFORM.Y + wallH / 2
	wall(Vector3.new(1, wallH, PLATFORM.Z + 2), CFrame.new(-half - 0.5, wy, 0))
	wall(Vector3.new(PLATFORM.X + 2, wallH, 1), CFrame.new(0, wy, PLATFORM.Z / 2 + 0.5))
	wall(Vector3.new(PLATFORM.X + 2, wallH, 1), CFrame.new(0, wy, -PLATFORM.Z / 2 - 0.5))
	local sideLen = (PLATFORM.Z - M.RAMP_WIDTH) / 2
	for _, sz in { -1, 1 } do
		wall(Vector3.new(1, wallH, sideLen), CFrame.new(half + 0.5, wy, sz * (M.RAMP_WIDTH / 2 + sideLen / 2)))
	end

	-- spawn
	local spawn = Instance.new("SpawnLocation")
	spawn.Name = "Spawn"
	spawn.Size = Vector3.new(6, 1, 6)
	spawn.Anchored = true
	spawn.Neutral = true
	spawn.Duration = 0
	spawn.Transparency = 1
	spawn.CanCollide = false
	spawn.CanQuery = false
	spawn.CFrame = cf * CFrame.new(-half + 4, PLATFORM.Y + 0.6, 0) * CFrame.Angles(0, math.rad(-90), 0)
	spawn.Parent = model
	plot.spawn = spawn

	-- pads
	for slot = 1, Config.MAX_SLOTS do
		local lcf = padLocalCF(slot)
		local pad = mk({ Name = "Pad" .. slot, Size = Vector3.new(7, 0.6, 7), Color = Color3.fromRGB(60, 190, 170), Material = Enum.Material.SmoothPlastic }, lcf)
		pad:SetAttribute("Slot", slot)
		plot.pads[slot] = pad

		local gui = Instance.new("BillboardGui")
		gui.Name = "PadLabel"
		gui.Size = UDim2.fromOffset(130, 38)
		gui.StudsOffsetWorldSpace = cf.XVector * 4.3 + Vector3.new(0, 1.2, 0)
		gui.MaxDistance = 48
		gui.LightInfluence = 0
		gui.Adornee = pad
		gui.Parent = pad
		local lbl = Instance.new("TextLabel")
		lbl.Name = "Text"
		lbl.Size = UDim2.fromScale(1, 1)
		lbl.BackgroundTransparency = 1
		lbl.TextScaled = true
		lbl.Font = Enum.Font.FredokaOne
		lbl.TextStrokeTransparency = 0
		lbl.Text = ""
		lbl.Parent = gui
		plot.padLabels[slot] = lbl
	end

	-- lock console + siren
	local console = mk({ Name = "Console", Size = Vector3.new(3, 3, 3), Color = Color3.fromRGB(40, 45, 70), Material = Enum.Material.Metal }, CFrame.new(half - 2.5, PLATFORM.Y + 1.5, -11))
	local siren = mk({ Name = "Siren", Shape = Enum.PartType.Ball, Size = Vector3.new(1.6, 1.6, 1.6), Color = Color3.fromRGB(80, 255, 140), Material = Enum.Material.Neon }, CFrame.new(half - 2.5, PLATFORM.Y + 3.6, -11))
	plot.siren = siren
	local lockPrompt = Instance.new("ProximityPrompt")
	lockPrompt.ActionText = "Lock Base"
	lockPrompt.ObjectText = "Anti-Thief Lasers"
	lockPrompt.HoldDuration = 0.4
	lockPrompt.MaxActivationDistance = 10
	lockPrompt.RequiresLineOfSight = false
	lockPrompt:SetAttribute("OwnerOnly", 0)
	lockPrompt.Parent = console
	plot.lockPrompt = lockPrompt
	lockPrompt.Triggered:Connect(function(player)
		local ps = State.get(player)
		if ps and plot.owner == player then
			Plot.UseLock(ps)
		end
	end)

	-- lock cage (visual only)
	plot.cage = mk(
		{ Name = "Cage", Size = Vector3.new(PLATFORM.X, 26, PLATFORM.Z), Color = Color3.fromRGB(255, 60, 90), Material = Enum.Material.ForceField, Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false },
		CFrame.new(0, PLATFORM.Y + 13, 0)
	)

	-- big overhead sign
	local anchor = mk({ Name = "SignAnchor", Size = Vector3.one, Transparency = 1, CanCollide = false, CanQuery = false, CanTouch = false }, CFrame.new(0, PLATFORM.Y + 24, 0))
	plot.signAnchor = anchor
	plot.sign = Tags.simple(anchor, anchor, "Empty Base", "Claim me!", Vector3.zero, Vector2.new(360, 120), 520)

	local gooberFolder = Instance.new("Folder")
	gooberFolder.Name = "Goobers"
	gooberFolder.Parent = model
	plot.gooberFolder = gooberFolder

	return plot
end

function Plot.Init(services: any)
	S = services
	plotsFolder = Instance.new("Folder")
	plotsFolder.Name = "Plots"
	plotsFolder.Parent = workspace

	for i = 1, Config.MAX_PLAYERS do
		Plot.plots[i] = buildPlot(i)
	end

	-- standing on a pad collects its stash
	task.spawn(function()
		while true do
			task.wait(0.4)
			for _, ps in State.list() do
				local plot = ps.plot
				local char = ps.player.Character
				local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
				if plot and hrp then
					for slot, e in ps.slots do
						local pad = plot.pads[slot]
						if pad and (e.stash or 0) >= 1 and not e.inTransit then
							local d = pad.Position - hrp.Position
							if math.abs(d.X) < 5 and math.abs(d.Z) < 5 and math.abs(d.Y) < 9 then
								S.Economy.Collect(ps, slot)
							end
						end
					end
				end
			end
		end
	end)
end

----------------------------------------------------------------------
-- Ownership
----------------------------------------------------------------------
function Plot.Assign(ps: any)
	local best
	for _, p in Plot.plots do
		if not p.owner then
			best = p
			break
		end
	end
	if not best then
		return false
	end
	best.owner = ps.player
	best.model:SetAttribute("OwnerId", ps.player.UserId)
	best.lockPrompt:SetAttribute("OwnerOnly", ps.player.UserId)
	ps.plot = best
	ps.player.RespawnLocation = best.spawn
	Plot.UpdateSign(ps, true)
	return true
end

function Plot.Release(ps: any)
	local plot = ps.plot
	if not plot then
		return
	end
	plot.lockToken += 1
	plot.lockedUntil = 0
	plot.cage.Transparency = 1
	for slot in plot.models do
		Plot.ClearModel(plot, slot)
	end
	for slot = 1, Config.MAX_SLOTS do
		plot.padLabels[slot].Text = ""
		plot.pads[slot].Color = Color3.fromRGB(60, 190, 170)
		if plot.padPrompts[slot] then
			plot.padPrompts[slot]:Destroy()
			plot.padPrompts[slot] = nil
		end
	end
	plot.owner = nil
	plot.model:SetAttribute("OwnerId", nil)
	plot.lockPrompt:SetAttribute("OwnerOnly", 0)
	plot.sign.Title.Text = "Empty Base"
	plot.sign.Sub.Text = "Claim me!"
	plot.lastSign = nil
	ps.plot = nil
end

----------------------------------------------------------------------
-- Sign
----------------------------------------------------------------------
function Plot.UpdateSign(ps: any, force: boolean?)
	local plot = ps.plot
	if not plot then
		return
	end
	local title = ps.player.DisplayName .. "'s Base"
	if ps.passes.VIP then
		title = "[VIP] " .. title
	end
	local sub = Util.money(S.Economy.totalCps(ps)) .. "/s"
	if ps.data.rebirths > 0 then
		sub ..= "  |  R" .. ps.data.rebirths
	end
	local key = title .. sub
	if plot.lastSign ~= key or force then
		plot.lastSign = key
		plot.sign.Title.Text = title
		plot.sign.Sub.Text = sub
	end
end

----------------------------------------------------------------------
-- Pads
----------------------------------------------------------------------
function Plot.UpdatePad(ps: any, slot: number)
	local plot = ps.plot
	if not plot then
		return
	end
	local lbl = plot.padLabels[slot]
	local pad = plot.pads[slot]
	local unlocked = S.Economy.slotsUnlocked(ps)
	local e = ps.slots[slot]
	if slot > unlocked then
		pad.Color = Color3.fromRGB(50, 55, 72)
		if slot == unlocked + 1 and unlocked < Config.MAX_SLOTS then
			lbl.Text = "UNLOCK " .. Util.money(Config.slotUpgradeCost(ps.data.slotUpgrades))
			lbl.TextColor3 = Color3.fromRGB(255, 210, 90)
		else
			lbl.Text = "LOCKED"
			lbl.TextColor3 = Color3.fromRGB(140, 145, 165)
		end
	elseif e and not e.inTransit then
		pad.Color = Color3.fromRGB(60, 190, 170)
		local stash = math.floor(e.stash or 0)
		lbl.Text = Util.money(stash)
		lbl.TextColor3 = if stash > 0 then Color3.fromRGB(110, 255, 130) else Color3.fromRGB(190, 200, 205)
	elseif e and e.inTransit then
		pad.Color = Color3.fromRGB(190, 60, 80)
		lbl.Text = "STOLEN!"
		lbl.TextColor3 = Color3.fromRGB(255, 90, 110)
	else
		pad.Color = Color3.fromRGB(95, 120, 135)
		lbl.Text = "EMPTY"
		lbl.TextColor3 = Color3.fromRGB(170, 185, 195)
	end

	-- the first locked pad carries the "unlock slot" prompt
	local wantPrompt = slot == unlocked + 1 and unlocked < Config.MAX_SLOTS
	local pr = plot.padPrompts[slot]
	if wantPrompt and not pr then
		pr = Instance.new("ProximityPrompt")
		pr.ActionText = "Unlock Slot"
		pr.HoldDuration = 0.5
		pr.MaxActivationDistance = 9
		pr.RequiresLineOfSight = false
		pr:SetAttribute("OwnerOnly", ps.player.UserId)
		pr.Parent = pad
		plot.padPrompts[slot] = pr
		pr.Triggered:Connect(function(player)
			local p2 = State.get(player)
			if p2 and plot.owner == player then
				S.Economy.UpgradeSlot(p2)
			end
		end)
	elseif not wantPrompt and pr then
		pr:Destroy()
		plot.padPrompts[slot] = nil
	end
	if pr then
		pr.ObjectText = Util.money(Config.slotUpgradeCost(ps.data.slotUpgrades))
	end
end

function Plot.RefreshAllPads(ps: any)
	for slot = 1, Config.MAX_SLOTS do
		Plot.UpdatePad(ps, slot)
	end
	S.Data.MarkDirty(ps)
end

function Plot.PopCash(ps: any, slot: number, amount: number)
	local plot = ps.plot
	if not plot then
		return
	end
	local pad = plot.pads[slot]
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(160, 40)
	gui.StudsOffsetWorldSpace = Vector3.new(0, 3, 0)
	gui.AlwaysOnTop = true
	gui.Adornee = pad
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = "+" .. Util.money(amount)
	t.TextColor3 = Color3.fromRGB(120, 255, 140)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.TextStrokeTransparency = 0
	t.Parent = gui
	gui.Parent = pad
	TweenService:Create(gui, TweenInfo.new(0.9, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), { StudsOffsetWorldSpace = Vector3.new(0, 9, 0) }):Play()
	TweenService:Create(t, TweenInfo.new(0.9), { TextTransparency = 1, TextStrokeTransparency = 1 }):Play()
	Debris:AddItem(gui, 1)
end

----------------------------------------------------------------------
-- Goober models
----------------------------------------------------------------------
function Plot.ClearModel(plot: any, slot: number)
	local m = plot.models[slot]
	if m then
		m:Destroy()
		plot.models[slot] = nil
		plot.stealPrompts[slot] = nil
	end
end

function Plot.RefreshSlot(ps: any, slot: number)
	local plot = ps.plot
	if not plot then
		return
	end
	Plot.ClearModel(plot, slot)
	Plot.UpdatePad(ps, slot)
	local e = ps.slots[slot]
	if not e or e.inTransit then
		return
	end
	local def = Config.CreatureById[e.id]
	if not def then
		return
	end
	local model = Factory.build(def, e.mut)
	local pad = plot.pads[slot]
	local top = pad.Position + Vector3.new(0, pad.Size.Y / 2, 0)
	local off = model:GetAttribute("GroundOffset") or 2
	local pos = top + Vector3.new(0, off + 0.1, 0)
	model:PivotTo(CFrame.lookAt(pos, pos + plot.cf.XVector))
	local body = model.PrimaryPart :: BasePart
	body:SetAttribute("Base", body.CFrame)
	model:SetAttribute("Slot", slot)
	model.Parent = plot.gooberFolder
	CollectionService:AddTag(model, "PlotGoober")
	plot.models[slot] = model

	Tags.goober(body, def, e.mut, false)

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "STEAL"
	prompt.ObjectText = (if e.mut ~= "Normal" then e.mut .. " " else "") .. def.name
	prompt.HoldDuration = Config.STEAL_HOLD
	prompt.MaxActivationDistance = 9
	prompt.RequiresLineOfSight = false
	prompt.Enabled = workspace:GetServerTimeNow() >= plot.lockedUntil
	prompt:SetAttribute("HideFromOwner", ps.player.UserId)
	prompt.Parent = body
	plot.stealPrompts[slot] = prompt
	prompt.Triggered:Connect(function(thief)
		S.Steal.TryStart(thief, plot, slot)
	end)
end

-- Put a brand new goober into a slot (buying, rewards, beach grabs...).
function Plot.PlaceNew(ps: any, slot: number, id: string, mut: string)
	ps.slots[slot] = { id = id, mut = mut, stash = 0 }
	ps.data.discovered[id] = true
	ps.data.discoveredMut[mut] = true
	Plot.RefreshSlot(ps, slot)
	S.Data.MarkDirty(ps)
end

function Plot.RebuildAll(ps: any)
	local plot = ps.plot
	if not plot then
		return
	end
	for slot = 1, Config.MAX_SLOTS do
		Plot.RefreshSlot(ps, slot)
	end
	Plot.UpdateSign(ps, true)
	S.Data.MarkDirty(ps)
end

----------------------------------------------------------------------
-- Base lock
----------------------------------------------------------------------
local function setLocked(plot: any, locked: boolean)
	plot.cage.Transparency = if locked then 0.75 else 1
	plot.siren.Color = if locked then Color3.fromRGB(255, 70, 90) else Color3.fromRGB(80, 255, 140)
	for _, pr in plot.stealPrompts do
		pr.Enabled = not locked
	end
end

function Plot.UseLock(ps: any, ignoreCooldown: boolean?): boolean
	local plot = ps.plot
	if not plot then
		return false
	end
	local now = workspace:GetServerTimeNow()
	if now < plot.lockedUntil then
		S.Data.Notify(ps.player, "Your base is already locked!", "info")
		return false
	end
	if not ignoreCooldown and now < (ps.lockReadyAt or 0) then
		S.Data.Notify(ps.player, "Lasers recharging: " .. Util.formatTime((ps.lockReadyAt or 0) - now), "error")
		return false
	end
	local dur = S.Economy.lockDuration(ps)
	plot.lockToken += 1
	local token = plot.lockToken
	plot.lockedUntil = now + dur
	ps.lockReadyAt = plot.lockedUntil + Config.LOCK_COOLDOWN
	setLocked(plot, true)
	S.Data.Notify(ps.player, "Base locked for " .. dur .. "s!", "good")
	Net.get("Sfx"):FireClient(ps.player, "alarm")
	S.Data.MarkDirty(ps)
	task.delay(dur, function()
		if plot.lockToken == token then
			plot.lockedUntil = 0
			setLocked(plot, false)
			if ps.player.Parent then
				S.Data.Notify(ps.player, "Base lock ended", "info")
				S.Data.MarkDirty(ps)
			end
		end
	end)
	return true
end

-- Flash the siren (used when a thief starts stealing).
function Plot.Alarm(plot: any)
	task.spawn(function()
		for i = 1, 10 do
			plot.siren.Color = if i % 2 == 0 then Color3.fromRGB(255, 40, 60) else Color3.fromRGB(255, 255, 255)
			task.wait(0.25)
		end
		plot.siren.Color = if workspace:GetServerTimeNow() < plot.lockedUntil then Color3.fromRGB(255, 70, 90) else Color3.fromRGB(80, 255, 140)
	end)
end

----------------------------------------------------------------------
-- Queries
----------------------------------------------------------------------
function Plot.ContainsPosition(plot: any, pos: Vector3): boolean
	local lp = plot.cf:PointToObjectSpace(pos)
	return math.abs(lp.X) <= PLATFORM.X / 2 and math.abs(lp.Z) <= PLATFORM.Z / 2 and lp.Y > PLATFORM.Y - 3
end

function Plot.OfOwner(player: Player)
	local ps = State.get(player)
	return ps and ps.plot
end

return Plot
