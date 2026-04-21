using System.Text.Json;

namespace FieldService.Services;

public interface IGeocodingService
{
    Task<(double Lat, double Lng)?> GeocodeAsync(string address);
}

/// <summary>
/// Geokodowanie adresów przez Nominatim (OpenStreetMap) — darmowe, bez klucza API.
/// Rate limit: max 1 req/s, wymagany User-Agent.
/// </summary>
public class NominatimGeocodingService : IGeocodingService
{
    private readonly HttpClient _http;

    public NominatimGeocodingService(HttpClient http)
    {
        _http = http;
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("FieldServiceApp/1.0");
    }

    public async Task<(double Lat, double Lng)?> GeocodeAsync(string address)
    {
        try
        {
            var encoded = Uri.EscapeDataString(address);
            var url = $"https://nominatim.openstreetmap.org/search?q={encoded}&format=json&limit=1&countrycodes=pl";

            var response = await _http.GetAsync(url);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var results = doc.RootElement;

            if (results.GetArrayLength() == 0) return null;

            var first = results[0];
            var lat = double.Parse(first.GetProperty("lat").GetString()!,
                System.Globalization.CultureInfo.InvariantCulture);
            var lng = double.Parse(first.GetProperty("lon").GetString()!,
                System.Globalization.CultureInfo.InvariantCulture);

            return (lat, lng);
        }
        catch
        {
            return null;
        }
    }
}
