-- Holds the latest snapshot from the server and notifies listeners.

local Players = game:GetService("Players")

local ClientState = {}

ClientState.data = nil :: any
ClientState.tide = { state = "Idle", endsAt = 0 }

local listeners: { (any) -> () } = {}

function ClientState.set(snapshot: any)
	ClientState.data = snapshot
	for _, f in listeners do
		task.spawn(f, snapshot)
	end
end

function ClientState.onChanged(f: (any) -> ())
	table.insert(listeners, f)
	if ClientState.data then
		task.spawn(f, ClientState.data)
	end
end

function ClientState.now(): number
	return workspace:GetServerTimeNow()
end

ClientState.player = Players.LocalPlayer

return ClientState
