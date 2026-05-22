import { useEffect, useState } from "react";
import { Cloud, CloudRain, Sun, Wind, Droplets, CloudLightning, CloudDrizzle, Eye } from "lucide-react";

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
}

const WMO_TAMIL: Record<number, { label: string; icon: React.ReactNode }> = {
  0:  { label: "தெளிவான வானம்",   icon: <Sun className="h-5 w-5 text-yellow-400" /> },
  1:  { label: "சற்று மேகமூட்டம்", icon: <Sun className="h-5 w-5 text-yellow-300" /> },
  2:  { label: "மேகமூட்டம்",       icon: <Cloud className="h-5 w-5 text-slate-300" /> },
  3:  { label: "மேகமூட்டம்",       icon: <Cloud className="h-5 w-5 text-slate-400" /> },
  45: { label: "மூடுபனி",          icon: <Eye className="h-5 w-5 text-slate-300" /> },
  48: { label: "மூடுபனி",          icon: <Eye className="h-5 w-5 text-slate-300" /> },
  51: { label: "தூறல் மழை",        icon: <CloudDrizzle className="h-5 w-5 text-blue-300" /> },
  53: { label: "தூறல் மழை",        icon: <CloudDrizzle className="h-5 w-5 text-blue-300" /> },
  61: { label: "மழை",              icon: <CloudRain className="h-5 w-5 text-blue-400" /> },
  63: { label: "அதிக மழை",         icon: <CloudRain className="h-5 w-5 text-blue-500" /> },
  65: { label: "கனமழை",            icon: <CloudRain className="h-5 w-5 text-blue-600" /> },
  80: { label: "மழை தூறல்",        icon: <CloudRain className="h-5 w-5 text-blue-400" /> },
  81: { label: "மழை",              icon: <CloudRain className="h-5 w-5 text-blue-400" /> },
  95: { label: "இடியுடன் மழை",     icon: <CloudLightning className="h-5 w-5 text-yellow-400" /> },
  96: { label: "இடியுடன் மழை",     icon: <CloudLightning className="h-5 w-5 text-yellow-400" /> },
  99: { label: "இடியுடன் மழை",     icon: <CloudLightning className="h-5 w-5 text-yellow-400" /> },
};

function getWeatherInfo(code: number) {
  if (WMO_TAMIL[code]) return WMO_TAMIL[code];
  if (code >= 51 && code <= 67) return WMO_TAMIL[61];
  if (code >= 80 && code <= 82) return WMO_TAMIL[80];
  if (code >= 95) return WMO_TAMIL[95];
  if (code >= 45) return WMO_TAMIL[45];
  return WMO_TAMIL[2];
}

const WeatherWidget = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=10.7905&longitude=78.7047" +
      "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m" +
      "&timezone=Asia%2FKolkata&wind_speed_unit=kmh"
    )
      .then(r => r.json())
      .then(d => {
        const c = d.current;
        setWeather({
          temperature: Math.round(c.temperature_2m),
          humidity: c.relative_humidity_2m,
          windSpeed: Math.round(c.wind_speed_10m),
          weatherCode: c.weather_code,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!weather) return null;

  const info = getWeatherInfo(weather.weatherCode);

  return (
    <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] border-b border-white/5">
      <div className="container flex items-center justify-between py-2 gap-4 text-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {info.icon}
            <span className="text-2xl font-bold tabular-nums">{weather.temperature}°C</span>
          </div>
          <div>
            <p className="text-xs font-heading uppercase tracking-wider text-white/70">{info.label}</p>
            <p className="text-[10px] text-white/40 flex items-center gap-1">
              <span>திருச்சிராப்பள்ளி</span>
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-4 text-xs text-white/60">
          <div className="flex items-center gap-1">
            <Droplets className="h-3.5 w-3.5 text-blue-400" />
            <span>{weather.humidity}% ஈரப்பதம்</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="h-3.5 w-3.5 text-slate-400" />
            <span>{weather.windSpeed} km/h காற்று</span>
          </div>
        </div>
        <p className="text-[10px] text-white/30 hidden md:block">Open-Meteo</p>
      </div>
    </div>
  );
};

export default WeatherWidget;
