import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import {
  CloudSun,
  Sun,
  CloudRain,
  Cloud,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  RotateCw,
  MapPin,
  LocateFixed,
  Search,
} from 'lucide-react';

export const WeatherWidget: React.FC = React.memo(() => {
  const {
    appData,
    weather,
    isWeatherLoading,
    refreshWeather,
    detectMyWeatherLocation,
    searchAndSaveWeatherLocation,
  } = useVault();
  const [cityQuery, setCityQuery] = useState('');
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  const configuredCity = (appData?.settings?.weatherLocation || '').trim();

  const getWeatherIcon = (code?: number) => {
    if (code === undefined) return <CloudSun className="w-6 h-6 text-amber-400" />;
    if (code === 0 || code === 1) return <Sun className="w-6 h-6 text-amber-400" />;
    if (code === 2 || code === 3) return <CloudSun className="w-6 h-6 text-sky-400" />;
    if (code >= 51 && code <= 65) return <CloudRain className="w-6 h-6 text-blue-400" />;
    if (code >= 71 && code <= 86) return <CloudSnow className="w-6 h-6 text-indigo-300" />;
    if (code >= 95) return <CloudLightning className="w-6 h-6 text-amber-300" />;
    return <Cloud className="w-6 h-6 text-zinc-400" />;
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityQuery.trim()) return;
    const ok = await searchAndSaveWeatherLocation(cityQuery.trim());
    if (ok) {
      setCityQuery('');
      setIsEditingLocation(false);
    }
  };

  if (!configuredCity || isEditingLocation) {
    return (
      <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Set Local Weather Location</span>
          </div>
          {configuredCity && (
            <button
              type="button"
              onClick={() => setIsEditingLocation(false)}
              className="text-[11px] font-mono text-zinc-400 hover:text-white"
            >
              Cancel
            </button>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => {
              void detectMyWeatherLocation().then((ok) => {
                if (ok) setIsEditingLocation(false);
              });
            }}
            disabled={isWeatherLoading}
            className="min-h-[44px] sm:min-h-0 px-3 py-2 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors shrink-0"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Detect My Location</span>
          </button>
          <form onSubmit={handleSearchSubmit} className="flex flex-1 gap-1.5">
            <input
              type="text"
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Search City / ZIP..."
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl bg-[#000000] border border-[#1E222B] text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
            <button
              type="submit"
              disabled={isWeatherLoading || !cityQuery.trim()}
              className="min-h-[44px] sm:min-h-0 px-3 py-1.5 rounded-xl bg-[#000000] hover:bg-[#111319] border border-[#1E222B] text-xs font-semibold text-zinc-200 flex items-center gap-1"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Set</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-[#000000] border border-[#1E222B] shadow-lg flex items-center justify-between gap-4">
      <div className="flex items-center gap-3.5">
        <div className="p-3 rounded-xl bg-[#000000] border border-[#1E222B] shrink-0">
          {getWeatherIcon(weather?.weatherCode)}
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <button
              type="button"
              onClick={() => setIsEditingLocation(true)}
              className="text-zinc-200 hover:text-amber-300 font-semibold transition-colors"
              title="Click to change weather location"
            >
              {weather?.city || configuredCity}
            </button>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-2xl font-black text-white font-mono">
              {weather ? `${weather.temperature}°F` : '--°F'}
            </span>
            <span className="text-xs text-zinc-400 font-medium">
              {weather?.condition || 'Updating...'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex flex-col text-right text-[11px] text-zinc-400 space-y-0.5 font-mono">
          <div className="flex items-center justify-end gap-1">
            <Droplets className="w-3 h-3 text-cyan-400" />
            <span>{weather?.humidity ?? '--'}% humidity</span>
          </div>
          <div className="flex items-center justify-end gap-1">
            <Wind className="w-3 h-3 text-zinc-400" />
            <span>{weather?.windSpeed ?? '--'} mph wind</span>
          </div>
        </div>

        <button
          onClick={() => refreshWeather()}
          disabled={isWeatherLoading}
          title={`Refresh ${configuredCity} weather`}
          className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2 rounded-lg bg-[#000000] hover:bg-[#111319] text-zinc-400 hover:text-white border border-[#1E222B] flex items-center justify-center transition-colors"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isWeatherLoading ? 'animate-spin text-emerald-400' : ''}`} />
        </button>
      </div>
    </div>
  );
});
