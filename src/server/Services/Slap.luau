-- The Slap Glove: every player gets one. Hit a thief to make them drop the goober
-- (it flies back to its owner). Hitting anyone else just shoves them a little.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Debris = game:GetService("Debris")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local State = require(script.Parent.State)

local Slap = {}
local S: any

function Slap.Init(services: any)
	S = services
end

local function popText(char: Model, text: string)
	local head = char:FindFirstChild("Head")
	if not head then
		return
	end
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(180, 60)
	gui.StudsOffset = Vector3.new(0, 3, 0)
	gui.AlwaysOnTop = true
	gui.Adornee = head
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = text
	t.TextColor3 = Color3.fromRGB(255, 230, 80)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.TextStrokeTransparency = 0
	t.Parent = gui
	gui.Parent = head
	Debris:AddItem(gui, 0.8)
end

local function swing(player: Player)
	local ps = State.get(player)
	local char = player.Character
	local hrp = char and char:FindFirstChild("HumanoidRootPart") :: BasePart?
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not ps or not hrp or not hum or hum.Health <= 0 then
		return
	end
	if ps.rl.slap and os.clock() - ps.rl.slap < Config.SLAP_COOLDOWN then
		return
	end
	ps.rl.slap = os.clock()

	local best: any, bestDist = nil, Config.SLAP_RANGE
	for _, other in State.list() do
		if other.player ~= player then
			local oc = other.player.Character
			local ohrp = oc and oc:FindFirstChild("HumanoidRootPart") :: BasePart?
			local ohum = oc and oc:FindFirstChildOfClass("Humanoid")
			if ohrp and ohum and ohum.Health > 0 then
				local delta = ohrp.Position - hrp.Position
				local dist = delta.Magnitude
				if dist < bestDist and (dist < 3 or hrp.CFrame.LookVector:Dot(delta.Unit) > 0.1) then
					best, bestDist = other, dist
				end
			end
		end
	end
	if not best then
		return
	end

	local ohrp = best.player.Character.HumanoidRootPart :: BasePart
	local dir = (ohrp.Position - hrp.Position) * Vector3.new(1, 0, 1)
	dir = if dir.Magnitude > 0.01 then dir.Unit else hrp.CFrame.LookVector
	local carrying = best.carry ~= nil
	local power = if carrying then 70 else 28
	Net.get("Knock"):FireClient(best.player, dir * power + Vector3.new(0, if carrying then 38 else 18, 0))
	Net.get("Sfx"):FireClient(player, "slap")
	Net.get("Sfx"):FireClient(best.player, "slap")
	popText(best.player.Character, if carrying then "SLAPPED!" else "BONK!")

	if carrying then
		local carry = best.carry
		local isOwnerDefending = carry.owner == player
		S.Steal.Return(best, "You got slapped and dropped it!")
		if isOwnerDefending then
			local reward = S.Economy.totalCps(ps) * 60 * Config.DEFEND_REWARD_MINUTES
			reward = math.max(reward, 500)
			S.Economy.addCash(ps, reward, true)
			ps.data.stats.defends += 1
			S.Data.Notify(player, "DEFENDED! +" .. Util.money(reward), "good")
		else
			S.Data.Notify(player, "Nice slap! Goober returned to " .. carry.owner.DisplayName, "good")
		end
	end
end

function Slap.Give(player: Player)
	local backpack = player:FindFirstChildOfClass("Backpack") or player:WaitForChild("Backpack", 5)
	if not backpack or backpack:FindFirstChild("Slap Glove") then
		return
	end
	local tool = Instance.new("Tool")
	tool.Name = "Slap Glove"
	tool.ToolTip = "Click to slap thieves!"
	tool.CanBeDropped = false
	tool.RequiresHandle = true
	tool.Grip = CFrame.new(0, 0, -0.4)

	local handle = Instance.new("Part")
	handle.Name = "Handle"
	handle.Size = Vector3.new(1.3, 1.3, 2)
	handle.Color = Color3.fromRGB(255, 205, 50)
	handle.Material = Enum.Material.SmoothPlastic
	handle.CanCollide = false
	handle.Massless = true
	handle.Parent = tool

	local cuff = Instance.new("Part")
	cuff.Size = Vector3.new(1.5, 1.5, 0.6)
	cuff.Color = Color3.fromRGB(255, 80, 120)
	cuff.Material = Enum.Material.Neon
	cuff.CanCollide = false
	cuff.Massless = true
	cuff.CFrame = handle.CFrame * CFrame.new(0, 0, 1.1)
	cuff.Parent = tool
	local w = Instance.new("WeldConstraint")
	w.Part0 = handle
	w.Part1 = cuff
	w.Parent = cuff

	tool.Activated:Connect(function()
		swing(player)
	end)
	tool.Parent = backpack
end

return Slap
