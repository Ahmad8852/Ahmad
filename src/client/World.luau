-- World-space client polish: idle bobbing, rainbow mutations, and per-viewer prompt hiding.

local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local CollectionService = game:GetService("CollectionService")
local ProximityPromptService = game:GetService("ProximityPromptService")

local World = {}
local player = Players.LocalPlayer

local goobers: { [Model]: number } = {}
local rainbows: { [Model]: boolean } = {}

local function track(model: Instance)
	if model:IsA("Model") then
		goobers[model] = math.random() * 6.28
	end
end

local function trackRainbow(model: Instance)
	if model:IsA("Model") then
		rainbows[model] = true
	end
end

function World.Init()
	for _, m in CollectionService:GetTagged("PlotGoober") do
		track(m)
	end
	CollectionService:GetInstanceAddedSignal("PlotGoober"):Connect(track)
	CollectionService:GetInstanceRemovedSignal("PlotGoober"):Connect(function(m)
		goobers[m :: Model] = nil
	end)
	for _, m in CollectionService:GetTagged("RainbowGoober") do
		trackRainbow(m)
	end
	CollectionService:GetInstanceAddedSignal("RainbowGoober"):Connect(trackRainbow)
	CollectionService:GetInstanceRemovedSignal("RainbowGoober"):Connect(function(m)
		rainbows[m :: Model] = nil
	end)

	local frame = 0
	RunService.RenderStepped:Connect(function()
		frame += 1
		local cam = workspace.CurrentCamera
		if not cam then
			return
		end
		local camPos = cam.CFrame.Position
		local t = os.clock()

		if frame % 2 == 0 then
			for model, phase in goobers do
				local body = model.PrimaryPart
				if body and body.Parent then
					local base = body:GetAttribute("Base")
					if base and (body.Position - camPos).Magnitude < 90 then
						body.CFrame = (base :: CFrame) * CFrame.new(0, math.sin(t * 2.2 + phase) * 0.35, 0) * CFrame.Angles(0, math.sin(t * 1.1 + phase) * 0.18, 0)
					end
				end
			end
		end

		if frame % 3 == 0 then
			local hue = (t * 0.25) % 1
			for model in rainbows do
				local body = model.PrimaryPart
				if body and body.Parent and (body.Position - camPos).Magnitude < 140 then
					body.Color = Color3.fromHSV((hue + body.Position.Z * 0.01) % 1, 0.75, 1)
				end
			end
		end
	end)

	-- Prompts that are not meant for this player are hidden locally:
	--   HideFromOwner = userId  -> steal prompts on your own goobers
	--   OwnerOnly     = userId  -> lock console / slot unlock prompts of other bases
	ProximityPromptService.PromptShown:Connect(function(prompt)
		local hide = prompt:GetAttribute("HideFromOwner")
		local ownerOnly = prompt:GetAttribute("OwnerOnly")
		if hide ~= nil and hide == player.UserId then
			prompt.Enabled = false
		elseif ownerOnly ~= nil and ownerOnly ~= player.UserId then
			prompt.Enabled = false
		end
	end)
end

return World
