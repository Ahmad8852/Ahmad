-- Shared runtime state for the server (player states + server-wide buffs).

local State = {}

-- [Player] = ps  (see Data.LoadPlayer for the shape)
State.byPlayer = {}

-- Server wide luck, bought/earned by anyone and shared with everybody.
State.luck = { mult = 1, endsAt = 0 }

function State.get(player: Player)
	return State.byPlayer[player]
end

function State.list()
	local out = {}
	for _, ps in State.byPlayer do
		table.insert(out, ps)
	end
	return out
end

function State.currentLuck(): number
	if workspace:GetServerTimeNow() < State.luck.endsAt then
		return State.luck.mult
	end
	return 1
end

return State
