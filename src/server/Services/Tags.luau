-- Floating name tags (BillboardGuis) built from code.

local Config = require(game:GetService("ReplicatedStorage").Shared.Config)
local Util = require(game:GetService("ReplicatedStorage").Shared.Util)

local Tags = {}

local function label(parent: Instance, name: string, y: number, h: number, text: string, color: Color3, font: Enum.Font?)
	local l = Instance.new("TextLabel")
	l.Name = name
	l.BackgroundTransparency = 1
	l.Position = UDim2.fromScale(0, y)
	l.Size = UDim2.fromScale(1, h)
	l.Text = text
	l.TextColor3 = color
	l.TextScaled = true
	l.Font = font or Enum.Font.FredokaOne
	l.TextStrokeTransparency = 0
	l.TextStrokeColor3 = Color3.new(0, 0, 0)
	l.Parent = parent
	return l
end

-- Tag shown above a goober. showPrice=true on the belt, otherwise shows income.
function Tags.goober(root: BasePart, def, mutName: string, showPrice: boolean)
	local rar = Config.Rarity[def.rarity]
	local mut = Config.Mutations[mutName]
	local height = (root.Parent :: Model):GetAttribute("Height") or 4

	local gui = Instance.new("BillboardGui")
	gui.Name = "Tag"
	gui.Size = UDim2.fromOffset(230, 104)
	gui.StudsOffset = Vector3.new(0, height * 0.5 + 2.4, 0)
	gui.AlwaysOnTop = false
	gui.MaxDistance = if showPrice then 95 else 60
	gui.LightInfluence = 0
	gui.Adornee = root
	gui.Parent = root

	local lineY = 0
	label(gui, "Rarity", lineY, 0.22, string.upper(def.rarity), rar.color)
	lineY += 0.22
	local nameText = def.name
	local nameColor = Color3.new(1, 1, 1)
	if mutName ~= "Normal" then
		nameText = mutName .. " " .. def.name
		nameColor = mut.color
	end
	label(gui, "Name", lineY, 0.3, nameText, nameColor)
	lineY += 0.3
	if showPrice then
		label(gui, "Price", lineY, 0.26, Util.money(Config.priceOf(def, mutName)), Color3.fromRGB(110, 255, 130))
		lineY += 0.26
	end
	label(gui, "Income", lineY, 0.22, "+" .. Util.money(Config.cpsOf(def, mutName)) .. "/s", Color3.fromRGB(255, 235, 140))
	return gui
end

function Tags.simple(parent: Instance, adornee: BasePart, text: string, subText: string?, offset: Vector3, size: Vector2, maxDistance: number)
	local gui = Instance.new("BillboardGui")
	gui.Name = "Sign"
	gui.Size = UDim2.fromOffset(size.X, size.Y)
	gui.StudsOffset = offset
	gui.MaxDistance = maxDistance
	gui.AlwaysOnTop = false
	gui.LightInfluence = 0
	gui.Adornee = adornee
	gui.Parent = parent
	label(gui, "Title", 0, if subText then 0.6 else 1, text, Color3.new(1, 1, 1))
	if subText then
		label(gui, "Sub", 0.6, 0.4, subText, Color3.fromRGB(255, 235, 140))
	end
	return gui
end

return Tags
