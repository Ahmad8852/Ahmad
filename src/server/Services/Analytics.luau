-- Thin, failure-proof wrapper around AnalyticsService funnel events (FTUE tracking).

local AnalyticsService = game:GetService("AnalyticsService")

local Analytics = {}

function Analytics.Init(_services: any) end

-- step: 1 joined, 2 first buy, 3 first collect, 4 first steal attempt, 5 first rebirth
function Analytics.step(player: Player, step: number, name: string)
	pcall(function()
		AnalyticsService:LogOnboardingFunnelStepEvent(player, step, name)
	end)
end

function Analytics.custom(player: Player, name: string, value: number?)
	pcall(function()
		AnalyticsService:LogCustomEvent(player, name, value or 1)
	end)
end

return Analytics
