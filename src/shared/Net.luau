-- Remote event registry. The server creates every event up front (Net.init),
-- the client simply waits for them.

local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

local Net = {}

Net.EVENTS = {
	-- server -> client
	"Data", -- full snapshot of the local player's state
	"Notify", -- (text, kind)
	"Announce", -- (text, color) server-wide headline
	"Reveal", -- big rarity reveal popup
	"StealAlert", -- someone is stealing from you
	"TideState", -- (state, endsAt, extra)
	"SpinResult", -- (index)
	"Shake", -- (intensity, duration)
	"Sfx", -- (soundKey)
	"Knock", -- (velocity: Vector3) apply a shove to the local character
	-- client -> server
	"Rebirth",
	"ClaimDaily",
	"DoSpin",
	"ClaimGift", -- (index)
	"Redeem", -- (code)
	"UseLock",
	"CollectAll",
	"UpgradeSlot",
	"Director", -- (command, arg)
}

local FOLDER_NAME = "GooberRemotes"

function Net.init()
	assert(RunService:IsServer(), "Net.init is server-only")
	local folder = ReplicatedStorage:FindFirstChild(FOLDER_NAME)
	if not folder then
		folder = Instance.new("Folder")
		folder.Name = FOLDER_NAME
		folder.Parent = ReplicatedStorage
	end
	for _, name in Net.EVENTS do
		if not folder:FindFirstChild(name) then
			local r = Instance.new("RemoteEvent")
			r.Name = name
			r.Parent = folder
		end
	end
end

function Net.get(name: string): RemoteEvent
	local folder = if RunService:IsServer()
		then ReplicatedStorage:FindFirstChild(FOLDER_NAME)
		else ReplicatedStorage:WaitForChild(FOLDER_NAME)
	assert(folder, "Net.init() has not run")
	return (folder :: Instance):WaitForChild(name) :: RemoteEvent
end

return Net
