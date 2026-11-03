-- Always-visible interface: cash, income, tide timer, buffs, menu buttons, tutorial hint.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local UI = require(script.Parent.UI)
local ClientState = require(script.Parent.ClientState)
local Effects = require(script.Parent.Effects)

local Hud = {}
local T = UI.Theme

local widgets: { [string]: any } = {}

local function pill(parent: Instance, size: UDim2, pos: UDim2, anchor: Vector2?, color: Color3?): Frame
	local f = UI.make("Frame", { BackgroundColor3 = T.bg, BackgroundTransparency = 0.12, Size = size, Position = pos, AnchorPoint = anchor or Vector2.zero, Parent = parent })
	UI.corner(f, 14)
	UI.stroke(f, color or T.panel2, 3)
	return f
end

function Hud.Init(gui: ScreenGui, panels: any)
	local root = UI.make("Frame", { Name = "Hud", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), Parent = gui })
	widgets.root = root

	-- CASH (top-left)
	local cash = pill(root, UDim2.fromOffset(300, 92), UDim2.fromOffset(14, 14), nil, T.good)
	widgets.cash = UI.label(cash, "$0", { Size = UDim2.new(1, -20, 0, 48), Position = UDim2.fromOffset(10, 6), TextColor3 = T.good, TextXAlignment = Enum.TextXAlignment.Left })
	widgets.cps = UI.label(cash, "+$0/s", { Size = UDim2.new(0.55, 0, 0, 26), Position = UDim2.fromOffset(10, 58), TextColor3 = T.gold, TextXAlignment = Enum.TextXAlignment.Left })
	widgets.mult = UI.label(cash, "x1", { Size = UDim2.new(0.4, 0, 0, 26), Position = UDim2.new(0.58, 0, 0, 58), TextColor3 = T.cyan, TextXAlignment = Enum.TextXAlignment.Right })

	-- TIDE TIMER (top-centre)
	local tide = pill(root, UDim2.fromOffset(380, 50), UDim2.new(0.5, 0, 0, 12), Vector2.new(0.5, 0), T.cyan)
	widgets.tideFrame = tide
	widgets.tideStroke = tide:FindFirstChildOfClass("UIStroke")
	widgets.tide = UI.label(tide, "NEXT TIDE", { Size = UDim2.new(1, -20, 1, -10), Position = UDim2.fromOffset(10, 5) })

	-- BUFFS (top-right)
	local buffs = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(250, 120), AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 14), Parent = root })
	UI.make("UIListLayout", { Padding = UDim.new(0, 6), HorizontalAlignment = Enum.HorizontalAlignment.Right, Parent = buffs })
	local luck = pill(buffs, UDim2.fromOffset(250, 36), UDim2.new(), nil, Color3.fromRGB(120, 255, 160))
	luck.Visible = false
	widgets.luckFrame = luck
	widgets.luck = UI.label(luck, "", { Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), TextColor3 = Color3.fromRGB(120, 255, 160) })
	local shield = pill(buffs, UDim2.fromOffset(250, 36), UDim2.new(), nil, T.cyan)
	shield.Visible = false
	widgets.shieldFrame = shield
	widgets.shield = UI.label(shield, "", { Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), TextColor3 = T.cyan })
	local lock = pill(buffs, UDim2.fromOffset(250, 36), UDim2.new(), nil, T.pink)
	lock.Visible = false
	widgets.lockFrame = lock
	widgets.lockLabel = UI.label(lock, "", { Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), TextColor3 = T.pink })

	-- LEFT MENU
	local menu = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(122, 340), AnchorPoint = Vector2.new(0, 0.5), Position = UDim2.new(0, 14, 0.5, 20), Parent = root })
	UI.make("UIListLayout", { Padding = UDim.new(0, 8), Parent = menu })
	local function menuButton(name: string, text: string, color: Color3, order: number)
		local b = UI.button(menu, text, color, { Size = UDim2.fromOffset(122, 46), LayoutOrder = order }, function()
			Effects.sfx("click", 0.3)
			panels.toggle(name)
		end)
		widgets["btn_" .. name] = UI.dot(b)
		return b
	end
	menuButton("Shop", "SHOP", T.pink, 1)
	menuButton("Index", "INDEX", Color3.fromRGB(120, 110, 255), 2)
	menuButton("Rewards", "REWARDS", T.good, 3)
	menuButton("Spin", "FREE SPIN", T.gold, 4)
	menuButton("Codes", "CODES", T.cyan, 5)

	-- ACTION BAR (bottom)
	local bar = UI.make("Frame", { BackgroundTransparency = 1, Size = UDim2.fromOffset(560, 56), AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -14), Parent = root })
	UI.make("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 10), HorizontalAlignment = Enum.HorizontalAlignment.Center, Parent = bar })
	widgets.btnRebirth = UI.button(bar, "REBIRTH", Color3.fromRGB(190, 90, 255), { Size = UDim2.fromOffset(170, 56), LayoutOrder = 1 }, function()
		Effects.sfx("click", 0.3)
		panels.toggle("Rebirth")
	end)
	UI.button(bar, "COLLECT ALL", T.good, { Size = UDim2.fromOffset(170, 56), LayoutOrder = 2 }, function()
		Effects.sfx("click", 0.3)
		Net.get("CollectAll"):FireServer()
	end)
	widgets.btnLock = UI.button(bar, "LOCK BASE", T.bad, { Size = UDim2.fromOffset(170, 56), LayoutOrder = 3 }, function()
		Effects.sfx("click", 0.3)
		Net.get("UseLock"):FireServer()
	end)

	-- Hint line
	widgets.hint = UI.label(root, "", { Size = UDim2.fromOffset(640, 30), AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -76), TextColor3 = T.gold })

	-- Director button
	local dirBtn = UI.button(root, "DIRECTOR", Color3.fromRGB(70, 70, 90), { Size = UDim2.fromOffset(100, 34), AnchorPoint = Vector2.new(1, 1), Position = UDim2.new(1, -14, 1, -14), Visible = false }, function()
		panels.toggle("Director")
	end)
	widgets.dirBtn = dirBtn

	----------------------------------------------------------------
	-- data bindings
	----------------------------------------------------------------
	ClientState.onChanged(function(d)
		widgets.cash.Text = Util.money(d.cash)
		widgets.cps.Text = "+" .. Util.money(d.cps) .. "/s"
		widgets.mult.Text = "x" .. string.format("%.2f", d.mult):gsub("%.?0+$", "")
		widgets.dirBtn.Visible = d.isDirector
		widgets.btn_Spin.Visible = d.spinReady
		local giftReady = false
		for i, g in Config.GIFTS do
			if d.playSeconds >= g.at and not d.giftsClaimed[i] then
				giftReady = true
				break
			end
		end
		widgets.btn_Rewards.Visible = d.dailyReady or giftReady
		if d.cash >= d.rebirthCost then
			widgets.btnRebirth.Text = "REBIRTH READY!"
			widgets.btnRebirth.BackgroundColor3 = Color3.fromRGB(230, 110, 255)
		else
			widgets.btnRebirth.Text = "REBIRTH"
			widgets.btnRebirth.BackgroundColor3 = Color3.fromRGB(150, 80, 215)
		end
	end)

	-- per-frame timers
	RunService.Heartbeat:Connect(function()
		local d = ClientState.data
		if not d then
			return
		end
		local now = ClientState.now()
		-- tide
		local s, endsAt = ClientState.tide.state, ClientState.tide.endsAt
		local left = math.max(0, endsAt - now)
		local txt, col
		if s == "Idle" then
			txt, col = "NEXT TIDE  " .. Util.formatTime(left), T.cyan
		elseif s == "Warning" then
			txt, col = "TIDE INCOMING! HIGH GROUND!  " .. math.ceil(left), T.bad
		elseif s == "Wave" then
			txt, col = "THE TIDE IS HERE!! STAY HIGH!", T.bad
		else
			txt, col = "TIDE SURGE! 2x INCOME  " .. Util.formatTime(left), Color3.fromRGB(80, 255, 220)
		end
		widgets.tide.Text = txt
		widgets.tide.TextColor3 = col
		widgets.tideStroke.Color = col

		-- luck
		local luckLeft = d.luck.endsAt - now
		widgets.luckFrame.Visible = d.luck.mult > 1 and luckLeft > 0
		if widgets.luckFrame.Visible then
			widgets.luck.Text = "SERVER LUCK x" .. d.luck.mult .. "  " .. Util.formatTime(luckLeft)
		end
		-- shields
		widgets.shieldFrame.Visible = d.shields > 0
		widgets.shield.Text = "TIDE SHIELDS: " .. d.shields
		-- lock
		local lockActive = d.lockUntil - now
		local lockWait = d.lockReadyAt - now
		if lockActive > 0 then
			widgets.lockFrame.Visible = true
			widgets.lockLabel.Text = "BASE LOCKED  " .. Util.formatTime(lockActive)
			widgets.btnLock.Text = "LOCKED"
		elseif lockWait > 0 then
			widgets.lockFrame.Visible = false
			widgets.btnLock.Text = "LASERS " .. Util.formatTime(lockWait)
		else
			widgets.lockFrame.Visible = false
			widgets.btnLock.Text = "LOCK BASE"
		end
		-- hint
		local hint = ""
		local tut = d.tutorial
		if s == "Warning" or s == "Wave" then
			hint = "Get to your base platform - the water is DEADLY below the platforms!"
		elseif not tut.bought then
			hint = "Walk to the GOOBER BELT in the middle and HOLD E on a goober to buy it!"
		elseif not tut.collected then
			hint = "Stand on your glowing pad to collect the cash your goober earns!"
		elseif not tut.stole then
			hint = "Climb another base and HOLD E on a goober to STEAL it. Run it home!"
		elseif d.carrying then
			hint = "Run to YOUR base platform to keep the stolen goober!"
		end
		widgets.hint.Text = hint
	end)
end

-- Called by Panels so the red dots follow reality.
function Hud.widget(name: string)
	return widgets[name]
end

return Hud
