-- GOOBER TIDE - client bootstrap.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")

local player = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Net = require(Shared.Net)
local UI = require(script.Parent.UI)
local ClientState = require(script.Parent.ClientState)
local Effects = require(script.Parent.Effects)
local Hud = require(script.Parent.Hud)
local Panels = require(script.Parent.Panels)
local World = require(script.Parent.World)

-- Wait for the server to publish the remotes
Net.get("Data")

local gui = UI.make("ScreenGui", {
	Name = "GooberTideUI",
	ResetOnSpawn = false,
	IgnoreGuiInset = true,
	ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	DisplayOrder = 10,
	Parent = playerGui,
})

-- responsive scaling (phones get a smaller UI)
local scale = UI.make("UIScale", { Parent = gui })
local function updateScale()
	local cam = workspace.CurrentCamera
	if not cam then
		return
	end
	local h = cam.ViewportSize.Y
	scale.Scale = math.clamp(h / 800, 0.55, 1.15)
end
updateScale()
if workspace.CurrentCamera then
	workspace.CurrentCamera:GetPropertyChangedSignal("ViewportSize"):Connect(updateScale)
end

-- loading cover
local cover = UI.make("Frame", { Name = "Cover", BackgroundColor3 = UI.Theme.bg, Size = UDim2.fromScale(1, 1), ZIndex = 100, Parent = gui })
UI.label(cover, "GOOBER TIDE", { Size = UDim2.fromOffset(520, 90), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.42), TextColor3 = UI.Theme.pink, ZIndex = 101 })
UI.label(cover, "Catching goobers...", { Size = UDim2.fromOffset(320, 36), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.55), TextColor3 = UI.Theme.dim, ZIndex = 101 })

Effects.Init(gui)
Panels.Init(gui)
Hud.Init(gui, Panels)
World.Init()

Net.get("Data").OnClientEvent:Connect(function(snapshot)
	ClientState.set(snapshot)
	if cover.Visible then
		UI.tween(cover, 0.6, { BackgroundTransparency = 1 })
		task.delay(0.6, function()
			cover.Visible = false
		end)
		for _, c in cover:GetDescendants() do
			if c:IsA("TextLabel") then
				UI.tween(c, 0.4, { TextTransparency = 1 })
			end
		end
	end
end)

Net.get("TideState").OnClientEvent:Connect(function(state, endsAt)
	ClientState.tide.state = state
	ClientState.tide.endsAt = endsAt
	if state == "Warning" then
		Effects.vignette(Color3.fromRGB(255, 40, 40), 15, 8)
	elseif state == "Wave" then
		Effects.flash(Color3.fromRGB(120, 200, 255), 0.35)
	elseif state == "Surge" then
		Effects.flash(Color3.fromRGB(180, 255, 240), 0.5)
	end
end)

-- Director / creator convenience: F6 hides the HUD for clean footage
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.F6 then
		local root = Hud.widget("root")
		if root then
			root.Visible = not root.Visible
		end
	end
end)

-- keep the Roblox default backpack but hide player list clutter on small screens
pcall(function()
	game:GetService("StarterGui"):SetCoreGuiEnabled(Enum.CoreGuiType.Health, false)
end)
