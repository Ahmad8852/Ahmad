-- Builds the whole world from code: ground, plaza, the Goober Belt, gates, palms, ocean,
-- boundary walls, leaderboards and lighting. No marketplace assets are required.

local Lighting = game:GetService("Lighting")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)

local Map = {}
local S: any
local M = Config.MAP

local folder: Folder

local function part(props: { [string]: any }, parent: Instance?): Part
	local p = Instance.new("Part")
	p.Anchored = true
	p.TopSurface = Enum.SurfaceType.Smooth
	p.BottomSurface = Enum.SurfaceType.Smooth
	for k, v in props do
		(p :: any)[k] = v
	end
	p.Parent = parent or folder
	return p
end

local function surfaceText(p: BasePart, face: Enum.NormalId, text: string, color: Color3?, bg: Color3?): TextLabel
	local sg = Instance.new("SurfaceGui")
	sg.Face = face
	sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	sg.PixelsPerStud = 40
	sg.LightInfluence = 0
	sg.Parent = p
	local l = Instance.new("TextLabel")
	l.Size = UDim2.fromScale(1, 1)
	l.BackgroundTransparency = if bg then 0 else 1
	l.BackgroundColor3 = bg or Color3.new(0, 0, 0)
	l.Text = text
	l.TextScaled = true
	l.Font = Enum.Font.FredokaOne
	l.TextColor3 = color or Color3.new(1, 1, 1)
	l.TextStrokeTransparency = 0
	l.Parent = sg
	return l
end

----------------------------------------------------------------------
-- Lighting
----------------------------------------------------------------------
local function setupLighting()
	Lighting.ClockTime = 14.5
	Lighting.Brightness = 2.6
	Lighting.Ambient = Color3.fromRGB(110, 120, 140)
	Lighting.OutdoorAmbient = Color3.fromRGB(140, 170, 190)
	Lighting.EnvironmentDiffuseScale = 0.6
	Lighting.EnvironmentSpecularScale = 0.6
	Lighting.GlobalShadows = true
	Lighting.ShadowSoftness = 0.3

	if not Lighting:FindFirstChildOfClass("Sky") then
		Instance.new("Sky").Parent = Lighting
	end
	local atm = Lighting:FindFirstChildOfClass("Atmosphere") or Instance.new("Atmosphere")
	atm.Density = 0.3
	atm.Offset = 0.25
	atm.Color = Color3.fromRGB(199, 225, 255)
	atm.Decay = Color3.fromRGB(255, 220, 180)
	atm.Glare = 0.2
	atm.Haze = 1.0
	atm.Parent = Lighting

	local bloom = Lighting:FindFirstChildOfClass("BloomEffect") or Instance.new("BloomEffect")
	bloom.Intensity = 0.5
	bloom.Size = 28
	bloom.Threshold = 1.6
	bloom.Parent = Lighting

	local cc = Lighting:FindFirstChildOfClass("ColorCorrectionEffect") or Instance.new("ColorCorrectionEffect")
	cc.Saturation = 0.18
	cc.Contrast = 0.08
	cc.TintColor = Color3.fromRGB(255, 250, 245)
	cc.Parent = Lighting

	local rays = Lighting:FindFirstChildOfClass("SunRaysEffect") or Instance.new("SunRaysEffect")
	rays.Intensity = 0.06
	rays.Spread = 0.6
	rays.Parent = Lighting
end

----------------------------------------------------------------------
-- Pieces
----------------------------------------------------------------------
local function buildGround()
	local W = M.WORLD_HALF
	part({ Name = "Ground", Size = Vector3.new(W * 2 + 40, 2, W * 2 + 40), Position = Vector3.new(0, -1, 0), Color = Color3.fromRGB(110, 205, 110), Material = Enum.Material.Grass })
	part({ Name = "PlazaFloor", Size = Vector3.new(190, 0.2, M.BELT_HALF_LENGTH * 2 + 70), Position = Vector3.new(0, 0.1, 0), Color = Color3.fromRGB(240, 222, 170), Material = Enum.Material.Sand })
	for _, sx in { -1, 1 } do
		part({ Name = "PlazaTrim", Size = Vector3.new(2, 0.3, M.BELT_HALF_LENGTH * 2 + 70), Position = Vector3.new(sx * 95, 0.15, 0), Color = Color3.fromRGB(255, 255, 255), Material = Enum.Material.Neon, Transparency = 0.2 })
	end

	-- sea on all four sides + invisible walls
	local seaColor = Color3.fromRGB(40, 150, 235)
	for _, sz in { -1, 1 } do
		part({ Name = "Sea", Size = Vector3.new(W * 2 + 800, 8, 400), Position = Vector3.new(0, -4.3, sz * (W + 220)), Color = seaColor, Material = Enum.Material.Glass, Transparency = 0.25, CanCollide = false })
		part({ Name = "SeaSide", Size = Vector3.new(400, 8, W * 2 + 40), Position = Vector3.new(sz * (W + 220), -4.3, 0), Color = seaColor, Material = Enum.Material.Glass, Transparency = 0.25, CanCollide = false })
		part({ Name = "WallZ", Size = Vector3.new(W * 2 + 80, 120, 2), Position = Vector3.new(0, 60, sz * (W + 10)), Transparency = 1, CanQuery = false })
		part({ Name = "WallX", Size = Vector3.new(2, 120, W * 2 + 80), Position = Vector3.new(sz * (W + 10), 60, 0), Transparency = 1, CanQuery = false })
	end
end

local function buildBelt()
	local H = M.BELT_HALF_LENGTH
	part({ Name = "Belt", Size = Vector3.new(10, 1.4, H * 2 + 12), Position = Vector3.new(0, 0.8, 0), Color = Color3.fromRGB(45, 48, 62), Material = Enum.Material.Metal })
	for _, sx in { -1, 1 } do
		part({ Name = "BeltEdge", Size = Vector3.new(0.7, 1.6, H * 2 + 12), Position = Vector3.new(sx * 5.2, 0.8, 0), Color = Color3.fromRGB(80, 235, 255), Material = Enum.Material.Neon })
	end
	-- direction chevrons
	for z = -H + 10, H - 10, 16 do
		part({ Name = "Chevron", Size = Vector3.new(6, 0.1, 1.2), CFrame = CFrame.new(0, 1.52, z), Color = Color3.fromRGB(255, 220, 80), Material = Enum.Material.Neon, CanCollide = false })
	end

	-- entrance arch
	local z0 = -H - 10
	for _, sx in { -1, 1 } do
		part({ Name = "ArchPillar", Size = Vector3.new(3.5, 26, 3.5), Position = Vector3.new(sx * 10, 13, z0), Color = Color3.fromRGB(255, 120, 190), Material = Enum.Material.SmoothPlastic })
	end
	local beam = part({ Name = "ArchBeam", Size = Vector3.new(26, 7, 3.5), Position = Vector3.new(0, 26, z0), Color = Color3.fromRGB(255, 255, 255), Material = Enum.Material.SmoothPlastic })
	surfaceText(beam, Enum.NormalId.Back, "GOOBER BELT", Color3.fromRGB(255, 90, 160), Color3.fromRGB(255, 255, 255))
	surfaceText(beam, Enum.NormalId.Front, "GOOBER BELT", Color3.fromRGB(255, 90, 160), Color3.fromRGB(255, 255, 255))

	-- exit arch of shame
	local z1 = H + 12
	for _, sx in { -1, 1 } do
		part({ Name = "ExitPillar", Size = Vector3.new(3.5, 20, 3.5), Position = Vector3.new(sx * 10, 10, z1), Color = Color3.fromRGB(70, 60, 90), Material = Enum.Material.Slate })
	end
	local beam2 = part({ Name = "ExitBeam", Size = Vector3.new(26, 6, 3.5), Position = Vector3.new(0, 21, z1), Color = Color3.fromRGB(30, 28, 45), Material = Enum.Material.Slate })
	surfaceText(beam2, Enum.NormalId.Front, "TOO SLOW!", Color3.fromRGB(255, 80, 100), Color3.fromRGB(30, 28, 45))
	surfaceText(beam2, Enum.NormalId.Back, "TOO SLOW!", Color3.fromRGB(255, 80, 100), Color3.fromRGB(30, 28, 45))
end

local function buildPalm(x: number, z: number)
	local h = 13 + math.random() * 3
	part({ Name = "Trunk", Size = Vector3.new(h, 1.6, 1.6), CFrame = CFrame.new(x, h / 2, z) * CFrame.Angles(0, 0, math.rad(90)), Color = Color3.fromRGB(150, 110, 70), Material = Enum.Material.Wood, CanCollide = false })
	for i = 0, 5 do
		local a = i / 6 * math.pi * 2
		local dir = Vector3.new(math.cos(a), 0, math.sin(a))
		part({
			Name = "Leaf",
			Size = Vector3.new(7, 0.3, 2.4),
			CFrame = CFrame.lookAt(Vector3.new(x, h, z) + dir * 3, Vector3.new(x, h + 1.5, z)) * CFrame.Angles(0, math.rad(90), math.rad(-18)),
			Color = Color3.fromRGB(70, 180, 80),
			Material = Enum.Material.Grass,
			CanCollide = false,
		})
	end
end

local function buildDecor()
	math.randomseed(7)
	for z = -M.BELT_HALF_LENGTH, M.BELT_HALF_LENGTH, 34 do
		buildPalm(-68, z + math.random(-6, 6))
		buildPalm(68, z + math.random(-6, 6))
	end
	-- safe-zone hint arrows along the plaza edges
	for _, sx in { -1, 1 } do
		for z = -M.BELT_HALF_LENGTH + 20, M.BELT_HALF_LENGTH - 20, 60 do
			local sign = part({ Name = "TideSign", Size = Vector3.new(9, 4, 0.5), Position = Vector3.new(sx * 80, 5, z), Color = Color3.fromRGB(255, 80, 90), Material = Enum.Material.SmoothPlastic, CanCollide = false })
			surfaceText(sign, Enum.NormalId.Front, "HIGH GROUND", Color3.new(1, 1, 1), Color3.fromRGB(255, 80, 90))
			surfaceText(sign, Enum.NormalId.Back, "HIGH GROUND", Color3.new(1, 1, 1), Color3.fromRGB(255, 80, 90))
			sign.CFrame = CFrame.new(sign.Position) * CFrame.Angles(0, math.rad(90), 0)
		end
	end
	math.randomseed(os.time())
end

local function buildBoards()
	local zb = -M.BELT_HALF_LENGTH - 28
	local specs = {
		{ key = "cash", x = -26, title = "RICHEST EVER", color = Color3.fromRGB(110, 255, 140) },
		{ key = "steals", x = 26, title = "TOP THIEVES", color = Color3.fromRGB(255, 110, 130) },
	}
	for _, spec in specs do
		local board = part({ Name = "Board_" .. spec.key, Size = Vector3.new(34, 22, 1.5), Position = Vector3.new(spec.x, 15, zb), Color = Color3.fromRGB(24, 26, 44), Material = Enum.Material.SmoothPlastic })
		for _, sx in { -1, 1 } do
			part({ Name = "BoardLeg", Size = Vector3.new(1.5, 5, 1.5), Position = Vector3.new(spec.x + sx * 14, 2.5, zb), Color = Color3.fromRGB(60, 62, 90) })
		end
		local sg = Instance.new("SurfaceGui")
		sg.Face = Enum.NormalId.Back
		sg.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		sg.PixelsPerStud = 30
		sg.LightInfluence = 0
		sg.Parent = board
		local title = Instance.new("TextLabel")
		title.Size = UDim2.fromScale(1, 0.14)
		title.BackgroundTransparency = 1
		title.Text = spec.title
		title.TextColor3 = spec.color
		title.Font = Enum.Font.FredokaOne
		title.TextScaled = true
		title.Parent = sg
		local rows = {}
		for i = 1, 10 do
			local l = Instance.new("TextLabel")
			l.Position = UDim2.fromScale(0.04, 0.15 + (i - 1) * 0.084)
			l.Size = UDim2.fromScale(0.92, 0.08)
			l.BackgroundTransparency = 1
			l.Text = i .. ". ---"
			l.TextColor3 = if i <= 3 then Color3.fromRGB(255, 220, 90) else Color3.new(1, 1, 1)
			l.Font = Enum.Font.FredokaOne
			l.TextScaled = true
			l.TextXAlignment = Enum.TextXAlignment.Left
			l.Parent = sg
			rows[i] = l
		end
		S.Leaderboard.Register(spec.key, rows)
	end
end

function Map.Init(services: any)
	S = services
	folder = Instance.new("Folder")
	folder.Name = "GooberWorld"
	folder.Parent = workspace

	setupLighting()
	buildGround()
	buildBelt()
	buildDecor()
	buildBoards()
end

return Map
