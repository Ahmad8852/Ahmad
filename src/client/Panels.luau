-- All modal panels: Shop, Index (with odds disclosure), Rewards, Free Spin, Rebirth, Codes, Director.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local MarketplaceService = game:GetService("MarketplaceService")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local Factory = require(Shared.GooberFactory)
local UI = require(script.Parent.UI)
local ClientState = require(script.Parent.ClientState)
local Effects = require(script.Parent.Effects)

local Panels = {}
local T = UI.Theme
local player = Players.LocalPlayer

local gui: ScreenGui
local panels: { [string]: any } = {}
local current: string? = nil

----------------------------------------------------------------------
-- Panel frame helper
----------------------------------------------------------------------
local function newPanel(name: string, title: string, size: Vector2, accent: Color3?)
	local f = UI.make("Frame", {
		Name = name,
		Visible = false,
		BackgroundColor3 = T.bg,
		Size = UDim2.fromOffset(size.X, size.Y),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		ZIndex = 20,
		Parent = gui,
	})
	UI.corner(f, 20)
	UI.stroke(f, accent or T.pink, 4)
	local scale = UI.make("UIScale", { Scale = 1, Parent = f })
	UI.label(f, title, { Size = UDim2.new(1, -120, 0, 44), Position = UDim2.fromOffset(18, 8), TextColor3 = accent or T.pink, TextXAlignment = Enum.TextXAlignment.Left })
	UI.button(f, "X", T.bad, { Size = UDim2.fromOffset(44, 40), AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -12, 0, 10) }, function()
		Panels.close()
	end)
	local content = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, -28, 1, -68), Position = UDim2.fromOffset(14, 58), Parent = f })
	local p = { frame = f, content = content, scale = scale, onOpen = nil :: (() -> ())? }
	panels[name] = p
	return p
end

function Panels.close()
	if current then
		local p = panels[current]
		current = nil
		UI.tween(p.scale, 0.15, { Scale = 0.85 })
		task.delay(0.15, function()
			if current ~= nil and panels[current] == p then
				return
			end
			p.frame.Visible = false
		end)
	end
end

function Panels.open(name: string)
	local p = panels[name]
	if not p then
		return
	end
	if current and current ~= name then
		panels[current].frame.Visible = false
	end
	current = name
	p.scale.Scale = 0.85
	p.frame.Visible = true
	UI.tween(p.scale, 0.2, { Scale = 1 }, Enum.EasingStyle.Back)
	if p.onOpen then
		p.onOpen()
	end
end

function Panels.toggle(name: string)
	if current == name then
		Panels.close()
	else
		Panels.open(name)
	end
end

local function scrolling(parent: Instance, layout: Instance?): ScrollingFrame
	local sf = UI.make("ScrollingFrame", {
		BackgroundTransparency = 1,
		Size = UDim2.fromScale(1, 1),
		CanvasSize = UDim2.new(),
		AutomaticCanvasSize = Enum.AutomaticSize.Y,
		ScrollBarThickness = 8,
		BorderSizePixel = 0,
		Parent = parent,
	})
	return sf
end

----------------------------------------------------------------------
-- SHOP
----------------------------------------------------------------------
local function buildShop()
	local p = newPanel("Shop", "SHOP", Vector2.new(640, 520), T.pink)
	local sf = scrolling(p.content)
	UI.make("UIListLayout", { Padding = UDim.new(0, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = sf })
	UI.make("UIPadding", { PaddingRight = UDim.new(0, 10), Parent = sf })

	local rows: { [string]: { button: TextButton, kind: string } } = {}

	local function header(text: string, order: number)
		UI.label(sf, text, { Size = UDim2.new(1, 0, 0, 30), TextColor3 = T.gold, LayoutOrder = order, TextXAlignment = Enum.TextXAlignment.Left })
	end

	local function row(kind: string, key: string, entry: any, order: number)
		local f = UI.make("Frame", { BackgroundColor3 = T.panel, Size = UDim2.new(1, 0, 0, 66), LayoutOrder = order, Parent = sf })
		UI.corner(f, 12)
		UI.label(f, entry.name, { Size = UDim2.new(0.62, 0, 0, 28), Position = UDim2.fromOffset(12, 6), TextXAlignment = Enum.TextXAlignment.Left })
		UI.label(f, entry.desc, { Size = UDim2.new(0.62, 0, 0, 22), Position = UDim2.fromOffset(12, 36), TextColor3 = T.dim, TextXAlignment = Enum.TextXAlignment.Left, Stroke = false })
		local b = UI.button(f, "R$ " .. entry.robux, T.good, { Size = UDim2.fromOffset(120, 44), AnchorPoint = Vector2.new(1, 0.5), Position = UDim2.new(1, -12, 0.5, 0) }, function()
			if entry.id == 0 then
				Effects.toast("Not live yet - add the Roblox id in Config (see docs).", "error")
				return
			end
			if kind == "pass" then
				MarketplaceService:PromptGamePassPurchase(player, entry.id)
			else
				MarketplaceService:PromptProductPurchase(player, entry.id)
			end
		end)
		rows[key] = { button = b, kind = kind }
	end

	header("GAME PASSES", 0)
	local order = 1
	local passList = {}
	for k, v in Config.PASSES do
		table.insert(passList, { k, v })
	end
	table.sort(passList, function(a, b)
		return a[2].order < b[2].order
	end)
	for _, e in passList do
		row("pass", e[1], e[2], order)
		order += 1
	end
	header("BOOSTS & PACKS", 100)
	local prodList = {}
	for k, v in Config.PRODUCTS do
		table.insert(prodList, { k, v })
	end
	table.sort(prodList, function(a, b)
		return a[2].order < b[2].order
	end)
	order = 101
	for _, e in prodList do
		row("product", "P_" .. e[1], e[2], order)
		order += 1
	end

	ClientState.onChanged(function(d)
		for key, r in rows do
			if r.kind == "pass" then
				local owned = d.passes[key]
				r.button.Text = if owned then "OWNED" else "R$ " .. Config.PASSES[key].robux
				r.button.BackgroundColor3 = if owned then T.panel2 else T.good
				r.button.Active = not owned
			end
		end
	end)
end

----------------------------------------------------------------------
-- INDEX
----------------------------------------------------------------------
local function rarityChance(def: any): number
	local total = 0
	for _, r in Config.Rarities do
		total += r.weight
	end
	local countInRarity = 0
	for _, d in Config.Creatures do
		if d.rarity == def.rarity and not d.tideOnly then
			countInRarity += 1
		end
	end
	if def.tideOnly or countInRarity == 0 then
		return 0
	end
	return Config.Rarity[def.rarity].weight / total * 100 / countInRarity
end

local function makePreview(parent: Instance, def: any, discovered: boolean)
	local vp = UI.make("ViewportFrame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 84), Parent = parent })
	local cam = Instance.new("Camera")
	cam.FieldOfView = 35
	vp.CurrentCamera = cam
	cam.Parent = vp
	local model = Factory.build(def, "Normal")
	if not discovered then
		for _, d in model:GetDescendants() do
			if d:IsA("BasePart") then
				d.Color = Color3.fromRGB(12, 12, 20)
				d.Material = Enum.Material.SmoothPlastic
				d.Transparency = 0
			end
		end
	end
	model.Parent = vp
	local cf, size = model:GetBoundingBox()
	local dist = math.max(size.X, size.Y) * 1.9
	cam.CFrame = CFrame.lookAt(cf.Position + Vector3.new(size.X * 0.12, size.Y * 0.12, -dist), cf.Position)
end

local function buildIndex()
	local p = newPanel("Index", "GOOBERDEX", Vector2.new(700, 540), Color3.fromRGB(140, 130, 255))
	local progress = UI.label(p.content, "", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = T.gold, TextXAlignment = Enum.TextXAlignment.Left })
	local sf = scrolling(p.content)
	sf.Position = UDim2.fromOffset(0, 32)
	sf.Size = UDim2.new(1, 0, 1, -84)
	local mutLines = {}
	for _, row in Config.MutationRoll do
		table.insert(mutLines, string.format("%s x%s (%s%%)", row[1], tostring(Config.Mutations[row[1]].mult), tostring(row[2])))
	end
	UI.label(p.content, "MUTATIONS ON THE BELT:  " .. table.concat(mutLines, "  |  ") .. "  |  Tidal x6 (Tide Surge only)", {
		Size = UDim2.new(1, 0, 0, 44),
		Position = UDim2.new(0, 0, 1, -44),
		TextColor3 = T.dim,
		TextWrapped = true,
		Stroke = false,
	})
	local grid = UI.make("UIGridLayout", { CellSize = UDim2.fromOffset(120, 168), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = sf })

	local lastKey: string? = nil
	local function rebuild(d: any)
		local key = ""
		for id in d.discovered do
			key ..= id .. ","
		end
		if key == lastKey then
			return
		end
		lastKey = key
		for _, c in sf:GetChildren() do
			if c:IsA("Frame") or c:IsA("TextLabel") then
				c:Destroy()
			end
		end
		local count = 0
		for i, def in Config.Creatures do
			local known = d.discovered[def.id] == true
			if known then
				count += 1
			end
			local rar = Config.Rarity[def.rarity]
			local card = UI.make("Frame", { BackgroundColor3 = T.panel, LayoutOrder = i, Parent = sf })
			UI.corner(card, 12)
			UI.stroke(card, if known then rar.color else T.panel2, 3)
			makePreview(card, def, known)
			UI.label(card, if known then def.name else "???", { Size = UDim2.new(1, -8, 0, 24), Position = UDim2.fromOffset(4, 86) })
			UI.label(card, string.upper(def.rarity), { Size = UDim2.new(1, -8, 0, 18), Position = UDim2.fromOffset(4, 112), TextColor3 = rar.color })
			local chance = rarityChance(def)
			UI.label(card, if def.tideOnly then "Tide only!" else string.format("%.2f%%", chance), { Size = UDim2.new(1, -8, 0, 16), Position = UDim2.fromOffset(4, 132), TextColor3 = T.dim, Stroke = false })
			if known then
				UI.label(card, "$" .. Util.formatNumber(def.cps) .. "/s", { Size = UDim2.new(1, -8, 0, 14), Position = UDim2.fromOffset(4, 149), TextColor3 = T.gold, Stroke = false })
			end
		end
		progress.Text = "Discovered " .. count .. " / " .. #Config.Creatures .. "   -   chances shown are per belt roll"
	end
	p.onOpen = function()
		if ClientState.data then
			rebuild(ClientState.data)
		end
	end
	ClientState.onChanged(function(d)
		if current == "Index" then
			rebuild(d)
		end
	end)
end

----------------------------------------------------------------------
-- REWARDS (daily streak + playtime gifts)
----------------------------------------------------------------------
local function buildRewards()
	local p = newPanel("Rewards", "REWARDS", Vector2.new(720, 520), T.good)
	UI.label(p.content, "DAILY STREAK", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = T.gold, TextXAlignment = Enum.TextXAlignment.Left })
	local days = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 130), Position = UDim2.fromOffset(0, 32), Parent = p.content })
	UI.make("UIGridLayout", { CellSize = UDim2.fromOffset(94, 124), CellPadding = UDim2.fromOffset(6, 6), SortOrder = Enum.SortOrder.LayoutOrder, Parent = days })
	local tiles = {}
	for i, r in Config.DAILY do
		local f = UI.make("Frame", { BackgroundColor3 = T.panel, LayoutOrder = i, Parent = days })
		UI.corner(f, 10)
		local st = UI.stroke(f, T.panel2, 3)
		UI.label(f, "DAY " .. i, { Size = UDim2.new(1, 0, 0, 22), Position = UDim2.fromOffset(0, 4), TextColor3 = T.dim })
		UI.label(f, r.label, { Size = UDim2.new(1, -8, 0, 62), Position = UDim2.fromOffset(4, 28), TextWrapped = true, TextScaled = true })
		local state = UI.label(f, "", { Size = UDim2.new(1, 0, 0, 22), Position = UDim2.fromOffset(0, 96) })
		tiles[i] = { frame = f, stroke = st, state = state }
	end
	local claim = UI.button(p.content, "CLAIM TODAY'S REWARD", T.good, { Size = UDim2.fromOffset(300, 44), Position = UDim2.fromOffset(0, 170) }, function()
		Net.get("ClaimDaily"):FireServer()
	end)

	UI.label(p.content, "PLAYTIME GIFTS", { Size = UDim2.new(1, 0, 0, 26), Position = UDim2.fromOffset(0, 226), TextColor3 = T.gold, TextXAlignment = Enum.TextXAlignment.Left })
	local gifts = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 220), Position = UDim2.fromOffset(0, 256), Parent = p.content })
	UI.make("UIGridLayout", { CellSize = UDim2.fromOffset(104, 100), CellPadding = UDim2.fromOffset(6, 6), SortOrder = Enum.SortOrder.LayoutOrder, Parent = gifts })
	local giftTiles = {}
	for i, g in Config.GIFTS do
		local b = UI.make("TextButton", { BackgroundColor3 = T.panel, Text = "", LayoutOrder = i, AutoButtonColor = false, Parent = gifts })
		UI.corner(b, 10)
		local st = UI.stroke(b, T.panel2, 3)
		local what = if g.kind == "cash" then "CASH" elseif g.kind == "luck" then "LUCK" elseif g.kind == "shield" then "SHIELD" else "GOOBER"
		UI.label(b, what, { Size = UDim2.new(1, 0, 0, 30), Position = UDim2.fromOffset(0, 8) })
		local t = UI.label(b, "", { Size = UDim2.new(1, -8, 0, 30), Position = UDim2.fromOffset(4, 56), TextColor3 = T.dim })
		b.Activated:Connect(function()
			Net.get("ClaimGift"):FireServer(i)
		end)
		giftTiles[i] = { frame = b, stroke = st, label = t }
	end

	local function refresh()
		local d = ClientState.data
		if not d then
			return
		end
		local nextDay = (d.dailyStreak % #Config.DAILY) + 1
		local doneUpTo = if d.dailyReady then nextDay - 1 else ((d.dailyStreak - 1) % #Config.DAILY) + 1
		for i, t in tiles do
			if i <= doneUpTo then
				t.state.Text = "DONE"
				t.state.TextColor3 = T.good
				t.stroke.Color = T.good
			elseif i == nextDay and d.dailyReady then
				t.state.Text = "TODAY!"
				t.state.TextColor3 = T.gold
				t.stroke.Color = T.gold
			else
				t.state.Text = "..."
				t.state.TextColor3 = T.dim
				t.stroke.Color = T.panel2
			end
		end
		claim.Visible = d.dailyReady
		for i, g in Config.GIFTS do
			local t = giftTiles[i]
			if d.giftsClaimed[i] then
				t.label.Text = "CLAIMED"
				t.label.TextColor3 = T.dim
				t.stroke.Color = T.panel2
			elseif d.playSeconds >= g.at then
				t.label.Text = "CLAIM!"
				t.label.TextColor3 = T.good
				t.stroke.Color = T.good
			else
				t.label.Text = Util.formatTime(g.at - d.playSeconds)
				t.label.TextColor3 = T.dim
				t.stroke.Color = T.panel2
			end
		end
	end
	p.onOpen = refresh
	ClientState.onChanged(function()
		if current == "Rewards" then
			refresh()
		end
	end)
	-- local clock for the gift countdowns
	task.spawn(function()
		while true do
			task.wait(1)
			local d = ClientState.data
			if d then
				d.playSeconds += 1
				if current == "Rewards" then
					refresh()
				end
			end
		end
	end)
end

----------------------------------------------------------------------
-- FREE SPIN
----------------------------------------------------------------------
local function buildSpin()
	local p = newPanel("Spin", "LUCKY SPIN", Vector2.new(640, 440), T.gold)
	local board = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 0, 220), Position = UDim2.fromOffset(0, 6), Parent = p.content })
	UI.make("UIGridLayout", { CellSize = UDim2.fromOffset(142, 100), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = board })
	local tiles = {}
	for i, r in Config.SPIN do
		local f = UI.make("Frame", { BackgroundColor3 = T.panel, LayoutOrder = i, Parent = board })
		UI.corner(f, 12)
		local st = UI.stroke(f, T.panel2, 3)
		UI.label(f, r.label, { Size = UDim2.new(1, -10, 1, -10), Position = UDim2.fromOffset(5, 5), TextWrapped = true })
		tiles[i] = { frame = f, stroke = st }
	end
	local result = UI.label(p.content, "", { Size = UDim2.new(1, 0, 0, 36), Position = UDim2.fromOffset(0, 236), TextColor3 = T.good })
	local spinning = false
	local btn = UI.button(p.content, "SPIN!", T.gold, { Size = UDim2.fromOffset(260, 56), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 286) }, function()
		if spinning then
			return
		end
		Net.get("DoSpin"):FireServer()
	end)

	local function highlight(i: number?)
		for k, t in tiles do
			t.stroke.Color = if k == i then T.gold else T.panel2
			t.frame.BackgroundColor3 = if k == i then Color3.fromRGB(90, 80, 40) else T.panel
		end
	end

	Net.get("SpinResult").OnClientEvent:Connect(function(index: number, desc: string)
		spinning = true
		result.Text = ""
		task.spawn(function()
			local seq = 24 + index
			for step = 1, seq do
				highlight(((step - 1) % #Config.SPIN) + 1)
				Effects.sfx("click", 0.25)
				task.wait(0.04 + (step / seq) ^ 3 * 0.26)
			end
			result.Text = "YOU WON: " .. tostring(desc)
			Effects.flash(T.gold, 0.35)
			Effects.sfx("reveal", 0.6)
			spinning = false
		end)
	end)

	local function refresh()
		local d = ClientState.data
		if not d or spinning then
			return
		end
		if d.spinReady then
			btn.Text = "SPIN!"
			btn.BackgroundColor3 = T.gold
		else
			btn.Text = "NEXT SPIN " .. Util.formatTime(d.spinIn)
			btn.BackgroundColor3 = T.panel2
		end
	end
	p.onOpen = refresh
	ClientState.onChanged(refresh)
end

----------------------------------------------------------------------
-- REBIRTH
----------------------------------------------------------------------
local function buildRebirth()
	local p = newPanel("Rebirth", "REBIRTH", Vector2.new(560, 440), Color3.fromRGB(190, 90, 255))
	local info = UI.label(p.content, "", { Size = UDim2.new(1, 0, 0, 40), TextColor3 = T.text })
	local mult = UI.label(p.content, "", { Size = UDim2.new(1, 0, 0, 52), Position = UDim2.fromOffset(0, 48), TextColor3 = T.gold })
	local barBg = UI.make("Frame", { BackgroundColor3 = T.panel, Size = UDim2.new(1, 0, 0, 30), Position = UDim2.fromOffset(0, 112), Parent = p.content })
	UI.corner(barBg, 15)
	local fill = UI.make("Frame", { BackgroundColor3 = Color3.fromRGB(190, 90, 255), Size = UDim2.fromScale(0, 1), Parent = barBg })
	UI.corner(fill, 15)
	local barText = UI.label(barBg, "", { Size = UDim2.fromScale(1, 1) })
	UI.label(p.content, "You LOSE: cash + all goobers below Mythic.\nYou KEEP: Mythic & Secret goobers, passes, index, codes.\nYou GAIN: +50% permanent income & +1 slot per rebirth.", {
		Size = UDim2.new(1, 0, 0, 100),
		Position = UDim2.fromOffset(0, 158),
		TextColor3 = T.dim,
		TextWrapped = true,
		TextScaled = false,
		TextSize = 18,
	})
	local go = UI.button(p.content, "REBIRTH NOW", Color3.fromRGB(190, 90, 255), { Size = UDim2.fromOffset(300, 56), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 280) }, function()
		Net.get("Rebirth"):FireServer()
	end)
	ClientState.onChanged(function(d)
		info.Text = "Rebirth " .. d.rebirths .. "  ->  " .. (d.rebirths + 1) .. "   |   Cost " .. Util.money(d.rebirthCost)
		mult.Text = "Income x" .. d.rebirthMult .. "  ->  x" .. d.rebirthMultNext
		local ratio = math.clamp(d.cash / d.rebirthCost, 0, 1)
		fill.Size = UDim2.fromScale(ratio, 1)
		barText.Text = Util.money(d.cash) .. " / " .. Util.money(d.rebirthCost)
		go.Active = d.cash >= d.rebirthCost
		go.BackgroundColor3 = if go.Active then Color3.fromRGB(190, 90, 255) else T.panel2
	end)
end

----------------------------------------------------------------------
-- CODES
----------------------------------------------------------------------
local function buildCodes()
	local p = newPanel("Codes", "CODES", Vector2.new(520, 300), T.cyan)
	UI.label(p.content, "Follow us for new codes every update!", { Size = UDim2.new(1, 0, 0, 32), TextColor3 = T.dim })
	local box = UI.make("TextBox", {
		BackgroundColor3 = T.panel,
		Size = UDim2.new(1, 0, 0, 52),
		Position = UDim2.fromOffset(0, 50),
		Text = "",
		PlaceholderText = "Enter code...",
		Font = UI.FONT,
		TextSize = 26,
		TextColor3 = T.text,
		ClearTextOnFocus = false,
		Parent = p.content,
	})
	UI.corner(box, 12)
	UI.stroke(box, T.cyan, 3)
	UI.button(p.content, "REDEEM", T.cyan, { Size = UDim2.fromOffset(240, 52), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, 124) }, function()
		Net.get("Redeem"):FireServer(box.Text)
		box.Text = ""
	end)
end

----------------------------------------------------------------------
-- DIRECTOR (content capture tools)
----------------------------------------------------------------------
local function buildDirector()
	local p = newPanel("Director", "DIRECTOR MODE", Vector2.new(560, 470), Color3.fromRGB(150, 150, 190))
	UI.label(p.content, "Tools for recording marketing footage. F6 hides the HUD.", { Size = UDim2.new(1, 0, 0, 26), TextColor3 = T.dim })
	local grid = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.new(1, 0, 1, -34), Position = UDim2.fromOffset(0, 34), Parent = p.content })
	UI.make("UIGridLayout", { CellSize = UDim2.fromOffset(170, 46), CellPadding = UDim2.fromOffset(8, 8), SortOrder = Enum.SortOrder.LayoutOrder, Parent = grid })
	local function cmd(label: string, c: string, arg: any?, color: Color3?)
		UI.button(grid, label, color or T.panel2, nil, function()
			Net.get("Director"):FireServer(c, arg)
		end)
	end
	cmd("TRIGGER TIDE", "tide", nil, T.bad)
	cmd("BEACH GOOBERS", "beach", nil, T.cyan)
	cmd("SPAWN LEGENDARY", "spawn", "Legendary", T.gold)
	cmd("SPAWN MYTHIC", "spawn", "Mythic", T.pink)
	cmd("SPAWN SECRET", "spawn", "Secret", Color3.fromRGB(20, 200, 190))
	cmd("RAINBOW MYTHIC", "spawn", "Mythic:Rainbow", Color3.fromRGB(190, 90, 255))
	cmd("LAVA EPIC", "spawn", "Epic:Lava", Color3.fromRGB(255, 120, 40))
	cmd("GOLD LEGENDARY", "spawn", "Legendary:Gold", Color3.fromRGB(230, 180, 40))
	cmd("+$1 BILLION", "cash", 1e9)
	cmd("+$1 TRILLION", "cash", 1e12)
	cmd("SERVER LUCK x4", "luck")
	cmd("+3 SHIELDS", "shield")
	cmd("UNLOCK ALL SLOTS", "slots")
	cmd("REFILL BASE LOCK", "lockrefill")
	cmd("GIVE: THE GOOBER", "giveSlot", "thegoober:Rainbow", Color3.fromRGB(80, 200, 255))
	cmd("GIVE: TSUNAMOO", "giveSlot", "tsunamoo:Tidal", Color3.fromRGB(40, 120, 255))
end

function Panels.Init(screenGui: ScreenGui)
	gui = screenGui
	buildShop()
	buildIndex()
	buildRewards()
	buildSpin()
	buildRebirth()
	buildCodes()
	buildDirector()
	return Panels
end

return Panels
