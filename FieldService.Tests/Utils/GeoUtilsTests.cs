using FieldService.Utils;

namespace FieldService.Tests.Utils;

/// <summary>
/// Testy formuły Haversine — odległość między dwoma punktami GPS.
/// Punkty referencyjne wzięte ze znanych odległości (Wikipedia, Google Maps).
/// </summary>
public class GeoUtilsTests
{
    [Fact]
    public void DistanceInMeters_SamePoint_ReturnsZero()
    {
        var d = GeoUtils.DistanceInMeters(52.2297, 21.0122, 52.2297, 21.0122);
        Assert.Equal(0, d, precision: 3);
    }

    [Fact]
    public void DistanceInMeters_WarsawToKrakow_ReturnsAround250km()
    {
        // Warszawa (52.2297, 21.0122) → Kraków (50.0647, 19.9450)
        // Rzeczywista odległość w linii prostej: ~252 km
        var d = GeoUtils.DistanceInMeters(52.2297, 21.0122, 50.0647, 19.9450);
        Assert.InRange(d / 1000.0, 250.0, 256.0);
    }

    [Fact]
    public void DistanceInMeters_OneKilometerNorth_ReturnsAround1000m()
    {
        // 0.009 stopnia szerokości ≈ 1 km
        var d = GeoUtils.DistanceInMeters(52.0, 21.0, 52.009, 21.0);
        Assert.InRange(d, 990, 1010);
    }

    [Fact]
    public void DistanceInMeters_IsSymmetric()
    {
        var a = GeoUtils.DistanceInMeters(52.2297, 21.0122, 50.0647, 19.9450);
        var b = GeoUtils.DistanceInMeters(50.0647, 19.9450, 52.2297, 21.0122);
        Assert.Equal(a, b, precision: 6);
    }

    [Theory]
    [InlineData(0, 0, 0, 0, 0)]
    [InlineData(0, 0, 0, 1, 111_195)]   // 1° długości na równiku ≈ 111.2 km
    [InlineData(0, 0, 1, 0, 111_195)]   // 1° szerokości ≈ 111.2 km
    public void DistanceInMeters_KnownReferences_WithinTolerance(
        double lat1, double lng1, double lat2, double lng2, double expectedMeters)
    {
        var d = GeoUtils.DistanceInMeters(lat1, lng1, lat2, lng2);
        // 0.5% tolerancja — Earth nie jest idealną kulą, formuła Haversine jest aproksymacją
        Assert.InRange(d, expectedMeters * 0.995, expectedMeters * 1.005);
    }
}
