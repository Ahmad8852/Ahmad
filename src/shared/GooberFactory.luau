-- Builds a Goober model completely out of primitive Parts (no marketplace assets needed).
-- Used by the server for belt / plot goobers and by the client for index previews.
--
-- The returned Model has:
--   PrimaryPart = "Body" (anchored; all other parts are welded to it, unanchored + massless)
--   Attribute "GroundOffset" = distance from body centre to the bottom of the feet
--   Attribute "Height"        = approximate total height (used for name tag placement)

local CollectionService = game:GetService("CollectionService")
local Config = require(script.Parent.Config)

local Factory = {}

local function newPart(parent: Instance, props: { [string]: any }): Part
	local p = Instance.new("Part")
	p.Anchored = false
	p.CanCollide = false
	p.CanTouch = false
	p.CanQuery = false
	p.Massless = true
	p.CastShadow = false
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	p.Material = Enum.Material.SmoothPlastic
	for k, v in props do
		(p :: any)[k] = v
	end
	p.Parent = parent
	return p
end

local function attach(root: BasePart, part: BasePart, offset: CFrame)
	part.CFrame = root.CFrame * offset
	local w = Instance.new("WeldConstraint")
	w.Part0 = root
	w.Part1 = part
	w.Parent = part
end

type Adder = (shape: Enum.PartType, size: Vector3, offset: CFrame, color: Color3, material: Enum.Material?, transparency: number?) -> Part

-- Feature builders. s = overall scale. Each uses add(shape, size, offset, color, material, transparency)
local FEATURES: { [string]: (add: Adder, s: number, body: Part) -> () } = {
	cheeks = function(add, s)
		for _, sx in { -1, 1 } do
			add(Enum.PartType.Ball, Vector3.new(0.5, 0.5, 0.25) * s, CFrame.new(sx * 1.0 * s, -0.25 * s, -1.2 * s), Color3.fromRGB(255, 110, 150))
		end
	end,
	bigteeth = function(add, s)
		for _, sx in { -0.17, 0.17 } do
			add(Enum.PartType.Block, Vector3.new(0.3, 0.4, 0.12) * s, CFrame.new(sx * s, -0.62 * s, -1.38 * s), Color3.new(1, 1, 1))
		end
	end,
	antenna = function(add, s)
		add(Enum.PartType.Cylinder, Vector3.new(1.3, 0.12, 0.12) * s, CFrame.new(0, 1.9 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(60, 60, 70))
		add(Enum.PartType.Ball, Vector3.new(0.5, 0.5, 0.5) * s, CFrame.new(0, 2.6 * s, 0), Color3.fromRGB(255, 80, 120), Enum.Material.Neon)
	end,
	sprout = function(add, s)
		add(Enum.PartType.Cylinder, Vector3.new(0.8, 0.12, 0.12) * s, CFrame.new(0, 1.8 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(70, 160, 60))
		for _, sx in { -1, 1 } do
			add(Enum.PartType.Ball, Vector3.new(0.8, 0.12, 0.45) * s, CFrame.new(sx * 0.4 * s, 2.25 * s, 0) * CFrame.Angles(0, 0, sx * math.rad(-20)), Color3.fromRGB(90, 200, 80))
		end
	end,
	headphones = function(add, s)
		for _, sx in { -1, 1 } do
			add(Enum.PartType.Cylinder, Vector3.new(0.5, 1.0, 1.0) * s, CFrame.new(sx * 1.5 * s, 0.1 * s, 0), Color3.fromRGB(35, 35, 45))
		end
		add(Enum.PartType.Block, Vector3.new(3.2, 0.18, 0.35) * s, CFrame.new(0, 1.42 * s, 0), Color3.fromRGB(35, 35, 45))
	end,
	unibrow = function(add, s)
		add(Enum.PartType.Block, Vector3.new(1.5, 0.22, 0.12) * s, CFrame.new(0, 0.85 * s, -1.3 * s) * CFrame.Angles(math.rad(-10), 0, 0), Color3.fromRGB(50, 35, 30))
	end,
	tail = function(add, s)
		for i = 1, 3 do
			add(Enum.PartType.Ball, Vector3.one * (0.7 - i * 0.12) * s, CFrame.new(0, (-0.6 + i * 0.22) * s, (1.4 + i * 0.5) * s), Color3.fromRGB(255, 255, 255))
		end
	end,
	partyhat = function(add, s)
		local cols = { Color3.fromRGB(255, 80, 150), Color3.fromRGB(255, 230, 70), Color3.fromRGB(80, 200, 255) }
		for i = 1, 3 do
			local w = (1.3 - (i - 1) * 0.4) * s
			add(Enum.PartType.Cylinder, Vector3.new(0.5 * s, w, w), CFrame.new(0, (1.55 + (i - 1) * 0.45) * s, 0) * CFrame.Angles(0, 0, math.rad(90)), cols[i])
		end
	end,
	tophat = function(add, s)
		add(Enum.PartType.Cylinder, Vector3.new(0.18, 2.4, 2.4) * s, CFrame.new(0, 1.45 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(25, 25, 30))
		add(Enum.PartType.Cylinder, Vector3.new(1.3, 1.5, 1.5) * s, CFrame.new(0, 2.1 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(25, 25, 30))
		add(Enum.PartType.Cylinder, Vector3.new(0.3, 1.55, 1.55) * s, CFrame.new(0, 1.7 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(200, 40, 50))
	end,
	mustache = function(add, s)
		for _, sx in { -1, 1 } do
			add(Enum.PartType.Block, Vector3.new(0.75, 0.2, 0.18) * s, CFrame.new(sx * 0.38 * s, -0.22 * s, -1.45 * s) * CFrame.Angles(0, 0, sx * math.rad(12)), Color3.fromRGB(70, 45, 30))
		end
	end,
	bowtie = function(add, s)
		for _, sx in { -1, 1 } do
			add(Enum.PartType.Block, Vector3.new(0.55, 0.45, 0.2) * s, CFrame.new(sx * 0.33 * s, -1.0 * s, -1.1 * s) * CFrame.Angles(0, sx * math.rad(-20), sx * math.rad(15)), Color3.fromRGB(230, 50, 70))
		end
		add(Enum.PartType.Ball, Vector3.new(0.3, 0.3, 0.3) * s, CFrame.new(0, -1.0 * s, -1.2 * s), Color3.fromRGB(180, 30, 50))
	end,
	spikes = function(add, s)
		for i = 0, 4 do
			local a = (i / 5) * math.pi * 2
			local ox, oz = math.cos(a) * 0.8, math.sin(a) * 0.8
			add(
				Enum.PartType.Block,
				Vector3.new(0.35, 0.9, 0.35) * s,
				CFrame.new(ox * s, 1.35 * s, oz * s) * CFrame.Angles(math.rad(oz * 25), 0, math.rad(-ox * 25)),
				Color3.fromRGB(255, 240, 200)
			)
		end
	end,
	horns = function(add, s)
		for _, sx in { -1, 1 } do
			add(
				Enum.PartType.Cylinder,
				Vector3.new(1.5, 0.5, 0.5) * s,
				CFrame.new(sx * 0.95 * s, 1.35 * s, 0) * CFrame.Angles(0, 0, math.rad(90 - sx * 28)),
				Color3.fromRGB(250, 240, 220)
			)
		end
	end,
	crown = function(add, s)
		add(Enum.PartType.Cylinder, Vector3.new(0.55, 1.7, 1.7) * s, CFrame.new(0, 1.65 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(255, 205, 50), Enum.Material.Neon)
		for i = 0, 4 do
			local a = (i / 5) * math.pi * 2
			add(Enum.PartType.Block, Vector3.new(0.3, 0.55, 0.3) * s, CFrame.new(math.cos(a) * 0.7 * s, 2.15 * s, math.sin(a) * 0.7 * s), Color3.fromRGB(255, 205, 50), Enum.Material.Neon)
		end
		add(Enum.PartType.Ball, Vector3.new(0.35, 0.35, 0.35) * s, CFrame.new(0, 1.7 * s, -0.85 * s), Color3.fromRGB(255, 60, 90), Enum.Material.Neon)
	end,
	halo = function(add, s)
		add(Enum.PartType.Cylinder, Vector3.new(0.12, 2.1, 2.1) * s, CFrame.new(0, 2.35 * s, 0) * CFrame.Angles(0, 0, math.rad(90)), Color3.fromRGB(255, 240, 120), Enum.Material.Neon, 0.25)
	end,
	wings = function(add, s)
		for _, sx in { -1, 1 } do
			add(Enum.PartType.Block, Vector3.new(2.2, 0.18, 1.5) * s, CFrame.new(sx * 1.9 * s, 0.6 * s, 1.1 * s) * CFrame.Angles(math.rad(10), sx * math.rad(-25), sx * math.rad(20)), Color3.fromRGB(255, 255, 255), Enum.Material.Neon, 0.15)
		end
	end,
	sunglasses = function(add, s)
		add(Enum.PartType.Block, Vector3.new(2.3, 0.5, 0.18) * s, CFrame.new(0, 0.33 * s, -1.62 * s), Color3.fromRGB(10, 10, 14))
		add(Enum.PartType.Block, Vector3.new(0.3, 0.12, 0.12) * s, CFrame.new(0, 0.4 * s, -1.66 * s), Color3.fromRGB(10, 10, 14))
	end,
	flame = function(_add, _s, body)
		local f = Instance.new("Fire")
		f.Heat = 8
		f.Size = 6
		f.Parent = body
	end,
	sparkles = function(_add, _s, body)
		local sp = Instance.new("Sparkles")
		sp.Parent = body
	end,
}

local function applyMutation(model: Model, body: Part, mutName: string, def: any)
	if mutName == "Normal" then
		return
	end
	local mut = Config.Mutations[mutName]
	if not mut then
		return
	end
	model:SetAttribute("Mutation", mutName)
	if mutName == "Gold" then
		body.Color = Color3.fromRGB(255, 200, 40)
		body.Material = Enum.Material.Metal
		local sp = Instance.new("Sparkles")
		sp.SparkleColor = Color3.fromRGB(255, 220, 90)
		sp.Parent = body
	elseif mutName == "Slimy" then
		body.Color = Color3.fromRGB(80, 255, 70)
		body.Material = Enum.Material.Glass
		body.Transparency = 0.2
	elseif mutName == "Lava" then
		body.Color = Color3.fromRGB(255, 90, 20)
		body.Material = Enum.Material.Neon
		local f = Instance.new("Fire")
		f.Heat = 10
		f.Size = 8
		f.Color = Color3.fromRGB(255, 120, 30)
		f.SecondaryColor = Color3.fromRGB(180, 20, 0)
		f.Parent = body
	elseif mutName == "Rainbow" then
		body.Material = Enum.Material.Neon
		model:SetAttribute("Rainbow", true)
		local p = Instance.new("ParticleEmitter")
		p.Rate = 14
		p.Lifetime = NumberRange.new(0.8, 1.4)
		p.Speed = NumberRange.new(1, 3)
		p.Size = NumberSequence.new(0.5, 0)
		p.LightEmission = 1
		p.Color = ColorSequence.new({
			ColorSequenceKeypoint.new(0, Color3.fromRGB(255, 80, 80)),
			ColorSequenceKeypoint.new(0.33, Color3.fromRGB(255, 240, 80)),
			ColorSequenceKeypoint.new(0.66, Color3.fromRGB(80, 255, 140)),
			ColorSequenceKeypoint.new(1, Color3.fromRGB(120, 120, 255)),
		})
		p.Parent = body
	elseif mutName == "Tidal" then
		body.Color = Color3.fromRGB(60, 170, 255)
		body.Material = Enum.Material.Glass
		body.Transparency = 0.15
		local p = Instance.new("ParticleEmitter")
		p.Rate = 18
		p.Lifetime = NumberRange.new(0.6, 1.1)
		p.Speed = NumberRange.new(2, 5)
		p.SpreadAngle = Vector2.new(60, 60)
		p.Acceleration = Vector3.new(0, -12, 0)
		p.Size = NumberSequence.new(0.35, 0)
		p.LightEmission = 0.6
		p.Color = ColorSequence.new(Color3.fromRGB(120, 210, 255))
		p.Parent = body
	end
end

function Factory.build(def: any, mutName: string?): Model
	mutName = mutName or "Normal"
	local rar = Config.Rarity[def.rarity]
	local s: number = (def.scale or 1) * rar.scale

	local model = Instance.new("Model")
	model.Name = def.name
	model:SetAttribute("DefId", def.id)
	model:SetAttribute("Rarity", def.rarity)
	model:SetAttribute("Scale", s)

	local body = newPart(model, {
		Name = "Body",
		Shape = Enum.PartType.Ball,
		Size = Vector3.new(3, 3, 3) * s,
		Color = def.color,
		Anchored = true,
		CanQuery = true,
		Material = if def.neon then Enum.Material.Neon else Enum.Material.SmoothPlastic,
		Transparency = def.transparency or 0,
	})
	body.CFrame = CFrame.new(0, 0, 0)
	model.PrimaryPart = body

	local function add(shape, size, offset, color, material, transparency)
		local p = newPart(model, {
			Shape = shape,
			Size = size,
			Color = color,
			Material = material or Enum.Material.SmoothPlastic,
			Transparency = transparency or 0,
		})
		attach(body, p, offset)
		return p
	end

	-- feet
	for _, sx in { -0.75, 0.75 } do
		add(Enum.PartType.Ball, Vector3.new(0.95, 0.7, 1.15) * s, CFrame.new(sx * s, -1.38 * s, -0.15 * s), def.color:Lerp(Color3.new(0, 0, 0), 0.25))
	end
	-- eyes (slightly cross-eyed = funnier)
	for _, sx in { -1, 1 } do
		add(Enum.PartType.Ball, Vector3.new(0.9, 0.9, 0.9) * s, CFrame.new(sx * 0.55 * s, 0.4 * s, -1.28 * s), Color3.new(1, 1, 1))
		add(Enum.PartType.Ball, Vector3.new(0.42, 0.42, 0.42) * s, CFrame.new(sx * 0.46 * s, 0.38 * s, -1.68 * s), Color3.new(0, 0, 0))
	end
	-- mouth
	add(Enum.PartType.Block, Vector3.new(0.75, 0.16, 0.1) * s, CFrame.new(0, -0.38 * s, -1.44 * s), Color3.fromRGB(40, 20, 25))

	for _, f in def.features do
		local fn = FEATURES[f]
		if fn then
			fn(add, s, body)
		end
	end

	if def.rainbow then
		model:SetAttribute("Rainbow", true)
	end
	if def.rarity == "Secret" or def.rarity == "Mythic" then
		local glow = Instance.new("PointLight")
		glow.Color = rar.color
		glow.Range = 14
		glow.Brightness = 1.5
		glow.Parent = body
	end

	applyMutation(model, body, mutName, def)

	if model:GetAttribute("Rainbow") then
		CollectionService:AddTag(model, "RainbowGoober")
	end
	model:SetAttribute("GroundOffset", 1.75 * s)
	model:SetAttribute("Height", 3.4 * s)
	return model
end

-- Lets a carried / stolen copy follow a character instead of being anchored.
function Factory.makeLoose(model: Model)
	for _, d in model:GetDescendants() do
		if d:IsA("BasePart") then
			d.Anchored = false
			d.CanCollide = false
			d.Massless = true
		end
	end
end

return Factory
