class Treatment {
  final int id;
  final String name;
  final int durationMinutes;
  final String category;
  final double defaultPrice;

  Treatment({
    required this.id,
    required this.name,
    required this.durationMinutes,
    required this.category,
    required this.defaultPrice,
  });

  factory Treatment.fromJson(Map<String, dynamic> json) {
    return Treatment(
      id: json['id'],
      name: json['name'] ?? '',
      durationMinutes: json['durationMinutes'] ?? 0,
      category: json['category'] ?? '',
      defaultPrice: (json['defaultPrice'] ?? 0).toDouble(),
    );
  }
}
