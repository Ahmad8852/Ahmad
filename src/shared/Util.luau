-- Small pure helpers shared by client and server.

local Util = {}

local SUFFIX = { "", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc" }

function Util.formatNumber(n: number): string
	if n ~= n or n == math.huge then
		return "0"
	end
	if n < 1000 then
		return tostring(math.floor(n))
	end
	local idx = math.min(math.floor(math.log10(n) / 3), #SUFFIX - 1)
	local v = n / (10 ^ (idx * 3))
	local s
	if v < 10 then
		s = string.format("%.2f", v)
	elseif v < 100 then
		s = string.format("%.1f", v)
	else
		s = string.format("%.0f", v)
	end
	if string.find(s, "%.") then
		s = string.gsub(s, "0+$", "")
		s = string.gsub(s, "%.$", "")
	end
	return s .. SUFFIX[idx + 1]
end

function Util.money(n: number): string
	return "$" .. Util.formatNumber(n)
end

function Util.formatTime(seconds: number): string
	seconds = math.max(0, math.ceil(seconds))
	local h = seconds // 3600
	local m = (seconds % 3600) // 60
	local s = seconds % 60
	if h > 0 then
		return string.format("%d:%02d:%02d", h, m, s)
	end
	return string.format("%d:%02d", m, s)
end

function Util.deepCopy(t: any): any
	if type(t) ~= "table" then
		return t
	end
	local out = {}
	for k, v in t do
		out[k] = Util.deepCopy(v)
	end
	return out
end

-- items: array, weightFn(item) -> number. Returns the picked item (or nil if all weights are 0).
function Util.weightedPick(items: { any }, weightFn: (any) -> number, rng: Random?)
	local total = 0
	for _, it in items do
		total += math.max(0, weightFn(it))
	end
	if total <= 0 then
		return nil
	end
	local roll = (rng and rng:NextNumber() or math.random()) * total
	for _, it in items do
		roll -= math.max(0, weightFn(it))
		if roll <= 0 then
			return it
		end
	end
	return items[#items]
end

function Util.clamp(n: number, lo: number, hi: number): number
	return math.max(lo, math.min(hi, n))
end

return Util
