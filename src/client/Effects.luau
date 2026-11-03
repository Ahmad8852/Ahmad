-- Toasts, headline banners, rarity reveals, vignettes, camera shake, sound, knockback.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local SoundService = game:GetService("SoundService")
local Debris = game:GetService("Debris")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)
local UI = require(script.Parent.UI)

local Effects = {}
local player = Players.LocalPlayer
local T = UI.Theme

local gui: ScreenGui
local toastHolder: Frame
local bannerHolder: Frame
local overlay: Frame

local KIND_COLORS = { info = T.cyan, good = T.good, error = T.bad }

----------------------------------------------------------------------
-- Sound
----------------------------------------------------------------------
function Effects.sfx(key: string, volume: number?, looped: boolean?, duration: number?)
	local id = Config.SOUNDS[key]
	if not id then
		return
	end
	local s = Instance.new("Sound")
	s.SoundId = id
	s.Volume = volume or 0.5
	s.Looped = looped or false
	s.PlaybackSpeed = 0.95 + math.random() * 0.1
	s.Parent = SoundService
	s:Play()
	Debris:AddItem(s, duration or 6)
	return s
end

----------------------------------------------------------------------
-- Toasts
----------------------------------------------------------------------
function Effects.toast(text: string, kind: string?)
	local color = KIND_COLORS[kind or "info"] or T.cyan
	local f = UI.make("Frame", {
		BackgroundColor3 = T.bg,
		Size = UDim2.fromOffset(420, 40),
		BackgroundTransparency = 0.1,
		LayoutOrder = -math.floor(os.clock() * 100),
		Parent = toastHolder,
	})
	UI.corner(f, 10)
	UI.stroke(f, color, 2)
	UI.label(f, text, { TextColor3 = color, Size = UDim2.new(1, -16, 1, -8), Position = UDim2.fromOffset(8, 4), Stroke = false })
	f.Position = UDim2.fromOffset(0, 30)
	task.delay(3.2, function()
		if f.Parent then
			UI.tween(f, 0.3, { BackgroundTransparency = 1 })
			task.wait(0.3)
			f:Destroy()
		end
	end)
	local children = toastHolder:GetChildren()
	local count = 0
	for _, c in children do
		if c:IsA("Frame") then
			count += 1
		end
	end
	if count > 4 then
		for _, c in children do
			if c:IsA("Frame") then
				c:Destroy()
				break
			end
		end
	end
end

----------------------------------------------------------------------
-- Headline banners (server-wide announcements)
----------------------------------------------------------------------
local bannerQueue: { { string | Color3 } } = {}
local bannerBusy = false

local function showNextBanner()
	if bannerBusy then
		return
	end
	local nextB = table.remove(bannerQueue, 1)
	if not nextB then
		return
	end
	bannerBusy = true
	local text, color = nextB[1] :: string, nextB[2] :: Color3
	local f = UI.make("Frame", { BackgroundColor3 = T.bg, BackgroundTransparency = 0.15, Size = UDim2.new(0, 780, 0, 52), AnchorPoint = Vector2.new(0.5, 0), Position = UDim2.new(0.5, 0, 0, -70), Parent = bannerHolder })
	UI.corner(f, 14)
	UI.stroke(f, color, 3)
	UI.label(f, text, { TextColor3 = color, Size = UDim2.new(1, -24, 1, -12), Position = UDim2.fromOffset(12, 6) })
	UI.tween(f, 0.35, { Position = UDim2.new(0.5, 0, 0, 62) }, Enum.EasingStyle.Back)
	task.delay(4.2, function()
		UI.tween(f, 0.3, { Position = UDim2.new(0.5, 0, 0, -70) })
		task.wait(0.35)
		f:Destroy()
		bannerBusy = false
		showNextBanner()
	end)
end

function Effects.announce(text: string, color: Color3?)
	table.insert(bannerQueue, { text, color or T.gold })
	if #bannerQueue > 4 then
		table.remove(bannerQueue, 1)
	end
	showNextBanner()
end

----------------------------------------------------------------------
-- Vignette + flash
----------------------------------------------------------------------
local vignette: { Frame } = {}

local function buildVignette()
	local defs = {
		{ pos = UDim2.fromScale(0, 0), size = UDim2.fromScale(1, 0.3), rot = 90 },
		{ pos = UDim2.fromScale(0, 0.7), size = UDim2.fromScale(1, 0.3), rot = 270 },
		{ pos = UDim2.fromScale(0, 0), size = UDim2.fromScale(0.2, 1), rot = 0 },
		{ pos = UDim2.fromScale(0.8, 0), size = UDim2.fromScale(0.2, 1), rot = 180 },
	}
	for _, d in defs do
		local f = UI.make("Frame", { BackgroundColor3 = Color3.new(1, 0, 0), BorderSizePixel = 0, Position = d.pos, Size = d.size, BackgroundTransparency = 1, Parent = overlay })
		UI.make("UIGradient", { Rotation = d.rot, Transparency = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0), NumberSequenceKeypoint.new(1, 1) }), Parent = f })
		table.insert(vignette, f)
	end
end

-- Pulse red/blue edges for `seconds`.
function Effects.vignette(color: Color3, seconds: number, pulses: number?)
	for _, f in vignette do
		f.BackgroundColor3 = color
	end
	task.spawn(function()
		local n = pulses or math.max(1, math.floor(seconds / 0.8))
		for _ = 1, n do
			for _, f in vignette do
				UI.tween(f, 0.35, { BackgroundTransparency = 0.25 })
			end
			task.wait(0.4)
			for _, f in vignette do
				UI.tween(f, 0.4, { BackgroundTransparency = 1 })
			end
			task.wait(seconds / n - 0.4 > 0 and seconds / n - 0.4 or 0.05)
		end
	end)
end

local flash: Frame
function Effects.flash(color: Color3, strength: number?)
	flash.BackgroundColor3 = color
	flash.BackgroundTransparency = 1 - (strength or 0.6)
	UI.tween(flash, 0.7, { BackgroundTransparency = 1 })
end

----------------------------------------------------------------------
-- Reveal popup (Epic+ buys, steals, rebirth)
----------------------------------------------------------------------
function Effects.reveal(info: { title: string, name: string, color: Color3, rarity: string, cps: number? })
	Effects.sfx("reveal", 0.7)
	Effects.flash(info.color, 0.55)
	local order = if Config.Rarity[info.rarity] then Config.Rarity[info.rarity].order else 5
	Effects.shake(0.15 + order * 0.05, 0.5)

	local f = UI.make("Frame", { BackgroundColor3 = T.bg, BackgroundTransparency = 0.1, Size = UDim2.fromOffset(10, 10), AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(0.5, 0.4), Parent = overlay })
	UI.corner(f, 24)
	UI.stroke(f, info.color, 5)
	local title = UI.label(f, info.title, { TextColor3 = info.color, Size = UDim2.fromScale(0.9, 0.32), Position = UDim2.fromScale(0.05, 0.1) })
	UI.label(f, info.name, { Size = UDim2.fromScale(0.9, 0.3), Position = UDim2.fromScale(0.05, 0.42) })
	if info.cps then
		UI.label(f, "+$" .. require(Shared.Util).formatNumber(info.cps) .. "/s", { TextColor3 = T.good, Size = UDim2.fromScale(0.6, 0.18), Position = UDim2.fromScale(0.2, 0.76) })
	end
	title.Rotation = -3
	UI.tween(f, 0.45, { Size = UDim2.fromOffset(520, 220) }, Enum.EasingStyle.Back)
	UI.tween(title, 0.9, { Rotation = 3 }, Enum.EasingStyle.Sine)
	task.delay(2.6, function()
		UI.tween(f, 0.3, { Size = UDim2.fromOffset(10, 10), BackgroundTransparency = 1 })
		task.wait(0.32)
		f:Destroy()
	end)
end

----------------------------------------------------------------------
-- Camera shake
----------------------------------------------------------------------
local shakeAmp, shakeUntil = 0, 0
function Effects.shake(amp: number, duration: number)
	shakeAmp = math.max(shakeAmp * 0.5, amp)
	shakeUntil = math.max(shakeUntil, os.clock() + duration)
end

----------------------------------------------------------------------
-- Init
----------------------------------------------------------------------
function Effects.Init(screenGui: ScreenGui)
	gui = screenGui

	overlay = UI.make("Frame", { Name = "Overlay", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 50, Parent = gui })
	flash = UI.make("Frame", { Name = "Flash", BackgroundColor3 = Color3.new(1, 1, 1), BackgroundTransparency = 1, BorderSizePixel = 0, Size = UDim2.fromScale(1, 1), ZIndex = 60, Active = false, Parent = gui })
	buildVignette()

	toastHolder = UI.make("Frame", { Name = "Toasts", BackgroundTransparency = 1, AnchorPoint = Vector2.new(0.5, 1), Position = UDim2.new(0.5, 0, 1, -120), Size = UDim2.fromOffset(440, 220), ZIndex = 40, Parent = gui })
	UI.make("UIListLayout", { VerticalAlignment = Enum.VerticalAlignment.Bottom, HorizontalAlignment = Enum.HorizontalAlignment.Center, SortOrder = Enum.SortOrder.LayoutOrder, Padding = UDim.new(0, 6), Parent = toastHolder })

	bannerHolder = UI.make("Frame", { Name = "Banners", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 41, Parent = gui })

	Net.get("Notify").OnClientEvent:Connect(function(text, kind)
		Effects.toast(text, kind)
		if kind == "error" then
			Effects.sfx("click", 0.3)
		end
	end)
	Net.get("Announce").OnClientEvent:Connect(function(text, color)
		Effects.announce(text, color)
	end)
	Net.get("Reveal").OnClientEvent:Connect(function(info)
		Effects.reveal(info)
	end)
	Net.get("Shake").OnClientEvent:Connect(function(amp, dur)
		Effects.shake(amp, dur)
	end)
	Net.get("Sfx").OnClientEvent:Connect(function(key)
		if key == "siren" then
			Effects.sfx("siren", 0.8, true, 15)
		else
			Effects.sfx(key, 0.5)
		end
	end)
	Net.get("StealAlert").OnClientEvent:Connect(function(thiefName, gooberName, rarity)
		Effects.vignette(Color3.fromRGB(255, 30, 60), 3.2, 4)
		Effects.shake(0.3, 0.6)
		Effects.sfx("alarm", 0.8)
		Effects.announce(thiefName .. " IS STEALING YOUR " .. string.upper(gooberName) .. "! SLAP THEM!", T.bad)
	end)
	Net.get("Knock").OnClientEvent:Connect(function(velocity: Vector3)
		local char = player.Character
		local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
		local hum = char and char:FindFirstChildOfClass("Humanoid")
		if hrp and hum then
			hum:ChangeState(Enum.HumanoidStateType.Freefall)
			hrp.AssemblyLinearVelocity = velocity
		end
	end)

	RunService.RenderStepped:Connect(function()
		local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
		if not hum then
			return
		end
		if os.clock() < shakeUntil then
			hum.CameraOffset = Vector3.new((math.random() - 0.5) * shakeAmp * 2, (math.random() - 0.5) * shakeAmp * 2, 0)
		elseif hum.CameraOffset ~= Vector3.zero then
			hum.CameraOffset = Vector3.zero
			shakeAmp = 0
		end
	end)
end

return Effects
