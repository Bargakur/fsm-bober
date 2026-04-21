namespace FieldService.Utils;

/// <summary>
/// Haversine formula — odległość między dwoma punktami na kuli ziemskiej.
/// </summary>
public static class GeoUtils
{
    private const double EarthRadiusMeters = 6_371_000;

    public static double DistanceInMeters(double lat1, double lng1, double lat2, double lng2)
    {
        var dLat = ToRad(lat2 - lat1);
        var dLng = ToRad(lng2 - lng1);

        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
              + Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2))
              * Math.Sin(dLng / 2) * Math.Sin(dLng / 2);

        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

        return EarthRadiusMeters * c;
    }

    private static double ToRad(double deg) => deg * Math.PI / 180.0;
}
