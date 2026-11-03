-- The steal loop: hold E on a goober in someone else's base, run it back to your own base.
-- While a goober is "in transit" it stays owned (and saved) by the victim, so a crash or
-- disconnect can never duplicate or delete it.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local Net = require(Shared.Net)
local Factory = require(Shared.GooberFactory)
local State = require(script.Parent.State)
local Tags = require(script.Parent.Tags)

local Steal = {}
local S: any

local function hrpOf(player: Player): BasePart?
	local c = player.Character
	return c and c:FindFirstChild("HumanoidRootPart") :: BasePart?
end

local function attachVisual(ps: any, def: any, mut: string)
	local char = ps.player.Character
	local hrp = hrpOf(ps.player)
	if not char or not hrp then
		return nil
	end
	local model = Factory.build(def, mut)
	model.Name = "CarriedGoober"
	model:ScaleTo(0.55)
	local body = model.PrimaryPart :: BasePart
	model:PivotTo(hrp.CFrame * CFrame.new(0, 3.2 + body.Size.Y * 0.5, 0))
	Factory.makeLoose(model)
	local w = Instance.new("WeldConstraint")
	w.Part0 = hrp
	w.Part1 = body
	w.Parent = body
	model.Parent = char

	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(200, 50)
	gui.StudsOffset = Vector3.new(0, body.Size.Y * 0.5 + 1.8, 0)
	gui.AlwaysOnTop = true
	gui.Adornee = body
	gui.Parent = body
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = "STOLEN! SLAP HIM!"
	t.TextColor3 = Color3.fromRGB(255, 80, 100)
	t.Font = Enum.Font.FredokaOne
	t.TextScaled = true
	t.TextStrokeTransparency = 0
	t.Parent = gui
	return model
end

function Steal.TryStart(thief: Player, plot: any, slot: number)
	local tps = State.get(thief)
	local owner: Player? = plot.owner
	if not tps or not owner or owner == thief then
		return
	end
	local ops = State.get(owner)
	if not ops then
		return
	end
	if tps.carry then
		S.Data.Notify(thief, "You're already carrying a goober!", "error")
		return
	end
	if workspace:GetServerTimeNow() < plot.lockedUntil then
		S.Data.Notify(thief, "That base is locked!", "error")
		return
	end
	local entry = ops.slots[slot]
	if not entry or entry.inTransit then
		return
	end
	local model = plot.models[slot]
	local hrp = hrpOf(thief)
	local hum = thief.Character and thief.Character:FindFirstChildOfClass("Humanoid")
	if not hrp or not hum or hum.Health <= 0 or not model or not model.PrimaryPart then
		return
	end
	if (hrp.Position - model.PrimaryPart.Position).Magnitude > 22 then
		return
	end
	if not S.Economy.freeSlot(tps) then
		S.Data.Notify(thief, "Free up a slot in your base first!", "error")
		return
	end
	local def = Config.CreatureById[entry.id]
	if not def then
		return
	end

	entry.inTransit = true
	entry.stash = 0
	S.Plot.RefreshSlot(ops, slot)

	tps.carry = { owner = owner, slot = slot, entry = entry, id = entry.id, mut = entry.mut }
	tps.carry.visual = attachVisual(tps, def, entry.mut)
	hum.WalkSpeed = Config.CARRY_WALKSPEED

	local rar = Config.Rarity[def.rarity]
	Net.get("StealAlert"):FireClient(owner, thief.DisplayName, def.name, def.rarity)
	S.Plot.Alarm(plot)
	Net.get("Sfx"):FireClient(owner, "alarm")
	Net.get("Notify"):FireClient(thief, "Run it back to YOUR base!", "good")
	if rar.order >= 5 then
		Net.get("Announce"):FireAllClients(thief.DisplayName .. " is stealing a " .. string.upper(def.rarity) .. " " .. def.name .. " from " .. owner.DisplayName .. "!!", rar.color)
	end
	if not tps.data.tutorial.stole then
		tps.data.tutorial.stole = true
		S.Analytics.step(thief, 4, "FirstStealAttempt")
	end
	S.Data.MarkDirty(tps)
	S.Data.MarkDirty(ops)
end

local function clearCarry(tps: any)
	local carry = tps.carry
	tps.carry = nil
	if carry and carry.visual then
		carry.visual:Destroy()
	end
	local char = tps.player.Character
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if hum then
		hum.WalkSpeed = 16
	end
	S.Data.MarkDirty(tps)
	return carry
end

-- Goober goes back to its owner (slap, death, disconnect...).
function Steal.Return(tps: any, reason: string?)
	local carry = clearCarry(tps)
	if not carry then
		return
	end
	local ops = State.get(carry.owner)
	if ops and ops.slots[carry.slot] == carry.entry then
		carry.entry.inTransit = nil
		S.Plot.RefreshSlot(ops, carry.slot)
		S.Data.MarkDirty(ops)
		local def = Config.CreatureById[carry.id]
		Net.get("Notify"):FireClient(carry.owner, (def and def.name or "Your goober") .. " is back home!", "good")
	end
	if reason and tps.player.Parent then
		Net.get("Notify"):FireClient(tps.player, reason, "error")
	end
end

local function deliver(tps: any)
	local carry = tps.carry
	if not carry then
		return
	end
	local ops = State.get(carry.owner)
	if not ops or ops.slots[carry.slot] ~= carry.entry then
		Steal.Return(tps, "The goober vanished!")
		return
	end
	local free = S.Economy.freeSlot(tps)
	if not free then
		if not tps.rl.noSlotMsg or os.clock() - tps.rl.noSlotMsg > 4 then
			tps.rl.noSlotMsg = os.clock()
			S.Data.Notify(tps.player, "No free slot! Make room to bank your loot!", "error")
		end
		return
	end
	local def = Config.CreatureById[carry.id]
	local mut = carry.mut
	clearCarry(tps)

	ops.slots[carry.slot] = nil
	ops.data.stats.stolen += 1
	S.Plot.RefreshSlot(ops, carry.slot)
	S.Data.MarkDirty(ops)
	Net.get("Notify"):FireClient(carry.owner, tps.player.DisplayName .. " got away with your " .. def.name .. "...", "error")

	S.Plot.PlaceNew(tps, free, def.id, mut)
	tps.data.stats.steals += 1
	local rar = Config.Rarity[def.rarity]
	Net.get("Notify"):FireClient(tps.player, "Stolen! " .. def.name .. " is yours now!", "good")
	Net.get("Sfx"):FireClient(tps.player, "reveal")
	if rar.order >= 4 then
		Net.get("Reveal"):FireClient(tps.player, {
			title = "STOLEN " .. string.upper(def.rarity) .. "!",
			name = (if mut ~= "Normal" then mut .. " " else "") .. def.name,
			color = rar.color,
			rarity = def.rarity,
			cps = Config.cpsOf(def, mut),
		})
	end
	if rar.order >= 5 then
		Net.get("Announce"):FireAllClients(tps.player.DisplayName .. " STOLE a " .. string.upper(def.rarity) .. " " .. def.name .. " from " .. carry.owner.DisplayName .. "!!!", rar.color)
	end
end

function Steal.OnDied(ps: any)
	if ps.carry then
		Steal.Return(ps, "You dropped the goober!")
	end
end

function Steal.OnLeaving(ps: any)
	if ps.carry then
		Steal.Return(ps, nil)
	end
	-- anyone carrying something that belongs to the leaving player loses it (the owner keeps it)
	for _, other in State.list() do
		if other ~= ps and other.carry and other.carry.owner == ps.player then
			Steal.Return(other, "The owner left - goober returned.")
		end
	end
end

function Steal.Init(services: any)
	S = services
	task.spawn(function()
		while true do
			task.wait(0.2)
			for _, ps in State.list() do
				if ps.carry and ps.plot then
					local hrp = hrpOf(ps.player)
					if hrp and S.Plot.ContainsPosition(ps.plot, hrp.Position) then
						deliver(ps)
					end
				end
			end
		end
	end)
end

return Steal
