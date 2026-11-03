-- GOOBER TIDE - server bootstrap.
-- Loads every service in dependency order, then wires the player lifecycle.

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Net = require(Shared.Net)

Net.init()
Players.CharacterAutoLoads = false

local servicesFolder = script.Parent:WaitForChild("Services")

local ORDER = {
	"State",
	"Analytics",
	"Data",
	"Economy",
	"Map",
	"Leaderboard",
	"Plot",
	"Tide",
	"Belt",
	"Steal",
	"Slap",
	"Rewards",
	"Monetization",
	"Director",
}

local S: any = {}
for _, name in ORDER do
	S[name] = require(servicesFolder[name])
end
for _, name in ORDER do
	local svc = S[name]
	if type(svc.Init) == "function" then
		svc.Init(S)
	end
end

local State = S.State

----------------------------------------------------------------------
-- Character handling
----------------------------------------------------------------------
local function onCharacter(player: Player, char: Model)
	local ps = State.get(player)
	local hum = char:WaitForChild("Humanoid", 10) :: Humanoid?
	if not hum then
		return
	end
	hum.Died:Connect(function()
		local current = State.get(player)
		if current then
			S.Steal.OnDied(current)
		end
		task.wait(Players.RespawnTime)
		if player.Parent and State.get(player) then
			player:LoadCharacter()
		end
	end)
	if ps then
		S.Slap.Give(player)
	end
end

local function onPlayerAdded(player: Player)
	player.CharacterAdded:Connect(function(char)
		onCharacter(player, char)
	end)

	local ps = S.Data.LoadPlayer(player)
	if not ps then
		player:Kick("Could not load your save data. Please rejoin - your progress is safe!")
		return
	end
	if not player.Parent then
		S.Data.SaveAndRelease(ps)
		return
	end

	S.Monetization.LoadPasses(ps)
	if not S.Plot.Assign(ps) then
		player:Kick("This server is full of goobers! Please join another server.")
		State.byPlayer[player] = nil
		return
	end
	S.Analytics.step(player, 1, "Joined")
	S.Economy.OfflineEarnings(ps)
	S.Plot.RebuildAll(ps)
	S.Data.Push(ps)
	S.Tide.SendTo(player)
	player:LoadCharacter()
end

local function onPlayerRemoving(player: Player)
	local ps = State.get(player)
	if not ps then
		return
	end
	S.Steal.OnLeaving(ps)
	S.Plot.Release(ps)
	S.Data.SaveAndRelease(ps)
end

Players.PlayerAdded:Connect(function(player)
	task.spawn(onPlayerAdded, player)
end)
Players.PlayerRemoving:Connect(onPlayerRemoving)
for _, player in Players:GetPlayers() do
	task.spawn(onPlayerAdded, player)
end

game:BindToClose(function()
	S.Data.SaveAllOnClose()
end)

print(string.format("[%s] server ready", Config.GAME_NAME))
