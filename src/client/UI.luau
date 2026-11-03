-- Tiny UI toolkit: everything in Goober Tide's interface is built from code.

local TweenService = game:GetService("TweenService")

local UI = {}

UI.Theme = {
	bg = Color3.fromRGB(22, 25, 48),
	panel = Color3.fromRGB(34, 38, 70),
	panel2 = Color3.fromRGB(48, 53, 94),
	pink = Color3.fromRGB(255, 90, 160),
	cyan = Color3.fromRGB(70, 220, 255),
	good = Color3.fromRGB(80, 230, 130),
	bad = Color3.fromRGB(255, 85, 100),
	gold = Color3.fromRGB(255, 205, 70),
	text = Color3.fromRGB(255, 255, 255),
	dim = Color3.fromRGB(170, 176, 210),
}

UI.FONT = Enum.Font.FredokaOne

function UI.make(class: string, props: { [string]: any }?, children: { Instance }?): any
	local inst = Instance.new(class)
	local parent
	for k, v in props or {} do
		if k == "Parent" then
			parent = v
		else
			(inst :: any)[k] = v
		end
	end
	for _, c in children or {} do
		c.Parent = inst
	end
	if parent then
		inst.Parent = parent
	end
	return inst
end

function UI.corner(inst: Instance, radius: number?): UICorner
	return UI.make("UICorner", { CornerRadius = UDim.new(0, radius or 12), Parent = inst })
end

function UI.stroke(inst: Instance, color: Color3?, thickness: number?): UIStroke
	return UI.make("UIStroke", { Color = color or Color3.new(0, 0, 0), Thickness = thickness or 2, Parent = inst })
end

function UI.label(parent: Instance, text: string, props: { [string]: any }?): TextLabel
	local p: { [string]: any } = {
		BackgroundTransparency = 1,
		Text = text,
		Font = UI.FONT,
		TextColor3 = UI.Theme.text,
		TextScaled = true,
		Size = UDim2.fromScale(1, 1),
		Parent = parent,
	}
	local stroke = true
	for k, v in props or {} do
		if k == "Stroke" then
			stroke = v
		else
			p[k] = v
		end
	end
	local l = UI.make("TextLabel", p)
	if stroke then
		UI.make("UIStroke", { Color = Color3.new(0, 0, 0), Thickness = 1.5, Transparency = 0.2, Parent = l })
	end
	return l
end

function UI.button(parent: Instance, text: string, color: Color3, props: { [string]: any }?, onClick: (() -> ())?): TextButton
	local p: { [string]: any } = {
		BackgroundColor3 = color,
		Text = text,
		Font = UI.FONT,
		TextColor3 = UI.Theme.text,
		TextScaled = true,
		AutoButtonColor = true,
		Size = UDim2.fromOffset(120, 44),
		Parent = parent,
	}
	for k, v in props or {} do
		p[k] = v
	end
	local b = UI.make("TextButton", p)
	UI.corner(b, 12)
	UI.stroke(b, Color3.new(0, 0, 0), 2)
	UI.make("UIPadding", { PaddingLeft = UDim.new(0, 8), PaddingRight = UDim.new(0, 8), PaddingTop = UDim.new(0, 5), PaddingBottom = UDim.new(0, 5), Parent = b })
	if onClick then
		b.Activated:Connect(onClick)
	end
	return b
end

function UI.tween(inst: Instance, seconds: number, goal: { [string]: any }, style: Enum.EasingStyle?, dir: Enum.EasingDirection?): Tween
	local t = TweenService:Create(inst, TweenInfo.new(seconds, style or Enum.EasingStyle.Quad, dir or Enum.EasingDirection.Out), goal)
	t:Play()
	return t
end

function UI.dot(parent: Instance): Frame
	local d = UI.make("Frame", {
		Name = "Dot",
		BackgroundColor3 = UI.Theme.bad,
		Size = UDim2.fromOffset(18, 18),
		Position = UDim2.new(1, -6, 0, -6),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Visible = false,
		ZIndex = 5,
		Parent = parent,
	})
	UI.corner(d, 9)
	UI.stroke(d, Color3.new(1, 1, 1), 2)
	return d
end

return UI
