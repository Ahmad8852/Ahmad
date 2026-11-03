-- Two global boards in the plaza: richest players and top thieves (OrderedDataStores).

local DataStoreService = game:GetService("DataStoreService")
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Shared = ReplicatedStorage:WaitForChild("Shared")
local Config = require(Shared.Config)
local Util = require(Shared.Util)
local State = require(script.Parent.State)

local Leaderboard = {}
local S: any
local nameCache: { [number]: string } = {}

local boards: { [string]: any } = {}

local function nameOf(userId: number): string
	if nameCache[userId] then
		return nameCache[userId]
	end
	local ok, n = pcall(function()
		return Players:GetNameFromUserIdAsync(userId)
	end)
	nameCache[userId] = if ok then n else ("Player" .. userId)
	return nameCache[userId]
end

local function render(board: any, rows: { any }, formatter: (number) -> string)
	for i = 1, 10 do
		local label = board.rows[i]
		local row = rows[i]
		if label then
			if row then
				label.Text = string.format("%d. %s  -  %s", i, nameOf(tonumber(row.key) :: number), formatter(row.value))
			else
				label.Text = string.format("%d. ---", i)
			end
		end
	end
end

-- Called by Map once the SurfaceGuis exist: boards = { cash = {rows}, steals = {rows} }
function Leaderboard.Register(name: string, rows: { TextLabel })
	boards[name] = { rows = rows }
end

function Leaderboard.Init(services: any)
	S = services
	local okC, cashStore = pcall(function()
		return DataStoreService:GetOrderedDataStore(Config.LB_CASH_STORE)
	end)
	local okS, stealStore = pcall(function()
		return DataStoreService:GetOrderedDataStore(Config.LB_STEAL_STORE)
	end)
	if not (okC and okS) then
		return
	end

	task.spawn(function()
		task.wait(8)
		while true do
			-- publish
			for _, ps in State.list() do
				if not ps.ephemeral then
					local earned = math.floor(math.min(ps.data.stats.totalEarned, 9e15))
					pcall(function()
						cashStore:SetAsync(tostring(ps.player.UserId), earned)
						stealStore:SetAsync(tostring(ps.player.UserId), ps.data.stats.steals)
					end)
				end
			end
			-- fetch
			if boards.cash then
				local ok, pages = pcall(function()
					return cashStore:GetSortedAsync(false, 10)
				end)
				if ok then
					local rows = {}
					for _, e in pages:GetCurrentPage() do
						table.insert(rows, e)
					end
					render(boards.cash, rows, function(v)
						return Util.money(v)
					end)
				end
			end
			if boards.steals then
				local ok, pages = pcall(function()
					return stealStore:GetSortedAsync(false, 10)
				end)
				if ok then
					local rows = {}
					for _, e in pages:GetCurrentPage() do
						table.insert(rows, e)
					end
					render(boards.steals, rows, function(v)
						return Util.formatNumber(v) .. " steals"
					end)
				end
			end
			task.wait(120)
		end
	end)
end

return Leaderboard
